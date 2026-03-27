import type { Edge, Node } from '@xyflow/react';

export function buildExecutionRequestBody(nodes: Node[], edges: Edge[]) {
  return {
    nodes_json: nodes,
    edges_json: edges,
  };
}

export function getExecutionFailureMessage(error: unknown): string {
  return error instanceof Error && error.message.startsWith('HTTP ')
    ? `启动执行失败：${error.message}`
    : '执行流异常中断，请手动重新运行';
}

export function shouldFinalizeExecutionAsInterrupted(
  didComplete: boolean,
  aborted: boolean,
): boolean {
  return !didComplete && !aborted;
}
