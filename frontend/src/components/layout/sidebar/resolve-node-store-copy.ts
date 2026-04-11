import type { NodeManifestItem, NodeType } from '@/types';
import { getNodeTypeMeta } from '@/features/workflow/constants/workflow-meta';

type NodeStoreManifestCopy = Pick<NodeManifestItem, 'display_name' | 'description'>;

function normalizeCopy(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

export function resolveNodeStoreCopy(
  nodeType: NodeType,
  manifestItem?: NodeStoreManifestCopy | null,
) {
  const meta = getNodeTypeMeta(nodeType);

  return {
    title: normalizeCopy(manifestItem?.display_name) ?? meta.label,
    description: normalizeCopy(manifestItem?.description) ?? meta.description,
  };
}

export function matchesNodeStoreQuery(
  nodeType: NodeType,
  manifestItem: NodeStoreManifestCopy | null | undefined,
  query: string,
) {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return true;
  }

  const copy = resolveNodeStoreCopy(nodeType, manifestItem);

  return (
    copy.title.toLowerCase().includes(normalizedQuery) ||
    copy.description.toLowerCase().includes(normalizedQuery) ||
    nodeType.toLowerCase().includes(normalizedQuery)
  );
}
