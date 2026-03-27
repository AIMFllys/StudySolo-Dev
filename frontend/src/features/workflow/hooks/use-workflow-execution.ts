'use client';

import { useCallback, useRef, useState } from 'react';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import type { WorkflowSSEEvent } from '@/types/workflow-events';
import {
  buildExecutionRequestBody,
  getExecutionFailureMessage,
  shouldFinalizeExecutionAsInterrupted,
} from '@/features/workflow/utils/execution-state';
import { extractSseEvents } from '@/features/workflow/utils/parse-sse';
import { buildParallelGroupId, parseInputSummary } from '@/features/workflow/utils/trace-helpers';

export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'error';

export function useWorkflowExecution() {
  const [status, setStatus] = useState<ExecutionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeMapRef = useRef<Record<string, number>>({});
  const traceOrderRef = useRef(1);

  const currentWorkflowId = useWorkflowStore((state) => state.currentWorkflowId);
  const currentWorkflowName = useWorkflowStore((state) => state.currentWorkflowName);
  const setSelectedNodeId = useWorkflowStore((state) => state.setSelectedNodeId);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const startExecutionSession = useWorkflowStore((state) => state.startExecutionSession);
  const registerNodeTrace = useWorkflowStore((state) => state.registerNodeTrace);
  const updateNodeTrace = useWorkflowStore((state) => state.updateNodeTrace);
  const appendNodeTraceToken = useWorkflowStore((state) => state.appendNodeTraceToken);
  const finalizeExecutionSession = useWorkflowStore((state) => state.finalizeExecutionSession);
  const clearExecutionSession = useWorkflowStore((state) => state.clearExecutionSession);

  const resetTrackingState = useCallback(() => {
    startTimeMapRef.current = {};
    traceOrderRef.current = 1;
  }, []);

  const closeStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const finishWithError = useCallback((message: string) => {
    setStatus('error');
    setError(message);
    finalizeExecutionSession('error');
    closeStream();
    resetTrackingState();
  }, [closeStream, finalizeExecutionSession, resetTrackingState]);

  const stop = useCallback(() => {
    finishWithError('执行流已中断，请手动重新运行');
  }, [finishWithError]);

  const start = useCallback(
    async (workflowId?: string) => {
      const id = workflowId ?? currentWorkflowId;
      if (!id) return;

      const snapshot = useWorkflowStore.getState();
      const workflowName = snapshot.currentWorkflowName ?? currentWorkflowName ?? id;
      const nodes = snapshot.nodes;
      const edges = snapshot.edges;

      closeStream();
      resetTrackingState();
      setStatus('running');
      setError(null);
      clearExecutionSession();
      startExecutionSession(id, workflowName);
      window.dispatchEvent(new Event('workflow:close-node-config'));

      const controller = new AbortController();
      abortControllerRef.current = controller;
      let didComplete = false;

      const handleEvent = (event: string, payload: string) => {
        try {
          if (event === 'node_input') {
            const data = JSON.parse(payload) as Extract<WorkflowSSEEvent, { type: 'node_input' }>;
            startTimeMapRef.current[data.node_id] = performance.now();
            const session = useWorkflowStore.getState().executionSession;
            const runningNodeIds = (session?.traces ?? [])
              .filter((trace) => trace.status === 'running' && trace.nodeId !== data.node_id)
              .map((trace) => trace.nodeId);
            const parallelGroupId = runningNodeIds.length > 0
              ? buildParallelGroupId([...runningNodeIds, data.node_id])
              : undefined;

            if (parallelGroupId) {
              for (const runningNodeId of runningNodeIds) {
                updateNodeTrace(runningNodeId, {
                  isParallel: true,
                  parallelGroupId,
                });
              }
            }

            registerNodeTrace(
              data.node_id,
              traceOrderRef.current++,
              Boolean(parallelGroupId),
              parallelGroupId,
            );
            updateNodeData(data.node_id, {
              input_snapshot: data.input_snapshot,
            });
            updateNodeTrace(data.node_id, {
              status: 'running',
              startedAt: performance.now(),
              inputSummary: parseInputSummary(data.input_snapshot),
              rawInputSnapshot: data.input_snapshot,
            });
            return;
          }

          if (event === 'node_status') {
            const data = JSON.parse(payload) as Extract<WorkflowSSEEvent, { type: 'node_status' }>;
            setSelectedNodeId(data.node_id);

            const updates: Parameters<typeof updateNodeData>[1] = {
              status: data.status,
              ...(data.error ? { error: data.error } : {}),
            };

            if (data.status === 'running') {
              if (!startTimeMapRef.current[data.node_id]) {
                startTimeMapRef.current[data.node_id] = performance.now();
              }
            } else if (data.status === 'done' || data.status === 'error') {
              const startT = startTimeMapRef.current[data.node_id];
              if (startT) {
                updates.execution_time_ms = Math.round(performance.now() - startT);
                delete startTimeMapRef.current[data.node_id];
              }
            }

            updateNodeData(data.node_id, updates);
            if (data.status !== 'running') {
              updateNodeTrace(data.node_id, {
                status: data.status,
                errorMessage: data.error,
                durationMs: typeof updates.execution_time_ms === 'number' ? updates.execution_time_ms : undefined,
                finishedAt: data.status === 'done' || data.status === 'error'
                  ? performance.now()
                  : undefined,
              });
            }
            return;
          }

          if (event === 'node_token') {
            const data = JSON.parse(payload) as Extract<WorkflowSSEEvent, { type: 'node_token' }>;
            setSelectedNodeId(data.node_id);
            updateNodeData(data.node_id, (prev) => ({
              output: (prev.output ?? '') + data.token,
            }));
            appendNodeTraceToken(data.node_id, data.token);
            return;
          }

          if (event === 'node_done') {
            const data = JSON.parse(payload) as Extract<WorkflowSSEEvent, { type: 'node_done' }>;
            setSelectedNodeId(data.node_id);
            updateNodeData(data.node_id, {
              output: data.full_output,
              status: 'done',
            });
            updateNodeTrace(data.node_id, {
              status: 'done',
              finalOutput: data.full_output,
            });
            return;
          }

          if (event === 'loop_iteration') {
            const data = JSON.parse(payload) as Extract<WorkflowSSEEvent, { type: 'loop_iteration' }>;
            setSelectedNodeId(data.group_id);
            updateNodeData(data.group_id, {
              currentIteration: data.iteration,
              totalIterations: data.total,
              status: 'running',
            });
            return;
          }

          if (event === 'save_error') {
            const data = JSON.parse(payload) as Extract<WorkflowSSEEvent, { type: 'save_error' }>;
            setError(data.error);
            return;
          }

          if (event === 'workflow_done') {
            const data = JSON.parse(payload) as Extract<WorkflowSSEEvent, { type: 'workflow_done' }>;
            didComplete = true;
            const nextStatus = data.status === 'completed' ? 'completed' : 'error';
            setStatus(nextStatus);
            setError(data.status === 'completed' ? null : (data.error ?? '工作流执行失败'));
            finalizeExecutionSession(nextStatus);
            closeStream();
            resetTrackingState();
          }
        } catch {
          // Ignore malformed SSE payloads.
        }
      };

      try {
        const response = await fetch(`/api/workflow/${id}/execute`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildExecutionRequestBody(nodes, edges)),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error('EMPTY_STREAM');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const parsed = extractSseEvents(buffer);
          buffer = parsed.remainder;

          for (const event of parsed.events) {
            handleEvent(event.event, event.data);
          }
        }

        buffer += decoder.decode();
        const parsed = extractSseEvents(buffer);
        for (const event of parsed.events) {
          handleEvent(event.event, event.data);
        }

        if (shouldFinalizeExecutionAsInterrupted(didComplete, controller.signal.aborted)) {
          finishWithError('执行流异常中断，请手动重新运行');
        }
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        finishWithError(getExecutionFailureMessage(caught));
      }
    },
    [
      appendNodeTraceToken,
      clearExecutionSession,
      closeStream,
      currentWorkflowId,
      currentWorkflowName,
      finishWithError,
      finalizeExecutionSession,
      registerNodeTrace,
      resetTrackingState,
      setSelectedNodeId,
      startExecutionSession,
      updateNodeData,
      updateNodeTrace,
    ]
  );

  return { status, error, start, stop };
}
