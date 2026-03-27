'use client';

import { useMemo } from 'react';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import { ExecutionProgressHeader } from '@/features/workflow/components/execution/ExecutionProgressHeader';
import { ExecutionTraceList } from '@/features/workflow/components/execution/ExecutionTraceList';

export default function ExecutionTraceDrawer() {
  const executionSession = useWorkflowStore((state) => state.executionSession);
  const clearExecutionSession = useWorkflowStore((state) => state.clearExecutionSession);
  const nodes = useWorkflowStore((state) => state.nodes);

  const nodeNameMap = useMemo(
    () => Object.fromEntries(
      nodes.map((node) => [node.id, String((node.data as { label?: string })?.label ?? node.id)]),
    ),
    [nodes],
  );

  if (!executionSession) {
    return null;
  }

  return (
    <aside className="fixed right-0 top-0 z-50 flex h-screen w-[420px] max-w-[90vw] animate-in slide-in-from-right-6 fade-in-0 flex-col border-l border-black/10 bg-background/95 shadow-2xl duration-200 backdrop-blur-md dark:border-white/10">
      <ExecutionProgressHeader session={executionSession} onClose={clearExecutionSession} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ExecutionTraceList session={executionSession} nodeNameMap={nodeNameMap} />
      </div>
    </aside>
  );
}
