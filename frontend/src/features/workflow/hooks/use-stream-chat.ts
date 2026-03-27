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
import type { AIModelOption } from '@/features/workflow/constants/ai-models';
import type { ChatEntry } from '@/stores/use-conversation-store';
import type { ThinkingDepth } from '@/components/layout/sidebar/SidebarAIPanel';
import { useAIChatStore, abortAIChatStream } from '@/stores/use-ai-chat-store';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import { useConversationStore } from '@/stores/use-conversation-store';
import { executeCanvasActions, type CanvasAction } from './use-action-executor';

// ── Types ────────────────────────────────────────────────────────────

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

interface GenerateResponse {
  nodes: unknown[];
  edges: unknown[];
  implicit_context: Record<string, unknown>;
}

function hydrateTriggerInputNodes(nodes: unknown[], userInput: string) {
  return nodes.map((node) => {
    if (!node || typeof node !== 'object') {
      return node;
    }
    const typedNode = node as {
      type?: string;
      data?: Record<string, unknown>;
    };
    if (typedNode.type !== 'trigger_input') {
      return node;
    }

    const nextData = {
      ...(typedNode.data ?? {}),
      user_content: (typedNode.data?.user_content as string | undefined) || userInput,
      label: (typedNode.data?.label as string | undefined) || userInput.trim().slice(0, 80) || '用户输入',
    };

    return {
      ...typedNode,
      data: nextData,
    };
  });
}

// ── SSE parser ───────────────────────────────────────────────────────

async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onToken: (t: string) => void,
): Promise<{ fullText: string; intent: string }> {
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let intent = 'CHAT';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const raw = trimmed.slice(5).trim();
      if (raw === '[DONE]') { await reader.cancel(); return { fullText, intent }; }

      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed.intent) intent = parsed.intent as string;

        // MODIFY / BUILD: single terminal JSON event
        if (parsed.done && (intent === 'MODIFY' || intent === 'BUILD')) {
          fullText = JSON.stringify(parsed);
          await reader.cancel();
          return { fullText, intent };
        }

        // CHAT: stream tokens
        if (parsed.token) {
          const token = parsed.token as string;
          fullText += token;
          onToken(token);
        }

        if (parsed.done) { await reader.cancel(); return { fullText, intent }; }
      } catch { /* partial JSON, skip */ }
    }
  }

  return { fullText, intent };
}

// ── BUILD handler ────────────────────────────────────────────────────

async function handleBuildIntent(userInput: string, thinkingDepth: ThinkingDepth): Promise<string> {
  const wfStore = useWorkflowStore.getState();
  wfStore.replaceWorkflowGraph(
    [{ id: 'generating-node', position: { x: 300, y: 200 }, type: 'generating', data: {} }],
    [],
  );

  const res = await fetch('/api/ai/generate-workflow', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_input: userInput, thinking_level: thinkingDepth }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as GenerateResponse;
  const hydratedNodes = hydrateTriggerInputNodes(data.nodes, userInput);
  wfStore.replaceWorkflowGraph(
    hydratedNodes as Parameters<typeof wfStore.replaceWorkflowGraph>[0],
    data.edges as Parameters<typeof wfStore.replaceWorkflowGraph>[1],
  );
  wfStore.setGenerationContext(userInput, data.implicit_context);

  return `✅ 已生成 ${hydratedNodes.length} 个节点。`;
}

// ── MODIFY handler ───────────────────────────────────────────────────

async function handleModifyIntent(
  rawJson: string,
  msgId: string,
): Promise<string> {
  try {
    const p = JSON.parse(rawJson) as {
      actions?: CanvasAction[];
      response?: string;
      error?: string;
      error_detail?: string;
    };
    if (p.error) {
      console.warn('Modify intent failed to produce executable actions', {
        msgId,
        error: p.error,
        detail: p.error_detail,
        rawJson,
      });
      return `⚠️ ${p.response ?? 'AI 没有返回可执行的画布操作。请重试，或改用手动编辑节点。'}`;
    }
    const actions = p.actions ?? [];
    if (!actions.length) return p.response ?? '（完成）';

    const result = await executeCanvasActions(actions);
    return result.success
      ? `✅ ${p.response || '完成'} (${result.appliedCount}步)`
      : `⚠️ ${result.error}`;
  } catch (error) {
    console.warn('Failed to parse MODIFY payload', { msgId, error, rawJson });
    return '⚠️ AI 返回了不可执行的画布操作。请重试，或改用手动编辑节点。';
  }
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useStreamChat() {
  const {
    setLoading,
    setStreaming,
    setAbortController,
    setError,
    pushMessage,
    updateMessage,
  } = useAIChatStore();

  const send = useCallback(async (opts: StreamChatOptions) => {
    const { userInput, canvasContext, history, intentHint, mode, selectedModel, thinkingDepth = 'balanced' } = opts;

    // Abort previous stream
    abortAIChatStream();

    const ctrl = new AbortController();
    const assistantMsgId = crypto.randomUUID();

    setAbortController(ctrl);
    setLoading(true);
    setStreaming(true, assistantMsgId);
    setError(null);

    // Seed the assistant message slot immediately (streaming placeholder)
    useAIChatStore.getState().syncHistory([
      ...history,
      { id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now() },
    ]);

    // Build request body — only formal fields per 规范 §9.1
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
      selected_model_key: selectedModel.skuId, // ✅ 唯一正式字段（规范 §9.1）
      thinking_level: thinkingDepth,
    };

    let finalText = '';
    let intent = 'CHAT';

    try {
      const res = await fetch('/api/ai/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
        setLoading(false); // First chunk received

        const parsed = await parseSSEStream(reader, (token) => {
          finalText += token;
          updateMessage(assistantMsgId, finalText);
        });
        finalText = parsed.fullText;
        intent = parsed.intent;
      }

      // ── Post-stream intent handling ──────────────────────────────
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

      // Persist final message to conversation store
      useConversationStore.getState().appendMessage({
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
  }, [setLoading, setStreaming, setAbortController, setError, pushMessage, updateMessage]);

  const abort = useCallback(() => {
    abortAIChatStream();
  }, []);

  return { send, abort };
}
