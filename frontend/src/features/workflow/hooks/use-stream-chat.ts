'use client';

/**
 * useStreamChat — 流式 AI 对话 Hook（副作用收口层）.
 *
 * 支持两种后端协议：
 *  1. 新 agent-loop XML 协议（默认）：流式推送 segment / tool_call / tool_result /
 *     canvas_mutation / ui_effect 事件，前端分段渲染并在收到 canvas_mutation 时
 *     直接同步到 WorkflowStore。
 *  2. 旧 token/intent 协议（BUILD/MODIFY 回退）：保留原有 handleBuildIntent /
 *     handleModifyIntent 分支处理。
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { CanvasContext } from './use-canvas-context';
import type { ChatEntry, ChatSegment, ChatSummaryChange } from '@/stores/chat/use-conversation-store';
import type { ThinkingDepth } from '@/components/layout/sidebar/SidebarAIPanel';
import type { Edge, Node } from '@xyflow/react';
import { useAIChatStore, abortAIChatStream } from '@/stores/chat/use-ai-chat-store';
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';
import { persistConversationMessage } from './chat-conversation-sync';
import { authedStreamFetch } from '@/services/api-client';
import { parseSSEStream, type AgentStreamEvent } from './stream-chat-sse';
import { handleBuildIntent, handleModifyIntent } from './stream-chat-intents';
import { nodeTypes as KNOWN_NODE_TYPES } from '@/features/workflow/components/canvas/canvas-constants';
import { resolveEffectiveThinkingDepth } from '@/services/ai-catalog.service';

export interface StreamChatOptions {
  userInput: string;
  canvasContext: CanvasContext | null;
  history: ChatEntry[];
  intentHint?: string | null;
  mode?: 'plan' | 'chat' | 'create';
  selectedModel: { skuId: string | null; supportsThinking: boolean | null };
  thinkingDepth?: ThinkingDepth;
}

export function buildChatStreamRequestBody(opts: StreamChatOptions) {
  const {
    userInput,
    canvasContext,
    history,
    intentHint,
    mode,
    selectedModel,
    thinkingDepth = 'fast',
  } = opts;

  const effectiveThinkingDepth = resolveEffectiveThinkingDepth(
    thinkingDepth,
    selectedModel.skuId && selectedModel.supportsThinking !== null
      ? { skuId: selectedModel.skuId, supportsThinking: selectedModel.supportsThinking }
      : null,
  );

  const hasCanvasContext = Boolean(
    canvasContext &&
      (
        canvasContext.workflowId ||
        canvasContext.workflowName ||
        canvasContext.nodesSummary.length > 0 ||
        canvasContext.selectedNodeId ||
        canvasContext.dagDescription ||
        canvasContext.executionStatus
      ),
  );

  return {
    user_input: userInput,
    canvas_context: hasCanvasContext
      ? {
          workflow_id: canvasContext?.workflowId ?? null,
          workflow_name: canvasContext?.workflowName ?? '',
          nodes: (canvasContext?.nodesSummary ?? []).map((n) => ({
            id: n.id, index: n.index, label: n.label, type: n.type,
            status: n.status, has_output: n.hasOutput,
            output_preview: n.outputPreview,
            upstream_labels: n.upstreamLabels,
            downstream_labels: n.downstreamLabels,
            position: n.position,
          })),
          dag_description: canvasContext?.dagDescription ?? '',
          selected_node_id: canvasContext?.selectedNodeId ?? null,
          execution_status: canvasContext?.executionStatus ?? null,
        }
      : null,
    conversation_history: history.slice(-10).map((h) => ({
      role: h.role, content: h.content, timestamp: h.timestamp,
    })),
    intent_hint: intentHint,
    mode: mode ?? 'chat',
    selected_model_key: selectedModel.skuId,
    thinking_level: effectiveThinkingDepth,
  };
}

export function useStreamChat() {
  const router = useRouter();
  const {
    setLoading,
    setStreaming,
    setAbortController,
    setError,
    updateMessage,
    patchMessage,
    setMessageSegments,
    setMessageSummary,
  } = useAIChatStore();

  const send = useCallback(async (opts: StreamChatOptions) => {
    const { history, userInput } = opts;

    abortAIChatStream();

    const ctrl = new AbortController();
    const assistantMsgId = crypto.randomUUID();

    setAbortController(ctrl);
    setLoading(true);
    setStreaming(true, assistantMsgId);
    setError(null);

    useAIChatStore.getState().syncHistory([
      ...history,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        segments: [],
        summary: [],
        isStreaming: true,
      },
    ]);

    const body = buildChatStreamRequestBody(opts);
    const effectiveThinkingDepth = body.thinking_level;

    let finalText = '';
    let intent = 'CHAT';
    let finalSegments: ChatSegment[] = [];
    let finalSummary: ChatSummaryChange[] = [];

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

        const parsed = await parseSSEStream(reader, {
          onToken: (token) => {
            finalText += token;
            updateMessage(assistantMsgId, finalText);
          },
          onEvent: (event) => {
            handleAgentEvent(event, router);
          },
          onSegments: (segs) => {
            setMessageSegments(assistantMsgId, segs as ChatSegment[]);
          },
          onSummary: (items) => {
            setMessageSummary(assistantMsgId, items as ChatSummaryChange[]);
          },
        });

        finalText = parsed.fullText;
        intent = parsed.intent;
        finalSegments = parsed.segments as ChatSegment[];
        finalSummary = parsed.summary as ChatSummaryChange[];
        setMessageSegments(assistantMsgId, finalSegments);
        setMessageSummary(assistantMsgId, finalSummary);
      }

      let displayText = finalText || '（已完成）';

      if (intent === 'BUILD') {
        try {
          displayText = await handleBuildIntent(userInput, effectiveThinkingDepth);
        } catch (e) {
          displayText = `❌ ${e instanceof Error ? e.message : '生成失败'}`;
        }
      } else if (intent === 'MODIFY') {
        displayText = await handleModifyIntent(finalText, assistantMsgId);
      }

      updateMessage(assistantMsgId, displayText);
      patchMessage(assistantMsgId, { isStreaming: false });

      persistConversationMessage({
        id: assistantMsgId,
        role: 'assistant',
        content: displayText,
        timestamp: Date.now(),
        segments: finalSegments.length ? finalSegments : undefined,
        summary: finalSummary.length ? finalSummary : undefined,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : '请求失败';
      setError(msg);
      updateMessage(assistantMsgId, `❌ ${msg}`);
      patchMessage(assistantMsgId, { isStreaming: false });
    } finally {
      setStreaming(false, null);
      setLoading(false);
      setAbortController(null);
    }
  }, [
    router,
    setLoading,
    setStreaming,
    setAbortController,
    setError,
    updateMessage,
    patchMessage,
    setMessageSegments,
    setMessageSummary,
  ]);

  const abort = useCallback(() => {
    abortAIChatStream();
  }, []);

  return { send, abort };
}


// ── Event handlers ─────────────────────────────────────────────────────

function handleAgentEvent(
  event: AgentStreamEvent,
  router: ReturnType<typeof useRouter>,
) {
  if (event.type === 'canvas_mutation') {
    const payload = event.payload as { nodes?: Node[]; edges?: Edge[] };
    const rawNodes = Array.isArray(payload.nodes) ? payload.nodes : [];
    const edges = Array.isArray(payload.edges) ? payload.edges : [];
    // Normalise types: any backend-generated type that the frontend can't render
    // is coerced into `ai_step` so it still surfaces as a proper node card rather
    // than React Flow's blank fallback ("text block").
    const nodes = rawNodes.map((n) => {
      if (!n || typeof n !== 'object') return n;
      const t = (n as Node).type;
      if (t && !(t in KNOWN_NODE_TYPES)) {
        return { ...(n as Node), type: 'ai_step' } as Node;
      }
      return n as Node;
    });
    useWorkflowStore.getState().replaceWorkflowGraph(nodes, edges);
    return;
  }
  if (event.type === 'ui_effect') {
    const payload = event.payload as { type?: string; url?: string };
    if (payload.type === 'router_push' && typeof payload.url === 'string' && payload.url) {
      try {
        router.push(payload.url);
      } catch {
        // ignore router errors
      }
    }
  }
}
