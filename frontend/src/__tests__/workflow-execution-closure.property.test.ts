import { describe, expect, it } from 'vitest';
import type { NodeExecutionTrace, WorkflowChain } from '@/types';
import {
  buildExecutionRequestBody,
  getExecutionFailureMessage,
  shouldFinalizeExecutionAsInterrupted,
} from '@/features/workflow/utils/execution-state';
import {
  buildLoopGroupConfigPatch,
  buildMergedConfigPatch,
} from '@/features/workflow/components/node-config/config-patch';
import {
  buildTraceListItems,
  filterTracesByChain,
  shouldShowChainTabs,
} from '@/features/workflow/components/execution/trace-list-utils';

function makeTrace(overrides: Partial<NodeExecutionTrace>): NodeExecutionTrace {
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

describe('workflow execution closure helpers', () => {
  it('builds POST execution payload from in-memory graph', () => {
    const body = buildExecutionRequestBody(
      [{ id: 'n1' }] as never[],
      [{ id: 'e1' }] as never[],
    );

    expect(body).toEqual({
      nodes_json: [{ id: 'n1' }],
      edges_json: [{ id: 'e1' }],
    });
  });

  it('maps execution errors to stable user-facing messages', () => {
    expect(getExecutionFailureMessage(new Error('HTTP 403'))).toBe('启动执行失败：HTTP 403');
    expect(getExecutionFailureMessage(new Error('boom'))).toBe('执行流异常中断，请手动重新运行');
    expect(getExecutionFailureMessage('bad')).toBe('执行流异常中断，请手动重新运行');
  });

  it('marks interrupted execution only when stream did not complete and was not aborted', () => {
    expect(shouldFinalizeExecutionAsInterrupted(false, false)).toBe(true);
    expect(shouldFinalizeExecutionAsInterrupted(true, false)).toBe(false);
    expect(shouldFinalizeExecutionAsInterrupted(false, true)).toBe(false);
  });

  it('builds config patches for generic nodes and loop groups', () => {
    expect(buildMergedConfigPatch({ temperature: 0.7 }, { maxTokens: 2048 })).toEqual({
      temperature: 0.7,
      maxTokens: 2048,
    });
    expect(buildMergedConfigPatch({ temperature: 0.7 }, { maxTokens: 2048 }, true)).toEqual({
      maxTokens: 2048,
    });
    expect(buildLoopGroupConfigPatch({
      maxIterations: 5,
      intervalSeconds: 2,
      description: '批处理',
      ignored: true,
    })).toEqual({
      maxIterations: 5,
      intervalSeconds: 2,
      description: '批处理',
    });
  });

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
