'use client';

import { useCallback, useRef, useState } from 'react';
import { useWorkflowStore } from '@/stores/use-workflow-store';

export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'error';

const MAX_RECONNECT_ATTEMPTS = 3;

export function useWorkflowExecution() {
  const [status, setStatus] = useState<ExecutionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const reconnectCountRef = useRef(0);

  const { currentWorkflowId, updateNodeData } = useWorkflowStore();

  const stop = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    reconnectCountRef.current = 0;
  }, []);

  const start = useCallback(
    (workflowId?: string) => {
      const id = workflowId ?? currentWorkflowId;
      if (!id) return;

      stop();
      setStatus('running');
      setError(null);

      const connect = (attempt: number) => {
        const es = new EventSource(`/api/workflow/${id}/execute`);
        esRef.current = es;

        es.addEventListener('node_status', (e) => {
          const data = JSON.parse(e.data);
          updateNodeData(data.node_id, { status: data.status });
        });

        es.addEventListener('node_token', (e) => {
          const data = JSON.parse(e.data);
          updateNodeData(data.node_id, (prev) => ({
            output: (prev.output ?? '') + data.token,
          }));
        });

        es.addEventListener('node_done', (e) => {
          const data = JSON.parse(e.data);
          updateNodeData(data.node_id, {
            output: data.full_output,
            status: 'done',
          });
        });

        es.addEventListener('workflow_done', () => {
          setStatus('completed');
          es.close();
          esRef.current = null;
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
    [currentWorkflowId, updateNodeData, stop]
  );

  return { status, error, start, stop };
}
