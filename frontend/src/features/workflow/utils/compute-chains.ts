import type { Edge, Node } from '@xyflow/react';
import type { WorkflowChain } from '@/types';

function isExecutableTopLevelNode(node: Node): boolean {
  return !node.parentId && node.type !== 'annotation' && node.type !== 'generating';
}

export function computeWorkflowChains(nodes: Node[], edges: Edge[]): WorkflowChain[] {
  const topLevelNodes = nodes.filter(isExecutableTopLevelNode);
  const topLevelNodeIds = new Set(topLevelNodes.map((node) => node.id));

  if (topLevelNodes.length === 0) {
    return [];
  }

  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of topLevelNodes) {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    if (!topLevelNodeIds.has(edge.source) || !topLevelNodeIds.has(edge.target)) {
      continue;
    }

    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const roots = topLevelNodes
    .map((node) => node.id)
    .filter((nodeId) => (inDegree.get(nodeId) ?? 0) === 0);

  const paths: string[][] = [];

  const visit = (nodeId: string, path: string[]) => {
    const nextPath = [...path, nodeId];
    const targets = adjacency.get(nodeId) ?? [];

    if (targets.length === 0) {
      paths.push(nextPath);
      return;
    }

    for (const target of targets) {
      visit(target, nextPath);
    }
  };

  for (const root of roots) {
    visit(root, []);
  }

  return paths.map((nodeIds, index) => ({
    chainId: index + 1,
    label: `线路 ${index + 1}`,
    nodeIds,
  }));
}
