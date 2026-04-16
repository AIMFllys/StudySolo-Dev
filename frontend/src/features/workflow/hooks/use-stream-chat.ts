'use client';

/**
 * useStreamChat — 流式 AI 对话 Hook（副作用收口层）.
 *
 * 职责：
 *  - 发起 /api/ai/chat-stream 的 SSE 流式请求
 *  - 解析 SSE 协议，回调 onToken / onDone / onError
 *  - 支持 AbortController 中止
 *  - 处理 MODIFY intent → executeCanvasActions
 *  - 处理 BUILD intent → /api/ai/generate-workflow
 *
 * 遵循规范 §9.1：只发送正式字段 selected_model_key，不再发送兼容字段。
 */

import { useCallback } from 'react';
import type { CanvasContext } from './use-canvas-context';
import type { ChatEntry } from '@/stores/chat/use-conversation-store';
import type { ThinkingDepth } from '@/components/layout/sidebar/SidebarAIPanel';
import { useAIChatStore, abortAIChatStream } from '@/stores/chat/use-ai-chat-store';
import { persistConversationMessage } from './chat-conversation-sync';
import { authedStreamFetch } from '@/services/api-client';
import { parseSSEStream } from './stream-chat-sse';
import { handleBuildIntent, handleModifyIntent } from './stream-chat-intents';

export interface StreamChatOptions {
  userInput: string;
  canvasContext: CanvasContext | null;
  history: ChatEntry[];
  intentHint?: string | null;
  mode?: 'plan' | 'chat' | 'create';
  /** Accepts AIModelOption (Track B) or ChatModelOption (Track A) — only skuId is consumed */
  selectedModel: { skuId: string | null };
  thinkingDepth?: ThinkingDepth;
}

export function useStreamChat() {
  const {
    setLoading,
    setStreaming,
    setAbortController,
    setError,
    updateMessage,
  } = useAIChatStore();

  const send = useCallback(async (opts: StreamChatOptions) => {
    const { userInput, canvasContext, history, intentHint, mode, selectedModel, thinkingDepth = 'balanced' } = opts;

    abortAIChatStream();

    const ctrl = new AbortController();
    const assistantMsgId = crypto.randomUUID();

    setAbortController(ctrl);
    setLoading(true);
    setStreaming(true, assistantMsgId);
    setError(null);

    useAIChatStore.getState().syncHistory([
      ...history,
      { id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now() },
    ]);

    const body = {
      user_input: userInput,
      canvas_context: canvasContext?.nodesSummary.length
        ? {
            workflow_id: canvasContext.workflowId,
            workflow_name: canvasContext.workflowName,
            nodes: canvasContext.nodesSummary.map((n) => ({
              id: n.id, index: n.index, label: n.label, type: n.type,
              status: n.status, has_output: n.hasOutput,
              output_preview: n.outputPreview,
              upstream_labels: n.upstreamLabels,
              downstream_labels: n.downstreamLabels,
              position: n.position,
            })),
            dag_description: canvasContext.dagDescription,
            selected_node_id: canvasContext.selectedNodeId,
            execution_status: canvasContext.executionStatus,
          }
        : null,
      conversation_history: history.slice(-10).map((h) => ({
        role: h.role, content: h.content, timestamp: h.timestamp,
      })),
      intent_hint: intentHint,
      mode: mode ?? 'chat',
      selected_model_key: selectedModel.skuId,
      thinking_level: thinkingDepth,
    };

    let finalText = '';
    let intent = 'CHAT';

    try {
      const res = await authedStreamFetch('/api/ai/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({})) as { response?: string; intent?: string; detail?: string };
        if (data.detail) throw new Error(data.detail);
        finalText = data.response ?? '';
        intent = data.intent ?? 'CHAT';
      } else {
        const reader = res.body.getReader();
        setLoading(false);

        const parsed = await parseSSEStream(reader, (token) => {
          finalText += token;
          updateMessage(assistantMsgId, finalText);
        });
        finalText = parsed.fullText;
        intent = parsed.intent;
      }

      let displayText = finalText || '（已完成）';

      if (intent === 'BUILD') {
        try {
          displayText = await handleBuildIntent(userInput, thinkingDepth);
        } catch (e) {
          displayText = `❌ ${e instanceof Error ? e.message : '生成失败'}`;
        }
      } else if (intent === 'MODIFY') {
        displayText = await handleModifyIntent(finalText, assistantMsgId);
      }

      updateMessage(assistantMsgId, displayText);

      persistConversationMessage({
        id: assistantMsgId,
        role: 'assistant',
        content: displayText,
        timestamp: Date.now(),
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : '请求失败';
      setError(msg);
      updateMessage(assistantMsgId, `❌ ${msg}`);
    } finally {
      setStreaming(false, null);
      setLoading(false);
      setAbortController(null);
    }
  }, [setLoading, setStreaming, setAbortController, setError, updateMessage]);

  const abort = useCallback(() => {
    abortAIChatStream();
  }, []);

  return { send, abort };
}
