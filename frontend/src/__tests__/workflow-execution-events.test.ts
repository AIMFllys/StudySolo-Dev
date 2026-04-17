import { describe, expect, it } from 'vitest';
import type { WorkflowExecutionSession } from '@/types';
import { applyWorkflowExecutionEvent } from '@/features/workflow/utils/workflow-execution-events';
import { makeTrace } from './helpers/workflow-trace-factory';

describe('workflow execution event application', () => {
  it('applies node_input events with parallel metadata and input summary', () => {
    const updateNodeTraceCalls: Array<{ nodeId: string; updates: Record<string, unknown> }> = [];
    const registerCalls: Array<{ nodeId: string; executionOrder: number; isParallel?: boolean; parallelGroupId?: string }> = [];
    const nodeDataState: Record<string, Record<string, unknown>> = {};
    const sessionMetaUpdates: Array<Record<string, unknown>> = [];
    const parallelGroupId = 'existing|new-node';

    const didComplete = applyWorkflowExecutionEvent(
      'node_input',
      JSON.stringify({
        type: 'node_input',
        node_id: 'new-node',
        parallel_group_id: parallelGroupId,
        input_snapshot: JSON.stringify({
          topic: '工作流',
          section_text: '执行面板重构',
        }),
      }),
      {
        getExecutionSession: () => ({
          sessionId: 'session-1',
          workflowId: 'wf-1',
          workflowName: '执行测试',
          startedAt: 0,
          overallStatus: 'running',
          traces: [makeTrace({ nodeId: 'existing', status: 'running', parallelGroupId })],
          completedCount: 0,
          totalCount: 1,
          chains: [],
        }),
        now: () => 120,
        nextTraceOrder: () => 1,
        startTimeMap: {},
        setStatus: () => {},
        setError: () => {},
        setSelectedNodeId: () => {},
        updateNodeData: (nodeId, update) => {
          nodeDataState[nodeId] = { ...(nodeDataState[nodeId] ?? {}), ...(update as Record<string, unknown>) };
        },
        registerNodeTrace: (nodeId, executionOrder, isParallel, parallelGroupId) => {
          registerCalls.push({ nodeId, executionOrder, isParallel, parallelGroupId });
        },
        updateNodeTrace: (nodeId, updates) => {
          updateNodeTraceCalls.push({ nodeId, updates });
        },
        appendNodeTraceToken: () => {},
        updateExecutionSessionMeta: (updates: Partial<WorkflowExecutionSession>) => {
          sessionMetaUpdates.push(updates as Record<string, unknown>);
        },
        finalizeExecutionSession: () => {},
        closeStream: () => {},
        resetTrackingState: () => {},
      },
    );

    expect(didComplete).toBe(false);
    expect(registerCalls).toHaveLength(1);
    expect(registerCalls[0].nodeId).toBe('new-node');
    expect(registerCalls[0].executionOrder).toBe(1);
    expect(registerCalls[0].isParallel).toBe(true);
    expect(registerCalls[0].parallelGroupId).toBe(parallelGroupId);
    expect(updateNodeTraceCalls[0].nodeId).toBe('new-node');
    expect(updateNodeTraceCalls[0].updates).toMatchObject({
      status: 'running',
      inputSummary: '',
      rawInputSnapshot: JSON.stringify({
        topic: '工作流',
        section_text: '执行面板重构',
      }),
      isParallel: true,
      parallelGroupId,
    });
    expect(nodeDataState['new-node']).toEqual({
      input_snapshot: JSON.stringify({
        topic: '工作流',
        section_text: '执行面板重构',
      }),
    });
    expect(sessionMetaUpdates[0]).toMatchObject({ lastActivityAt: 120 });
  });

  it('applies token, status, node_done and workflow_done events through one execution flow', () => {
    const nodeDataState: Record<string, Record<string, unknown>> = {
      node: { output: '前缀' },
    };
    const selectedNodeIds: string[] = [];
    const traceUpdates: Array<{ nodeId: string; updates: Record<string, unknown> }> = [];
    const traceTokens: string[] = [];
    const terminalStatuses: string[] = [];
    const errors: Array<string | null> = [];
    const sessionMetaUpdates: Array<Record<string, unknown>> = [];
    let now = 130;
    const startTimeMap: Record<string, number> = { node: 100 };
    let closed = 0;
    let reset = 0;

    const deps = {
      getExecutionSession: () => null,
      now: () => now,
      nextTraceOrder: () => 1,
      startTimeMap,
      setStatus: (status: 'completed' | 'error') => {
        terminalStatuses.push(status);
      },
      setError: (error: string | null) => {
        errors.push(error);
      },
      setSelectedNodeId: (nodeId: string) => {
        selectedNodeIds.push(nodeId);
      },
      updateNodeData: (nodeId: string, update: unknown) => {
        const next = typeof update === 'function'
          ? (update as (prev: Record<string, unknown>) => Record<string, unknown>)(nodeDataState[nodeId] ?? {})
          : (update as Record<string, unknown>);
        nodeDataState[nodeId] = { ...(nodeDataState[nodeId] ?? {}), ...next };
      },
      registerNodeTrace: () => {},
      updateNodeTrace: (nodeId: string, updates: Record<string, unknown>) => {
        traceUpdates.push({ nodeId, updates });
      },
      appendNodeTraceToken: (_nodeId: string, token: string) => {
        traceTokens.push(token);
      },
      updateExecutionSessionMeta: (updates: Partial<WorkflowExecutionSession>) => {
        sessionMetaUpdates.push(updates as Record<string, unknown>);
      },
      finalizeExecutionSession: (status: 'completed' | 'error') => {
        terminalStatuses.push(`final:${status}`);
      },
      closeStream: () => { closed += 1; },
      resetTrackingState: () => { reset += 1; },
    };

    expect(applyWorkflowExecutionEvent(
      'node_token',
      JSON.stringify({ type: 'node_token', node_id: 'node', token: ' 输出' }),
      deps,
    )).toBe(false);
    expect(nodeDataState.node.output).toBe('前缀 输出');
    expect(traceTokens).toEqual([' 输出']);

    now = 145;
    expect(applyWorkflowExecutionEvent(
      'node_status',
      JSON.stringify({ type: 'node_status', node_id: 'node', status: 'done' }),
      deps,
    )).toBe(false);
    expect(nodeDataState.node.status).toBe('done');
    expect(nodeDataState.node.execution_time_ms).toBe(45);
    expect(startTimeMap.node).toBeUndefined();

    expect(applyWorkflowExecutionEvent(
      'node_done',
      JSON.stringify({ type: 'node_done', node_id: 'node', full_output: '最终输出' }),
      deps,
    )).toBe(false);
    expect(nodeDataState.node.output).toBe('最终输出');

    const completed = applyWorkflowExecutionEvent(
      'workflow_done',
      JSON.stringify({ type: 'workflow_done', status: 'completed' }),
      deps,
    );

    expect(completed).toBe(true);
    expect(selectedNodeIds).toEqual(['node', 'node', 'node']);
    expect(traceUpdates).toHaveLength(3);
    expect(traceUpdates[0]).toMatchObject({ nodeId: 'node', updates: { lastActivityAt: 130 } });
    expect(traceUpdates[1]).toMatchObject({
      nodeId: 'node',
      updates: { status: 'done', errorMessage: undefined, durationMs: 45, finishedAt: 145, lastActivityAt: 145 },
    });
    expect(traceUpdates[2]).toMatchObject({
      nodeId: 'node',
      updates: { status: 'done', finalOutput: '最终输出', progressMessage: undefined, lastActivityAt: 145 },
    });
    expect(terminalStatuses).toEqual(['completed', 'final:completed']);
    expect(errors).toEqual([null]);
    expect(closed).toBe(1);
    expect(reset).toBe(1);
    expect(sessionMetaUpdates.at(-1)).toMatchObject({ phase: 'completed', phaseMessage: '执行完成' });
  });

  it('updates session phase and trace progress for workflow_status, node_progress and heartbeat', () => {
    const traceUpdates: Array<{ nodeId: string; updates: Record<string, unknown> }> = [];
    const sessionMetaUpdates: Array<Record<string, unknown>> = [];

    const deps = {
      getExecutionSession: () => ({
        sessionId: 'session-1',
        workflowId: 'wf-1',
        workflowName: '测试工作流',
        startedAt: 0,
        overallStatus: 'running' as const,
        traces: [makeTrace({ nodeId: 'node-1', status: 'running' })],
        completedCount: 0,
        totalCount: 1,
        chains: [],
      }),
      now: () => 88,
      nextTraceOrder: () => 1,
      startTimeMap: {},
      setStatus: () => {},
      setError: () => {},
      setSelectedNodeId: () => {},
      updateNodeData: () => {},
      registerNodeTrace: () => {},
      updateNodeTrace: (nodeId: string, updates: Record<string, unknown>) => {
        traceUpdates.push({ nodeId, updates });
      },
      appendNodeTraceToken: () => {},
      updateExecutionSessionMeta: (updates: Partial<WorkflowExecutionSession>) => {
        sessionMetaUpdates.push(updates as Record<string, unknown>);
      },
      finalizeExecutionSession: () => {},
      closeStream: () => {},
      resetTrackingState: () => {},
    };

    expect(applyWorkflowExecutionEvent(
      'workflow_status',
      JSON.stringify({ type: 'workflow_status', workflow_id: 'wf-1', phase: 'validating', message: '正在校验执行图' }),
      deps,
    )).toBe(false);
    expect(applyWorkflowExecutionEvent(
      'node_progress',
      JSON.stringify({
        type: 'node_progress',
        node_id: 'node-1',
        message: '正在联网搜索',
        phase: 'start',
        parallel_group_id: 'node-1|node-2',
        iteration: 2,
      }),
      deps,
    )).toBe(false);
    expect(applyWorkflowExecutionEvent(
      'heartbeat',
      JSON.stringify({ type: 'heartbeat', workflow_id: 'wf-1', phase: 'executing', ts: '2026-03-30T10:00:00Z' }),
      deps,
    )).toBe(false);

    expect(sessionMetaUpdates[0]).toMatchObject({ lastActivityAt: 88 });
    expect(sessionMetaUpdates[1]).toMatchObject({
      phase: 'validating',
      phaseMessage: '正在校验执行图',
      lastActivityAt: 88,
    });
    expect(traceUpdates[0]).toMatchObject({
      nodeId: 'node-1',
      updates: { status: 'running', progressMessage: '正在联网搜索', parallelGroupId: 'node-1|node-2', iteration: 2 },
    });
    expect(sessionMetaUpdates.at(-1)).toMatchObject({ phase: 'executing', lastActivityAt: 88 });
  });
});
