'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, History, MoreHorizontal, Plus, Trash2, X } from 'lucide-react';
import { ChatMessages } from './ChatMessages';
import { ChatInputBar } from './ChatInputBar';
import { useCanvasContext } from '@/features/workflow/hooks/use-canvas-context';
import { useConversationStore } from '@/stores/use-conversation-store';
import { useStreamChat } from '@/features/workflow/hooks/use-stream-chat';
import { useWorkflowExecution } from '@/features/workflow/hooks/use-workflow-execution';
import { getChatModelList, type ChatModelOption } from '@/services/ai-catalog.service';
import { getUser, type TierType } from '@/services/auth.service';
import { useAIChatStore } from '@/stores/use-ai-chat-store';
import { useWorkflowStore } from '@/stores/use-workflow-store';

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
    selectedModel,
    setSelectedModel,
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
    fetchChatModels();
  }, [fetchChatModels]);

  useEffect(() => {
    initStore();
  }, [initStore]);

  useEffect(() => {
    if (history.length === 0 && activeConversation && activeConversation.messages.length > 0) {
      syncHistory(activeConversation.messages);
    }
  }, [history.length, activeConversation, syncHistory]);

  const handleQuickAction = useCallback((text: string): boolean => {
    if (/^(运行|执行|开始跑一个)/.test(text)) {
      startExecution();
      pushMessage('assistant', '已开始运行工作流。');
      return true;
    }
    if (/^(撤销|undo)/.test(text)) {
      undo();
      pushMessage('assistant', '已撤销。');
      return true;
    }
    return false;
  }, [pushMessage, startExecution, undo]);

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

    pushMessage('user', userInput);
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
      <div className="shrink-0 flex items-center justify-between px-3 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground font-serif">
            AI 对话
          </span>
        </div>

        <div className="flex items-center gap-1">
          <div className="relative" ref={historyDropdownRef}>
            <button
              type="button"
              onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground"
              title="对话记录"
            >
              <History className="h-3 w-3" />
              <ChevronDown className={`h-2.5 w-2.5 transition-transform duration-200 opacity-70 ${showHistoryDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showHistoryDropdown ? (
              <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border-[1.5px] border-border/50 node-paper-bg p-1.5 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 font-serif">
                  最近对话
                </div>
                {conversations.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground/50">暂无记录</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto scrollbar-hide">
                    {[...conversations].reverse().map((conversation) => (
                      <div
                        key={conversation.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          syncHistory(conversation.messages);
                          switchConversation(conversation.id);
                          setShowHistoryDropdown(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            syncHistory(conversation.messages);
                            switchConversation(conversation.id);
                            setShowHistoryDropdown(false);
                          }
                        }}
                        className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all hover:bg-white/5 cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] font-medium text-foreground/90 truncate block">{conversation.title}</span>
                          <span className="text-[10px] text-muted-foreground/50 truncate block">{conversation.preview}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conversation.id);
                          }}
                          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-destructive transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="h-3 w-px bg-border/50 mx-0.5" />

          <button
            type="button"
            onClick={() => {
              clearHistory();
              setError(null);
              setInput('');
              createConversation();
            }}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground"
            title="新建对话"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground"
              title="更多"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {showMoreMenu ? (
              <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-xl border-[1.5px] border-border/50 node-paper-bg p-1 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                <button
                  type="button"
                  onClick={() => {
                    clearHistory();
                    clearActive();
                    setError(null);
                    setShowMoreMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] text-muted-foreground transition-all hover:bg-white/5 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                  清空对话
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

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
