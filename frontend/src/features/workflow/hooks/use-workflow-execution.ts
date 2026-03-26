'use client';

import { useCallback, useRef, useState } from 'react';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import type { WorkflowSSEEvent } from '@/types/workflow-events';

export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'error';


export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'error';

const MAX_RECONNECT_ATTEMPTS = 3;

export function useWorkflowExecution() {
  const [status, setStatus] = useState<ExecutionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const reconnectCountRef = useRef(0);
  const startTimeMapRef = useRef<Record<string, number>>({});

  const { currentWorkflowId, setSelectedNodeId, updateNodeData } = useWorkflowStore();

  const stop = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    reconnectCountRef.current = 0;
    startTimeMapRef.current = {};
  }, []);

  const start = useCallback(
    (workflowId?: string) => {
      const id = workflowId ?? currentWorkflowId;
      if (!id) return;

      stop();
      setStatus('running');
      setError(null);

      // Pause cloud sync during execution to avoid race condition
      window.dispatchEvent(new Event('workflow:execution-start'));

      const connect = (attempt: number) => {
        const es = new EventSource(`/api/workflow/${id}/execute`);
        esRef.current = es;

        es.addEventListener('node_input', (e) => {
          try {
            const data = JSON.parse(e.data) as Extract<WorkflowSSEEvent, { type: 'node_input' }>;
            updateNodeData(data.node_id, {
              input_snapshot: data.input_snapshot,
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
              startTimeMapRef.current[data.node_id] = performance.now();
            } else if (data.status === 'done' || data.status === 'error') {
              const startT = startTimeMapRef.current[data.node_id];
              if (startT) {
                updates.execution_time_ms = Math.round(performance.now() - startT);
                delete startTimeMapRef.current[data.node_id];
              }
            }

            updateNodeData(data.node_id, updates);
          } catch { /* ignore malformed SSE */ }
        });

        es.addEventListener('node_token', (e) => {
          try {
            const data = JSON.parse(e.data) as Extract<WorkflowSSEEvent, { type: 'node_token' }>;
            setSelectedNodeId(data.node_id);
            updateNodeData(data.node_id, (prev) => ({
              output: (prev.output ?? '') + data.token,
            }));
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
          } catch {
            setStatus('completed');
          } finally {
            es.close();
            esRef.current = null;
            startTimeMapRef.current = {};
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
    [currentWorkflowId, setSelectedNodeId, updateNodeData, stop]
  );

  return { status, error, start, stop };
}
