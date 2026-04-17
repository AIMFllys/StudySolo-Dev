'use client';

/**
 * useAIChatStore — AI 对话状态切片 (纯状态，无副作用).
 *
 * 职责边界：
 *  - 持有 UI 层所需的所有对话状态字段
 *  - 提供同步 setter（setInput、pushMessage 等）
 *  - 不执行任何 fetch / SSE 解析 / 跨 Store 调用
 *
 * 流式发送逻辑已收口到：
 *  → features/workflow/hooks/use-stream-chat.ts (SSE 解析 + fetch)
 *  → features/workflow/hooks/use-workflow-execution.ts (BUILD 触发)
 */

import { create } from 'zustand';
import type { ChatEntry, ChatSegment, ChatSummaryChange } from './use-conversation-store';
import type { AIMode, ThinkingDepth } from '@/components/layout/sidebar/SidebarAIPanel';
import type { AIModelOption } from '@/features/workflow/constants/ai-models';
import { DEFAULT_MODEL } from '@/features/workflow/constants/ai-models';

// ── Types ───────────────────────────────────────────────────────────

export interface AIChatState {
  input: string;
  loading: boolean;
  streaming: boolean;
  streamingMessageId: string | null;
  error: string | null;
  history: ChatEntry[];
  mode: AIMode;
  thinkingDepth: ThinkingDepth;
  selectedModel: AIModelOption;
  abortController: AbortController | null;

  // Setters
  setInput: (input: string) => void;
  setMode: (mode: AIMode) => void;
  setThinkingDepth: (depth: ThinkingDepth) => void;
  setSelectedModel: (model: AIModelOption) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean, msgId?: string | null) => void;
  setAbortController: (ctrl: AbortController | null) => void;

  // History management
  syncHistory: (messages: ChatEntry[]) => void;
  pushMessage: (role: 'user' | 'assistant', content: string) => string;
  updateMessage: (id: string, newContent: string) => void;
  /** Partial patch of any assistant message (segments/summary/streaming flag). */
  patchMessage: (id: string, patch: Partial<Omit<ChatEntry, 'id'>>) => void;
  /** Replace the segments array of an assistant message. */
  setMessageSegments: (id: string, segments: ChatSegment[]) => void;
  setMessageSummary: (id: string, summary: ChatSummaryChange[]) => void;
  clearHistory: () => void;
}

// ── Store ────────────────────────────────────────────────────────────

export const useAIChatStore = create<AIChatState>((set) => ({
  input: '',
  loading: false,
  streaming: false,
  streamingMessageId: null,
  error: null,
  history: [],
  mode: 'chat',
  thinkingDepth: 'fast',
  selectedModel: DEFAULT_MODEL,
  abortController: null,

  setInput: (input) => set({ input }),
  setMode: (mode) => set({ mode }),
  setThinkingDepth: (thinkingDepth) => set({ thinkingDepth }),
  setSelectedModel: (selectedModel) => set({ selectedModel }),
  setError: (error) => set({ error }),
  setLoading: (loading) => set({ loading }),

  setStreaming: (streaming, msgId) =>
    set({ streaming, ...(msgId !== undefined && { streamingMessageId: msgId }) }),

  setAbortController: (abortController) => set({ abortController }),

  syncHistory: (messages) => set({ history: messages }),

  pushMessage: (role, content) => {
    const entry: ChatEntry = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: Date.now(),
    };
    set((state) => ({ history: [...state.history, entry] }));
    return entry.id;
  },

  updateMessage: (id, newContent) =>
    set((state) => ({
      history: state.history.map((m) =>
        m.id === id ? { ...m, content: newContent } : m,
      ),
    })),

  patchMessage: (id, patch) =>
    set((state) => ({
      history: state.history.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  setMessageSegments: (id, segments) =>
    set((state) => ({
      history: state.history.map((m) =>
        m.id === id ? { ...m, segments: [...segments] } : m,
      ),
    })),

  setMessageSummary: (id, summary) =>
    set((state) => ({
      history: state.history.map((m) =>
        m.id === id ? { ...m, summary: [...summary] } : m,
      ),
    })),

  clearHistory: () => set({ history: [], error: null }),
}));

// ── Selector helpers ─────────────────────────────────────────────────

/** 中止当前流式请求（由 use-stream-chat.ts 的 abort 触发后调用） */
export function abortAIChatStream() {
  const { abortController } = useAIChatStore.getState();
  abortController?.abort();
  useAIChatStore.setState({
    streaming: false,
    loading: false,
    streamingMessageId: null,
  });
}
