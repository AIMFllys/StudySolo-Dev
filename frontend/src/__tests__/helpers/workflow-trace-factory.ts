import type { NodeExecutionTrace } from '@/types';

export function makeTrace(overrides: Partial<NodeExecutionTrace>): NodeExecutionTrace {
  return {
    nodeId: overrides.nodeId ?? 'node-1',
    nodeType: overrides.nodeType ?? 'summary',
    nodeName: overrides.nodeName ?? '节点 1',
    category: overrides.category ?? 'generation',
    status: overrides.status ?? 'pending',
    executionOrder: overrides.executionOrder ?? 1,
    isParallel: overrides.isParallel ?? false,
    streamingOutput: overrides.streamingOutput ?? '',
    ...overrides,
  };
}
