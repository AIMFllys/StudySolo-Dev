import type { NodeStatus } from './node-types';

export interface NodeExecutionTrace {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  category: string;
  status: NodeStatus;
  executionOrder: number;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
  isParallel: boolean;
  parallelGroupId?: string;
  loopGroupId?: string;
  iteration?: number;
  inputSummary?: string;
  rawInputSnapshot?: string;
  progressMessage?: string;
  phase?: string;
  lastActivityAt?: number;
  streamingOutput: string;
  finalOutput?: string;
  outputFormat?: string;
  errorMessage?: string;
  modelRoute?: string;
  chainIds?: number[];
}

export interface WorkflowChain {
  chainId: number;
  label: string;
  nodeIds: string[];
}

export interface WorkflowExecutionSession {
  sessionId: string;
  workflowId: string;
  workflowName: string;
  startedAt: number;
  finishedAt?: number;
  totalDurationMs?: number;
  overallStatus: 'running' | 'completed' | 'error';
  traces: NodeExecutionTrace[];
  completedCount: number;
  totalCount: number;
  chains?: WorkflowChain[];
  phase?: string;
  phaseMessage?: string;
  lastActivityAt?: number;
}
