'use client';

import type { NodeExecutionTrace } from '@/types';
import { TraceStepItem } from '@/features/workflow/components/execution/TraceStepItem';

interface TraceParallelGroupProps {
  traces: NodeExecutionTrace[];
  nodeNameMap: Record<string, string>;
}

export function TraceParallelGroup({ traces, nodeNameMap }: TraceParallelGroupProps) {
  return (
    <div className="rounded-lg border border-dashed border-primary/20 bg-primary/5 p-3">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-primary/70">并行执行组</div>
      <div className="space-y-3">
        {traces.map((trace) => (
          <TraceStepItem key={trace.nodeId} trace={trace} nodeNameMap={nodeNameMap} />
        ))}
      </div>
    </div>
  );
}
