import type { NodeManifestItem, NodeType } from '@/types';

export type NodeStoreGroupId = 'trigger' | 'ai' | 'content' | 'data' | 'logic' | 'agent';
export const ALL_NODE_STORE_CATEGORY_ID = 'all';
export type NodeStoreCategoryId = NodeStoreGroupId | typeof ALL_NODE_STORE_CATEGORY_ID;
export type NodeStoreGroupMode = 'dynamic' | 'static-fallback';

export type NodeStoreGroup = {
  id: NodeStoreGroupId;
  label: string;
  types: NodeType[];
};

export type NodeStoreManifestGrouping = {
  groups: NodeStoreGroup[];
  unmappedManifestTypes: NodeType[];
};

export type NodeStoreGroupViewResolution = NodeStoreManifestGrouping & {
  mode: NodeStoreGroupMode;
};

type NodeStoreGroupDefinition = {
  id: NodeStoreGroupId;
  label: string;
  types: readonly NodeType[];
};

const STATIC_NODE_STORE_GROUPS: readonly NodeStoreGroupDefinition[] = [
  { id: 'trigger', label: '输入源', types: ['trigger_input', 'knowledge_base', 'web_search'] },
  { id: 'ai', label: 'AI 处理', types: ['ai_analyzer', 'ai_planner', 'content_extract', 'merge_polish'] },
  { id: 'content', label: '内容生成', types: ['outline_gen', 'summary', 'flashcard', 'quiz_gen', 'mind_map', 'chat_response'] },
  { id: 'data', label: '输出 & 存储', types: ['write_db', 'export_file'] },
  { id: 'logic', label: '逻辑控制', types: ['compare', 'logic_switch', 'loop_map', 'loop_group'] },
  { id: 'agent', label: 'Agent 专区', types: ['agent_code_review', 'agent_deep_research', 'agent_news', 'agent_study_tutor', 'agent_visual_site'] },
];

const NODE_TYPE_TO_GROUP_ID: Record<NodeType, NodeStoreGroupId | null> = {
  trigger_input: 'trigger',
  knowledge_base: 'trigger',
  web_search: 'trigger',
  ai_analyzer: 'ai',
  ai_planner: 'ai',
  content_extract: 'ai',
  merge_polish: 'ai',
  outline_gen: 'content',
  summary: 'content',
  flashcard: 'content',
  quiz_gen: 'content',
  mind_map: 'content',
  chat_response: 'content',
  write_db: 'data',
  export_file: 'data',
  compare: 'logic',
  logic_switch: 'logic',
  loop_map: 'logic',
  loop_group: 'logic',
  community_node: null,
  agent_code_review: 'agent',
  agent_deep_research: 'agent',
  agent_news: 'agent',
  agent_study_tutor: 'agent',
  agent_visual_site: 'agent',
};

function cloneGroup(group: NodeStoreGroupDefinition): NodeStoreGroup {
  return {
    id: group.id,
    label: group.label,
    types: [...group.types],
  };
}

function resolveGroupIdForNodeType(nodeType: string): NodeStoreGroupId | null {
  if (!Object.prototype.hasOwnProperty.call(NODE_TYPE_TO_GROUP_ID, nodeType)) {
    return null;
  }

  return NODE_TYPE_TO_GROUP_ID[nodeType as NodeType];
}

export function getStaticNodeStoreGroups(includeAgent = true): NodeStoreGroup[] {
  return STATIC_NODE_STORE_GROUPS
    .filter((group) => includeAgent || group.id !== 'agent')
    .map(cloneGroup);
}

export function groupManifestForNodeStore(
  manifest: NodeManifestItem[],
): NodeStoreManifestGrouping {
  const groupedTypes = new Map<NodeStoreGroupId, Set<NodeType>>(
    STATIC_NODE_STORE_GROUPS.map((group) => [group.id, new Set<NodeType>()]),
  );
  const unmappedManifestTypes = new Set<NodeType>();

  for (const item of manifest) {
    const manifestType = String(item.type);
    const groupId = resolveGroupIdForNodeType(manifestType);

    if (!groupId) {
      unmappedManifestTypes.add(manifestType as NodeType);
      continue;
    }

    groupedTypes.get(groupId)?.add(manifestType as NodeType);
  }

  const groups = STATIC_NODE_STORE_GROUPS
    .map((group) => ({
      id: group.id,
      label: group.label,
      types: group.types.filter((type) => groupedTypes.get(group.id)?.has(type)),
    }))
    .filter((group) => group.types.length > 0);

  return {
    groups,
    unmappedManifestTypes: [...unmappedManifestTypes],
  };
}

export function resolveNodeStoreGroupsForView(
  manifest: NodeManifestItem[],
  isLoading: boolean,
  error: string | null | undefined,
): NodeStoreGroupViewResolution {
  if (isLoading || error || manifest.length === 0) {
    return {
      mode: 'static-fallback',
      groups: getStaticNodeStoreGroups(false),
      unmappedManifestTypes: [],
    };
  }

  return {
    mode: 'dynamic',
    ...groupManifestForNodeStore(manifest),
  };
}

export function resolveSelectedNodeStoreCategory(
  selectedCategoryId: string,
  groups: NodeStoreGroup[],
): NodeStoreCategoryId {
  if (selectedCategoryId === ALL_NODE_STORE_CATEGORY_ID) {
    return ALL_NODE_STORE_CATEGORY_ID;
  }

  return groups.some((group) => group.id === selectedCategoryId)
    ? (selectedCategoryId as NodeStoreGroupId)
    : ALL_NODE_STORE_CATEGORY_ID;
}
