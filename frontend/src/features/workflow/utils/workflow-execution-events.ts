import type { WorkflowSSEEvent } from '@/types/workflow-events';
import type { WorkflowExecutionSession } from '@/types/workflow';
import { parseInputSummary } from '@/features/workflow/utils/trace-helpers';

type ExecutionTerminalStatus = 'completed' | 'error';
type WorkflowNodeDataUpdate =
  | Partial<Record<string, unknown>>
  | ((prev: Record<string, unknown>) => Partial<Record<string, unknown>>);

interface WorkflowExecutionEventDeps {
  getExecutionSession: () => WorkflowExecutionSession | null;
  now: () => number;
  nextTraceOrder: () => number;
  startTimeMap: Record<string, number>;
  setStatus: (status: ExecutionTerminalStatus) => void;
  setError: (error: string | null) => void;
  setSelectedNodeId: (nodeId: string) => void;
  updateNodeData: (nodeId: string, update: WorkflowNodeDataUpdate) => void;
  registerNodeTrace: (
    nodeId: string,
    executionOrder: number,
    isParallel: boolean,
    parallelGroupId?: string,
  ) => void;
  updateNodeTrace: (nodeId: string, updates: Record<string, unknown>) => void;
  appendNodeTraceToken: (nodeId: string, token: string) => void;
  updateExecutionSessionMeta: (updates: Partial<WorkflowExecutionSession>) => void;
  finalizeExecutionSession: (status: ExecutionTerminalStatus) => void;
  closeStream: () => void;
  resetTrackingState: () => void;
}

