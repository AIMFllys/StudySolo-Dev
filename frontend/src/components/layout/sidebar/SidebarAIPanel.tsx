'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatMessages } from './ChatMessages';
import { ChatInputBar } from './ChatInputBar';
import { SidebarAIPanelHeader } from './SidebarAIPanelHeader';
import { persistConversationMessage } from '@/features/workflow/hooks/chat-conversation-sync';
import { useCanvasContext } from '@/features/workflow/hooks/use-canvas-context';
import { useConversationStore } from '@/stores/chat/use-conversation-store';
import { useStreamChat } from '@/features/workflow/hooks/use-stream-chat';
import { useWorkflowExecution } from '@/features/workflow/hooks/use-workflow-execution';
import { getChatModelList, type ChatModelOption } from '@/services/ai-catalog.service';
import { getUser, type TierType } from '@/services/auth.service';
import { useAIChatStore } from '@/stores/chat/use-ai-chat-store';
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';

export type AIMode = 'plan' | 'chat' | 'create';
export type ThinkingDepth = 'fast' | 'balanced' | 'deep';

export function SidebarAIPanel() {
  const {
    input,
    setInput,
    loading,
    error,
    setError,
    history,
    syncHistory,
    clearHistory,
    pushMessage,
    streaming,
    streamingMessageId,
    mode,
    setMode,
    thinkingDepth,
    setThinkingDepth,
  } = useAIChatStore();

  const { send: sendStream, abort: abortStream } = useStreamChat();

  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [userTier, setUserTier] = useState<TierType>('free');
  const [chatModels, setChatModels] = useState<ChatModelOption[]>([]);
  const [isModelsLoading, setIsModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState(false);
  // Track A selected model — default to first accessible model once list loads
  const [selectedChatModel, setSelectedChatModel] = useState<ChatModelOption | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const historyDropdownRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const { lastPrompt, undo } = useWorkflowStore();
  const { start: startExecution } = useWorkflowExecution();
  const { serialize } = useCanvasContext();
  const {
    conversations,
    activeConversation,
    createConversation,
    switchConversation,
    clearActive,
    deleteConversation,
    initStore,
  } = useConversationStore();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (historyDropdownRef.current && !historyDropdownRef.current.contains(e.target as HTMLElement)) {
        setShowHistoryDropdown(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as HTMLElement)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    getUser().then((user) => setUserTier(user.tier ?? 'free')).catch(() => null);
  }, []);

  const fetchChatModels = useCallback(() => {
    setIsModelsLoading(true);
    setModelsError(false);
    getChatModelList()
      .then((models) => {
        setChatModels(models);
        const firstAccessible = models.find((m) => m.isAccessible) ?? models[0];
        setSelectedChatModel((prev) => prev ?? firstAccessible ?? null);
      })
      .catch(() => {
        setModelsError(true);
      })
      .finally(() => {
        setIsModelsLoading(false);
      });
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void fetchChatModels();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [fetchChatModels]);

  useEffect(() => {
    initStore();
  }, [initStore]);

  useEffect(() => {
    if (history.length === 0 && activeConversation && activeConversation.messages.length > 0) {
      syncHistory(activeConversation.messages);
    }
  }, [history.length, activeConversation, syncHistory]);

  const appendChatMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    const id = pushMessage(role, content);
    persistConversationMessage({
      id,
      role,
      content,
      timestamp: Date.now(),
    });
    return id;
  }, [pushMessage]);

  const handleQuickAction = useCallback((text: string): boolean => {
    if (/^(运行|执行|开始跑一个)/.test(text)) {
      startExecution();
      appendChatMessage('assistant', '已开始运行工作流。');
      return true;
    }
    if (/^(撤销|undo)/.test(text)) {
      undo();
      appendChatMessage('assistant', '已撤销。');
      return true;
    }
    return false;
  }, [appendChatMessage, startExecution, undo]);

  const handleSend = async () => {
    if ((!input.trim() && !streaming) || loading) {
      return;
    }
    if (streaming) {
      abortStream();
      return;
    }

    const userInput = input.trim();
    if (!userInput) {
      return;
    }

    appendChatMessage('user', userInput);
    setInput('');
    setError(null);

    if (handleQuickAction(userInput)) {
      return;
    }

    const currentHistory = useAIChatStore.getState().history;
    await sendStream({
      userInput,
      canvasContext: serialize(),
      history: currentHistory,
      intentHint: mode === 'chat' ? 'CHAT' : undefined,
      mode,
      // Track A: pass chat panel model's skuId to backend
      selectedModel: { skuId: selectedChatModel?.skuId ?? null },
      thinkingDepth,
    });

  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <SidebarAIPanelHeader
        showHistoryDropdown={showHistoryDropdown}
        setShowHistoryDropdown={setShowHistoryDropdown}
        showMoreMenu={showMoreMenu}
        setShowMoreMenu={setShowMoreMenu}
        conversations={conversations}
        syncHistory={syncHistory}
        switchConversation={switchConversation}
        deleteConversation={deleteConversation}
        onNewConversation={() => { clearHistory(); setError(null); setInput(''); createConversation(); }}
        onClearAll={() => { clearHistory(); clearActive(); setError(null); setShowMoreMenu(false); }}
        historyDropdownRef={historyDropdownRef}
        moreMenuRef={moreMenuRef}
      />

      <ChatMessages
        history={history}
        loading={loading}
        streaming={streaming}
        streamingMessageId={streamingMessageId}
        lastPrompt={lastPrompt}
        scrollRef={scrollRef}
        onModeSwitch={(nextMode) => setMode(nextMode as AIMode)}
      />

      <ChatInputBar
        input={input}
        setInput={setInput}
        mode={mode}
        setMode={setMode}
        thinkingDepth={thinkingDepth}
        setThinkingDepth={setThinkingDepth}
        loading={loading}
        streaming={streaming}
        error={error}
        setError={setError}
        onSend={() => void handleSend()}
        chatModel={selectedChatModel}
        chatModels={chatModels}
        onModelChange={setSelectedChatModel}
        userTier={userTier}
        isModelsLoading={isModelsLoading}
        modelsError={modelsError}
        onModelsRetry={fetchChatModels}
      />
    </div>
  );
}
