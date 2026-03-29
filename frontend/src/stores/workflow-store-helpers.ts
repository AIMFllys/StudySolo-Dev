import type { Edge, Node } from '@xyflow/react';

/** Resolve selectedNodeId: keep current if still valid, else pick first node. */
export function resolveSelectedNodeId(nodes: Node[], selectedNodeId: string | null): string | null {
  if (!nodes.length) return null;
  if (selectedNodeId && nodes.some((node) => node.id === selectedNodeId)) return selectedNodeId;
  return nodes[0]?.id ?? null;
}

/** Deduplicate nodes by id — React Flow MiniMap uses node.id as key internally. */
export function deduplicateNodes(nodes: Node[]): Node[] {
  const seen = new Map<string, Node>();
  for (const node of nodes) seen.set(node.id, node);
  return seen.size === nodes.length ? nodes : [...seen.values()];
}

/** Auto-assign branch label when source is logic_switch. */
export function buildEdgeData(
  sourceId: string,
  nodes: Node[],
  edges: Edge[],
): Record<string, unknown> {
  const sourceNode = nodes.find((n) => n.id === sourceId);
  const sourceType = (sourceNode?.data as Record<string, unknown>)?.type ?? sourceNode?.type;
  if (sourceType !== 'logic_switch') return {};

  const existingBranches = edges
    .filter((e) => e.source === sourceId)
    .map((e) => (e.data as Record<string, unknown>)?.branch as string)
    .filter(Boolean);

  const nextChar = String.fromCharCode(65 + existingBranches.length);
  return { branch: nextChar };
}
