'use client';

import { useWorkflowExecution } from '@/hooks/use-workflow-execution';
import { useWorkflowStore } from '@/stores/use-workflow-store';

export default function RunButton() {
  const { status, start, stop } = useWorkflowExecution();
  const nodes = useWorkflowStore((s) => s.nodes);
  const hasNodes = nodes.length > 0;

  if (status === 'running') {
    return (
      <button
        onClick={stop}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-destructive bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 transition-colors"
      >
        ⏹ 停止
      </button>
    );
  }

  return (
    <button
      onClick={() => start()}
      disabled={!hasNodes}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 shadow-glow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
    >
      ▶ 运行全部
    </button>
  );
}
