'use client';

import { useState } from 'react';
import { authedFetch } from '@/services/api-client';
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';
import type { Edge, Node } from '@xyflow/react';

interface GenerateResponse {
  nodes: Node[];
  edges: Edge[];
  implicit_context: Record<string, unknown>;
}

export default function WorkflowPromptInput() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replaceWorkflowGraph = useWorkflowStore((state) => state.replaceWorkflowGraph);
  const setGenerationContext = useWorkflowStore((state) => state.setGenerationContext);

  const handleGenerate = async () => {
    if (!input.trim() || loading) return;

    setLoading(true);
    setError(null);

    // Show generating loader node on the canvas while waiting
    replaceWorkflowGraph(
      [{
        id: 'generating-node',
        position: { x: 300, y: 200 },
        type: 'generating',
        data: {},
      }],
      []
    );

    try {
      const res = await fetch('/api/ai/generate-workflow', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_input: input.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `HTTP ${res.status}`);
      }

      const data: GenerateResponse = await res.json();
      replaceWorkflowGraph(data.nodes, data.edges);
      setGenerationContext(input.trim(), data.implicit_context);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-background p-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <textarea
          className="min-h-[60px] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="描述你的学习目标，例如：学习 React Hooks 的知识体系"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleGenerate();
            }
          }}
          disabled={loading}
          aria-label="学习目标输入"
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !input.trim()}
          className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="生成工作流"
        >
          {loading ? '生成中...' : '生成工作流'}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Ctrl + Enter 快速生成</p>
    </div>
  );
}
