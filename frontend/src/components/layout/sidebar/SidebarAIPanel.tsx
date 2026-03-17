'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import type { Edge, Node } from '@xyflow/react';

interface GenerateResponse {
  nodes: Node[];
  edges: Edge[];
  implicit_context: Record<string, unknown>;
}

interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function SidebarAIPanel() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { replaceWorkflowGraph, setGenerationContext, lastPrompt } = useWorkflowStore();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleGenerate = async () => {
    if (!input.trim() || loading) return;
    const userInput = input.trim();

    setHistory((prev) => [...prev, { role: 'user', content: userInput, timestamp: Date.now() }]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/generate-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_input: userInput }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `HTTP ${res.status}`);
      }

      const data: GenerateResponse = await res.json();
      replaceWorkflowGraph(data.nodes, data.edges);
      setGenerationContext(userInput, data.implicit_context);

      const nodeCount = data.nodes.length;
      setHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `已生成 ${nodeCount} 个工作流节点。`,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成失败，请重试';
      setError(message);
      setHistory((prev) => [
        ...prev,
        { role: 'assistant', content: `❌ ${message}`, timestamp: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Chat history */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-3">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">AI 工作流生成</p>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-[200px]">
              描述你的学习目标，AI 将自动生成对应的工作流节点。
            </p>
            {lastPrompt ? (
              <p className="mt-3 text-[11px] text-muted-foreground/70">
                上次: {lastPrompt.slice(0, 40)}{lastPrompt.length > 40 ? '...' : ''}
              </p>
            ) : null}
          </div>
        ) : (
          history.map((entry) => (
            <div
              key={entry.timestamp}
              className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                entry.role === 'user'
                  ? 'ml-4 bg-primary/15 text-foreground'
                  : 'mr-4 bg-muted/50 text-muted-foreground'
              }`}
            >
              {entry.content}
            </div>
          ))
        )}

        {loading && (
          <div className="mr-4 flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            生成中...
          </div>
        )}
      </div>

      {/* Input area */}
      {error && !loading ? (
        <p className="px-3 text-xs text-destructive">{error}</p>
      ) : null}

      <div className="shrink-0 border-t border-border p-3">
        <div className="flex gap-2">
          <textarea
            className="min-h-[40px] max-h-[120px] flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            placeholder="描述学习目标..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                void handleGenerate();
              }
            }}
            disabled={loading}
            rows={2}
          />
          <button
            onClick={() => void handleGenerate()}
            disabled={loading || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 self-end"
            title="生成工作流 (Ctrl+Enter)"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">Ctrl + Enter 快速生成</p>
      </div>
    </div>
  );
}
