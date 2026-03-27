import type { NodeExecutionTrace, WorkflowChain } from '@/types';

export type TraceListItem =
  | { kind: 'single'; trace: NodeExecutionTrace }
  | { kind: 'parallel'; traces: NodeExecutionTrace[] };

export function shouldShowChainTabs(chains?: WorkflowChain[]) {
  return (chains?.length ?? 0) > 1;
}

export function filterTracesByChain(
  traces: NodeExecutionTrace[],
  activeChainId: number | null,
) {
  if (activeChainId === null) {
    return traces;
  }

  return traces.filter((trace) => trace.chainIds?.includes(activeChainId));
}

export function buildTraceListItems(traces: NodeExecutionTrace[]): TraceListItem[] {
  const sorted = [...traces].sort((a, b) => a.executionOrder - b.executionOrder);
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
}