export function applyWorkflowExecutionEvent(
  event: string,
  payload: string,
  deps: WorkflowExecutionEventDeps,
): boolean {
  try {
    const eventTime = deps.now();
    deps.updateExecutionSessionMeta({ lastActivityAt: eventTime });

    if (event === 'node_input') {
      const data = JSON.parse(payload) as Extract<WorkflowSSEEvent, { type: 'node_input' }>;
      deps.startTimeMap[data.node_id] = deps.now();
      deps.registerNodeTrace(
        data.node_id,
        deps.nextTraceOrder(),
        Boolean(data.parallel_group_id),
        data.parallel_group_id,
      );
      deps.updateNodeData(data.node_id, {
        input_snapshot: data.input_snapshot,
      });
      deps.updateNodeTrace(data.node_id, {
        status: 'running',
        startedAt: eventTime,
        inputSummary: parseInputSummary(data.input_snapshot),
        rawInputSnapshot: data.input_snapshot,
        isParallel: Boolean(data.parallel_group_id),
        parallelGroupId: data.parallel_group_id,
        loopGroupId: data.loop_group_id,
        iteration: data.iteration,
        phase: data.phase,
        progressMessage: undefined,
        lastActivityAt: eventTime,
      });
      return false;
    }

    if (event === 'node_status') {
      const data = JSON.parse(payload) as Extract<WorkflowSSEEvent, { type: 'node_status' }>;
      deps.setSelectedNodeId(data.node_id);

      const updates: Record<string, unknown> = {
        status: data.status,
        ...(data.error ? { error: data.error } : {}),
        ...(data.phase ? { phase: data.phase } : {}),
        ...(data.iteration ? { currentIteration: data.iteration } : {}),
      };

      if (data.status === 'running') {
        if (!deps.startTimeMap[data.node_id]) {
          deps.startTimeMap[data.node_id] = eventTime;
        }
      } else if (data.status === 'done' || data.status === 'error' || data.status === 'skipped') {
        const startT = deps.startTimeMap[data.node_id];
        if (startT) {
          updates.execution_time_ms = Math.round(eventTime - startT);
          delete deps.startTimeMap[data.node_id];
        }
      }

      deps.updateNodeData(data.node_id, updates);
      if (data.status !== 'running') {
        deps.updateNodeTrace(data.node_id, {
          status: data.status,
          errorMessage: data.error,
          isParallel: Boolean(data.parallel_group_id),
          parallelGroupId: data.parallel_group_id,
          loopGroupId: data.loop_group_id,
          iteration: data.iteration,
          phase: data.phase,
          durationMs: typeof updates.execution_time_ms === 'number' ? updates.execution_time_ms : undefined,
          finishedAt: data.status === 'done' || data.status === 'error' || data.status === 'skipped'
            ? eventTime
            : undefined,
          lastActivityAt: eventTime,
        });
      }
      return false;
    }

    if (event === 'node_token') {
      const data = JSON.parse(payload) as Extract<WorkflowSSEEvent, { type: 'node_token' }>;
      deps.setSelectedNodeId(data.node_id);
      deps.updateNodeData(data.node_id, (prev: { output?: string | null }) => ({
        output: (prev.output ?? '') + data.token,
      }));
      deps.appendNodeTraceToken(data.node_id, data.token);
      deps.updateNodeTrace(data.node_id, {
        isParallel: Boolean(data.parallel_group_id),
        parallelGroupId: data.parallel_group_id,
        loopGroupId: data.loop_group_id,
        iteration: data.iteration,
        phase: data.phase,
        lastActivityAt: eventTime,
      });
      return false;
    }

    if (event === 'node_done') {
      const data = JSON.parse(payload) as Extract<WorkflowSSEEvent, { type: 'node_done' }>;
      const resolvedModelRoute =
        typeof data.metadata?.resolved_model_route === 'string'
          ? data.metadata.resolved_model_route
          : undefined;
      deps.setSelectedNodeId(data.node_id);
      deps.updateNodeData(data.node_id, {
        output: data.full_output,
        status: 'done',
      });
      deps.updateNodeTrace(data.node_id, {
        status: 'done',
        finalOutput: data.full_output,
        progressMessage: undefined,
        isParallel: Boolean(data.parallel_group_id),
        parallelGroupId: data.parallel_group_id,
        loopGroupId: data.loop_group_id,
        iteration: data.iteration,
        phase: data.phase,
        modelRoute: resolvedModelRoute,
        lastActivityAt: eventTime,
      });
      return false;
    }

    if (event === 'node_progress') {
      const data = JSON.parse(payload) as Extract<WorkflowSSEEvent, { type: 'node_progress' }>;
      deps.setSelectedNodeId(data.node_id);
      deps.updateNodeTrace(data.node_id, {
        status: 'running',
        progressMessage: data.message,
        isParallel: Boolean(data.parallel_group_id),
        parallelGroupId: data.parallel_group_id,
        loopGroupId: data.loop_group_id,
        iteration: data.iteration,
        phase: data.phase,
        lastActivityAt: eventTime,
      });
      deps.updateExecutionSessionMeta({ lastActivityAt: eventTime });
      return false;
    }

    if (event === 'loop_iteration') {
      const data = JSON.parse(payload) as Extract<WorkflowSSEEvent, { type: 'loop_iteration' }>;
      deps.setSelectedNodeId(data.group_id);
      deps.updateNodeData(data.group_id, {
        currentIteration: data.iteration,
        totalIterations: data.total,
        status: 'running',
      });
      deps.updateNodeTrace(data.group_id, {
        status: 'running',
        loopGroupId: data.loop_group_id ?? data.group_id,
        iteration: data.iteration,
        progressMessage: `正在执行第 ${data.iteration}/${data.total} 轮循环`,
        lastActivityAt: eventTime,
      });
      return false;
    }

    if (event === 'workflow_status') {
      const data = JSON.parse(payload) as Extract<WorkflowSSEEvent, { type: 'workflow_status' }>;
      deps.updateExecutionSessionMeta({
        phase: data.phase,
        phaseMessage: data.message,
        lastActivityAt: eventTime,
      });
      return false;
    }

    if (event === 'heartbeat') {
      const data = JSON.parse(payload) as Extract<WorkflowSSEEvent, { type: 'heartbeat' }>;
      deps.updateExecutionSessionMeta({
        phase: data.phase,
        lastActivityAt: eventTime,
      });
      return false;
    }

    if (event === 'save_error') {
      const data = JSON.parse(payload) as Extract<WorkflowSSEEvent, { type: 'save_error' }>;
      deps.setError(data.error);
      return false;
    }

    if (event === 'workflow_done') {
      const data = JSON.parse(payload) as Extract<WorkflowSSEEvent, { type: 'workflow_done' }>;
      const nextStatus = data.status === 'completed' ? 'completed' : 'error';
      deps.setStatus(nextStatus);
      deps.setError(data.status === 'completed' ? null : (data.error ?? '工作流执行失败'));
      deps.updateExecutionSessionMeta({
        phase: nextStatus,
        phaseMessage: data.status === 'completed' ? '执行完成' : (data.error ?? '工作流执行失败'),
        lastActivityAt: eventTime,
      });
      deps.finalizeExecutionSession(nextStatus);
      deps.closeStream();
      deps.resetTrackingState();
      return true;
    }
  } catch {
    return false;
  }

  return false;
}
