'use client';

import { useState } from 'react';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import type { Node, Edge } from '@xyflow/react';

interface GenerateResponse {
  nodes: Node[];
  edges: Edge[];
  implicit_context: Record<string, unknown>;
}

export default function WorkflowPromptInput() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { currentWorkflowId, setNodes, setEdges } = useWorkflowStore();

  const handleGenerate = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/generate-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_input: input.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `HTTP ${res.status}`);
      }

      const data: GenerateResponse = await res.json();
      setNodes(data.nodes);
      setEdges(data.edges);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 border-t border-border bg-background">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <div className="flex gap-2">
        <textarea
          className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[60px]"
          placeholder="描述你的学习目标，例如：学习 React Hooks 的知识体系…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate();
          }}
          disabled={loading}
          aria-label="学习目标输入"
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !input.trim()}
          className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="生成工作流"
        >
          {loading ? '生成中…' : '生成工作流'}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">⌘ + Enter 快速生成</p>
    </div>
  );
}
