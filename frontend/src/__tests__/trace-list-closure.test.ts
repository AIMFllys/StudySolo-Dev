import { describe, expect, it } from 'vitest';
import type { WorkflowChain } from '@/types';
import {
  buildTraceListItems,
  filterTracesByChain,
  shouldShowChainTabs,
} from '@/features/workflow/components/execution/trace-list-utils';
import { makeTrace } from './helpers/workflow-trace-factory';

describe('trace list closure helpers', () => {
  it('filters traces by chain and hides tabs when only one chain exists', () => {
    const traces = [
      makeTrace({ nodeId: 'start', chainIds: [1, 2], executionOrder: 1 }),
      makeTrace({ nodeId: 'a', chainIds: [1], executionOrder: 2 }),
      makeTrace({ nodeId: 'b', chainIds: [2], executionOrder: 3 }),
    ];
    const chains: WorkflowChain[] = [
      { chainId: 1, label: '线路 1', nodeIds: ['start', 'a'] },
      { chainId: 2, label: '线路 2', nodeIds: ['start', 'b'] },
    ];

    expect(filterTracesByChain(traces, null).map((trace) => trace.nodeId)).toEqual(['start', 'a', 'b']);
    expect(filterTracesByChain(traces, 1).map((trace) => trace.nodeId)).toEqual(['start', 'a']);
    expect(shouldShowChainTabs(chains)).toBe(true);
    expect(shouldShowChainTabs([chains[0]])).toBe(false);
  });

  it('groups filtered traces without duplicating parallel entries', () => {
    const traces = [
      makeTrace({ nodeId: 'n1', executionOrder: 1, parallelGroupId: 'p1' }),
      makeTrace({ nodeId: 'n2', executionOrder: 2, parallelGroupId: 'p1' }),
      makeTrace({ nodeId: 'n3', executionOrder: 3 }),
    ];

    expect(buildTraceListItems(traces)).toEqual([
      { kind: 'parallel', traces: [traces[0], traces[1]] },
      { kind: 'single', trace: traces[2] },
    ]);
  });
});
