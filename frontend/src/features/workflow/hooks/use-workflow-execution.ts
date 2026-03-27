'use client';

import { useCallback, useRef, useState } from 'react';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import type { WorkflowSSEEvent } from '@/types/workflow-events';
import { buildParallelGroupId, parseInputSummary } from '@/features/workflow/utils/trace-helpers';

export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'error';

const MAX_RECONNECT_ATTEMPTS = 3;

export function useWorkflowExecution() {
  const [status, setStatus] = useState<ExecutionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const reconnectCountRef = useRef(0);
  const startTimeMapRef = useRef<Record<string, number>>({});
  const traceOrderRef = useRef(1);

  const {
    currentWorkflowId,
    setSelectedNodeId,
    updateNodeData,
    startExecutionSession,
    registerNodeTrace,
    updateNodeTrace,
    appendNodeTraceToken,
    finalizeExecutionSession,
    clearExecutionSession,
  } = useWorkflowStore();

  const stop = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    reconnectCountRef.current = 0;
    startTimeMapRef.current = {};
    traceOrderRef.current = 1;
  }, []);

  const start = useCallback(
    (workflowId?: string) => {
      const id = workflowId ?? currentWorkflowId;
      if (!id) return;

      stop();
      setStatus('running');
      setError(null);
      clearExecutionSession();
      startExecutionSession(id);

      // Pause cloud sync during execution to avoid race condition
      window.dispatchEvent(new Event('workflow:execution-start'));

      const connect = (attempt: number) => {
        const es = new EventSource(`/api/workflow/${id}/execute`);
        esRef.current = es;

        es.addEventListener('node_input', (e) => {
          try {
            const data = JSON.parse(e.data) as Extract<WorkflowSSEEvent, { type: 'node_input' }>;
            // Use node_input arrival as the execution start timestamp.
            // This is more accurate than node_status:running because:
            // - Single nodes: node_input fires right before actual execution begins
            // - Parallel nodes: node_input fires per-node just before asyncio.gather,
            //   whereas node_status:running is batched for all parallel nodes first.
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
          } catch { /* ignore malformed SSE */ }
        });

        es.addEventListener('node_status', (e) => {
          try {
            const data = JSON.parse(e.data) as Extract<WorkflowSSEEvent, { type: 'node_status' }>;
            setSelectedNodeId(data.node_id);
            
            const updates: Parameters<typeof updateNodeData>[1] = {
              status: data.status,
              ...(data.error ? { error: data.error } : {}),
            };

            if (data.status === 'running') {
              // Timing is now anchored to node_input event (see above) for accuracy.
              // Fallback: if node_input was never received, start timing here.
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
          } catch { /* ignore malformed SSE */ }
        });

        es.addEventListener('node_token', (e) => {
          try {
            const data = JSON.parse(e.data) as Extract<WorkflowSSEEvent, { type: 'node_token' }>;
            setSelectedNodeId(data.node_id);
            updateNodeData(data.node_id, (prev) => ({
              output: (prev.output ?? '') + data.token,
            }));
            appendNodeTraceToken(data.node_id, data.token);
          } catch { /* ignore malformed SSE */ }
        });

        es.addEventListener('node_done', (e) => {
          try {
            const data = JSON.parse(e.data) as Extract<WorkflowSSEEvent, { type: 'node_done' }>;
            setSelectedNodeId(data.node_id);
            updateNodeData(data.node_id, {
              output: data.full_output,
              status: 'done',
            });
            updateNodeTrace(data.node_id, {
              status: 'done',
              finalOutput: data.full_output,
            });
          } catch { /* ignore malformed SSE */ }
        });

        es.addEventListener('loop_iteration', (e) => {
          try {
            const data = JSON.parse(e.data) as Extract<WorkflowSSEEvent, { type: 'loop_iteration' }>;
            setSelectedNodeId(data.group_id);
            updateNodeData(data.group_id, {
              currentIteration: data.iteration,
              totalIterations: data.total,
              status: 'running',
            });
          } catch { /* ignore malformed SSE */ }
        });

        es.addEventListener('workflow_done', (e) => {
          try {
            const data = JSON.parse(e.data) as Extract<WorkflowSSEEvent, { type: 'workflow_done' }>;
            setStatus(data.status === 'completed' ? 'completed' : 'error');
            if (data.status !== 'completed' && data.error) {
              setError(data.error);
            }
            finalizeExecutionSession(data.status === 'completed' ? 'completed' : 'error');
          } catch {
            setStatus('completed');
            finalizeExecutionSession('completed');
          } finally {
            es.close();
            esRef.current = null;
            startTimeMapRef.current = {};
            traceOrderRef.current = 1;
            // Resume cloud sync after execution completes
            window.dispatchEvent(new Event('workflow:execution-end'));
          }
        });

        es.onerror = () => {
          es.close();
          if (attempt < MAX_RECONNECT_ATTEMPTS) {
            reconnectCountRef.current = attempt + 1;
            setTimeout(() => connect(attempt + 1), 1000 * (attempt + 1));
          } else {
            setStatus('error');
            setError('连接中断，已重试 3 次');
            esRef.current = null;
          }
        };
      };

      connect(0);
    },
    [
      appendNodeTraceToken,
      clearExecutionSession,
      currentWorkflowId,
      finalizeExecutionSession,
      registerNodeTrace,
      setSelectedNodeId,
      startExecutionSession,
      stop,
      updateNodeData,
      updateNodeTrace,
    ]
  );

  return { status, error, start, stop };
}
