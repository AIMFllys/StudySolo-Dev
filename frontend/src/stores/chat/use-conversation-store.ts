'use client';

/**
 * AI 对话持久化 — 基于 localStorage.
 *
 * 每次对话保存到 'studysolo:ai-conversations' key。
 * 支持多会话管理、标题自动提取、会话切换。
 * 单文件 < 300 行。
 */

import { create } from 'zustand';

// ── Types ────────────────────────────────────────────────────────────

/**
 * Lightweight mirror of the AgentSegment model from
 * features/workflow/hooks/stream-chat-sse.ts. Keeping the type inline here
 * avoids a dependency cycle between the chat store and the workflow hooks.
 */
export type ChatSegmentKind =
  | 'thinking'
  | 'answer'
  | 'summary'
  | 'plan'
  | 'plan.analysis'
  | 'plan.recommendations'
  | 'plan.response'
  | 'plan.step'
  | 'tool_call'
  | 'warning';

export interface ChatTextSegment {
  id: string;
  kind: Exclude<ChatSegmentKind, 'tool_call'>;
  text: string;
  attrs?: Record<string, string>;
}

export interface ChatToolCallSegment {
  id: string;
  kind: 'tool_call';
  tool: string;
  params: unknown;
  status: 'running' | 'ok' | 'error';
  result?: unknown;
  error?: string;
}

export type ChatSegment = ChatTextSegment | ChatToolCallSegment;

export interface ChatSummaryChange {
  text: string;
}

export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** Structured XML-protocol segments for assistant messages (optional). */
  segments?: ChatSegment[];
  /** Change list emitted by the agent loop's <summary> block. */
  summary?: ChatSummaryChange[];
  /** True while SSE stream is still being consumed. */
  isStreaming?: boolean;
}

export interface ConversationRecord {
  id: string;
  title: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatEntry[];
}

const STORAGE_KEY = 'studysolo:ai-conversations';
const MAX_CONVERSATIONS = 20;
const MAX_MESSAGES_PER_CONV = 100;

// ── Storage helpers ───────────────────────────────────────────────

function loadAll(): ConversationRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ConversationRecord[]) : [];
  } catch {
    return [];
  }
}

function saveAll(records: ConversationRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // quota exceeded — trim oldest and retry
    const trimmed = records.slice(-10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }
}

function extractTitle(firstUserMessage: string): string {
  return firstUserMessage.slice(0, 24) + (firstUserMessage.length > 24 ? '...' : '');
}

// ── Hook ─────────────────────────────────────────────────────────

export interface ConversationStore {
  conversations: ConversationRecord[];
  activeId: string | null;
  activeConversation: ConversationRecord | null;
  createConversation: () => string;
  appendMessage: (entry: ChatEntry) => void;
  switchConversation: (id: string) => void;
  clearActive: () => void;
  deleteConversation: (id: string) => void;
  initStore: () => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  conversations: [],
  activeId: null,
  activeConversation: null,

  initStore: () => {
    const stored = loadAll();
    const actId = stored.length > 0 ? stored[stored.length - 1].id : null;
    const actConv = stored.find(c => c.id === actId) ?? null;
    set({ conversations: stored, activeId: actId, activeConversation: actConv });
  },

  createConversation: () => {
    const newId = `conv-${Date.now().toString(36)}`;
    const newRecord: ConversationRecord = {
      id: newId,
      title: '新对话',
      preview: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    
    set((state) => {
      const updated = [...state.conversations, newRecord].slice(-MAX_CONVERSATIONS);
      saveAll(updated);
      return { 
        conversations: updated, 
        activeId: newId, 
        activeConversation: newRecord 
      };
    });
    
    return newId;
  },

  appendMessage: (entry) => {
    set((state) => {
      if (!state.activeId) return state;
      
      const updated = state.conversations.map((conv) => {
        if (conv.id !== state.activeId) return conv;

        const isFirst = conv.messages.length === 0 && entry.role === 'user';
        const newMessages = [...conv.messages, entry].slice(-MAX_MESSAGES_PER_CONV);

        return {
          ...conv,
          title: isFirst ? extractTitle(entry.content) : conv.title,
          preview: entry.content.slice(0, 48),
          updatedAt: Date.now(),
          messages: newMessages,
        };
      });
      
      saveAll(updated);
      return { 
        conversations: updated, 
        activeConversation: updated.find(c => c.id === state.activeId) ?? null 
      };
    });
  },

  switchConversation: (id) => {
    set((state) => ({ 
      activeId: id,
      activeConversation: state.conversations.find(c => c.id === id) ?? null
    }));
  },

  clearActive: () => {
    set((state) => {
      if (!state.activeId) return state;
      
      const updated = state.conversations.map((c) =>
        c.id === state.activeId ? { ...c, messages: [], preview: '', updatedAt: Date.now() } : c,
      );
      saveAll(updated);
      return { 
        conversations: updated,
        activeConversation: updated.find(c => c.id === state.activeId) ?? null
      };
    });
  },

  deleteConversation: (id) => {
    set((state) => {
      const updated = state.conversations.filter((c) => c.id !== id);
      saveAll(updated);
      const newActiveId = state.activeId === id ? null : state.activeId;
      return { 
        conversations: updated, 
        activeId: newActiveId,
        activeConversation: newActiveId ? (updated.find(c => c.id === newActiveId) ?? null) : null
      };
    });
  },
}));
