import type { NodeStatus } from './workflow';

type WorkflowEventMeta = {
  parallel_group_id?: string;
  loop_group_id?: string;
  iteration?: number;
  sequence?: number;
  phase?: string;
};

export type WorkflowSSEEvent =
  | ({ type: 'node_status'; node_id: string; status: NodeStatus; error?: string } & WorkflowEventMeta)
  | ({ type: 'node_input'; node_id: string; input_snapshot: string } & WorkflowEventMeta)
  | ({ type: 'node_token'; node_id: string; token: string } & WorkflowEventMeta)
  | ({ type: 'node_done'; node_id: string; full_output: string; metadata?: Record<string, unknown> } & WorkflowEventMeta)
  | ({ type: 'node_progress'; node_id: string; message: string } & WorkflowEventMeta)
  | { type: 'loop_iteration'; group_id: string; iteration: number; total: number; loop_group_id?: string }
  | { type: 'workflow_status'; workflow_id: string; phase: string; message?: string }
  | { type: 'heartbeat'; workflow_id?: string; phase?: string; ts: string }
  | { type: 'workflow_done'; workflow_id: string; status: string; error?: string }
  | { type: 'save_error'; workflow_id: string; error: string };
