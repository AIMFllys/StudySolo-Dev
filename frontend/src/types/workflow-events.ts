import type { NodeStatus } from './workflow';

export type WorkflowSSEEvent =
  | { type: 'node_status'; node_id: string; status: NodeStatus; error?: string }
  | { type: 'node_input'; node_id: string; input_snapshot: string }
  | { type: 'node_token'; node_id: string; token: string }
  | { type: 'node_done'; node_id: string; full_output: string }
  | { type: 'loop_iteration'; group_id: string; iteration: number; total: number }
  | { type: 'workflow_done'; workflow_id: string; status: string; error?: string }
  | { type: 'save_error'; workflow_id: string; error: string };
