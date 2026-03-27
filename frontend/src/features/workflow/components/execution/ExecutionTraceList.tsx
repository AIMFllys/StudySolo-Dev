'use client';

import { useMemo } from 'react';
import type { NodeExecutionTrace, WorkflowExecutionSession } from '@/types';
import { TraceParallelGroup } from '@/features/workflow/components/execution/TraceParallelGroup';
import { TraceStepItem } from '@/features/workflow/components/execution/TraceStepItem';

interface ExecutionTraceListProps {
  session: WorkflowExecutionSession;
  nodeNameMap: Record<string, string>;
}

type TraceListItem =
  | { kind: 'single'; trace: NodeExecutionTrace }
  | { kind: 'parallel'; traces: NodeExecutionTrace[] };

export function ExecutionTraceList({ session, nodeNameMap }: ExecutionTraceListProps) {
  const items = useMemo<TraceListItem[]>(() => {
    const sorted = [...session.traces].sort((a, b) => a.executionOrder - b.executionOrder);
    const visited = new Set<string>();
    const nextItems: TraceListItem[] = [];

    for (const trace of sorted) {
      if (visited.has(trace.nodeId)) {
        continue;
      }

      if (trace.parallelGroupId) {
        const group = sorted.filter((item) => item.parallelGroupId === trace.parallelGroupId);
        if (group.length > 1) {
          group.forEach((item) => visited.add(item.nodeId));
          nextItems.push({ kind: 'parallel', traces: group });
          continue;
        }
      }

      visited.add(trace.nodeId);
      nextItems.push({ kind: 'single', trace });
    }

    return nextItems;
  }, [session.traces]);

  return (
    <div className="space-y-4 p-4">
      {items.map((item, index) => (
        item.kind === 'parallel'
          ? <TraceParallelGroup key={`parallel-${index}`} traces={item.traces} nodeNameMap={nodeNameMap} />
          : <TraceStepItem key={item.trace.nodeId} trace={item.trace} nodeNameMap={nodeNameMap} />
      ))}
    </div>
  );
}
