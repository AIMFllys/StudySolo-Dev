import { describe, expect, it } from 'vitest';
import {
  ALL_NODE_STORE_CATEGORY_ID,
  getStaticNodeStoreGroups,
  groupManifestForNodeStore,
  resolveNodeStoreGroupsForView,
  resolveSelectedNodeStoreCategory,
  type NodeStoreGroup,
} from '@/components/layout/sidebar/resolve-node-store-groups';
import type { NodeManifestItem, NodeType } from '@/types';

const MANIFEST_CATEGORY_BY_TYPE: Record<NodeType, string> = {
  trigger_input: 'input',
  knowledge_base: 'input',
  web_search: 'input',
  ai_analyzer: 'analysis',
  ai_planner: 'analysis',
  content_extract: 'generation',
  merge_polish: 'generation',
  outline_gen: 'generation',
  summary: 'generation',
  flashcard: 'generation',
  quiz_gen: 'generation',
  mind_map: 'generation',
  chat_response: 'interaction',
  write_db: 'output',
  export_file: 'output',
  compare: 'generation',
  logic_switch: 'analysis',
  loop_map: 'analysis',
  loop_group: 'structure',
  community_node: 'community',
  agent_code_review: 'agent',
  agent_deep_research: 'agent',
  agent_news: 'agent',
  agent_study_tutor: 'agent',
  agent_visual_site: 'agent',
};

function makeManifestItem(type: NodeType): NodeManifestItem {
  return {
    type,
    category: MANIFEST_CATEGORY_BY_TYPE[type],
    display_name: `Manifest ${type}`,
    description: `Manifest description for ${type}`,
    is_llm_node: true,
    output_format: 'markdown',
    icon: '⚙️',
    color: '#6366f1',
    config_schema: [],
    output_capabilities: [],
    supports_upload: false,
    supports_preview: true,
    deprecated_surface: null,
    renderer: null,
    version: '1.0.0',
    changelog: { '1.0.0': '初始版本' },
    model_source: type.startsWith('agent_') ? 'agent' : (['trigger_input', 'knowledge_base', 'web_search', 'write_db', 'export_file', 'loop_group'].includes(type) ? 'none' : 'catalog'),
    agent_name: type === 'agent_code_review'
      ? 'code-review'
      : type === 'agent_deep_research'
        ? 'deep-research'
        : type === 'agent_news'
          ? 'news'
          : type === 'agent_study_tutor'
            ? 'study-tutor'
            : type === 'agent_visual_site'
              ? 'visual-site'
              : null,
  };
}

describe('node store groups resolver', () => {
  it('returns the current six static groups with the existing order and node ordering', () => {
    expect(getStaticNodeStoreGroups()).toEqual([
      { id: 'trigger', label: '输入源', types: ['trigger_input', 'knowledge_base', 'web_search'] },
      { id: 'ai', label: 'AI 处理', types: ['ai_analyzer', 'ai_planner', 'content_extract', 'merge_polish'] },
      { id: 'content', label: '内容生成', types: ['outline_gen', 'summary', 'flashcard', 'quiz_gen', 'mind_map', 'chat_response'] },
      { id: 'data', label: '输出 & 存储', types: ['write_db', 'export_file'] },
      { id: 'logic', label: '逻辑控制', types: ['compare', 'logic_switch', 'loop_map', 'loop_group'] },
      { id: 'agent', label: 'Agent 专区', types: ['agent_code_review', 'agent_deep_research', 'agent_news', 'agent_study_tutor', 'agent_visual_site'] },
    ]);
  });

  it('projects a full manifest sample into the current six groups regardless of manifest order', () => {
    const manifest = [
      makeManifestItem('community_node'),
      makeManifestItem('agent_visual_site'),
      makeManifestItem('agent_study_tutor'),
      makeManifestItem('agent_news'),
      makeManifestItem('agent_deep_research'),
      makeManifestItem('agent_code_review'),
      makeManifestItem('loop_group'),
      makeManifestItem('loop_map'),
      makeManifestItem('logic_switch'),
      makeManifestItem('compare'),
      makeManifestItem('export_file'),
      makeManifestItem('write_db'),
      makeManifestItem('chat_response'),
      makeManifestItem('mind_map'),
      makeManifestItem('quiz_gen'),
      makeManifestItem('flashcard'),
      makeManifestItem('summary'),
      makeManifestItem('outline_gen'),
      makeManifestItem('merge_polish'),
      makeManifestItem('content_extract'),
      makeManifestItem('ai_planner'),
      makeManifestItem('ai_analyzer'),
      makeManifestItem('web_search'),
      makeManifestItem('knowledge_base'),
      makeManifestItem('trigger_input'),
    ];

    const grouping = groupManifestForNodeStore(manifest);

    expect(grouping.groups).toEqual(getStaticNodeStoreGroups());
    expect(grouping.unmappedManifestTypes).toEqual(['community_node']);
  });

  it('projects backend manifest categories into the current UI semantics instead of reusing category ids', () => {
    const grouping = groupManifestForNodeStore([
      makeManifestItem('trigger_input'),
      makeManifestItem('ai_analyzer'),
      makeManifestItem('content_extract'),
      makeManifestItem('chat_response'),
      makeManifestItem('write_db'),
      makeManifestItem('loop_group'),
      makeManifestItem('agent_code_review'),
      makeManifestItem('community_node'),
    ]);

    expect(grouping.groups).toEqual([
      { id: 'trigger', label: '输入源', types: ['trigger_input'] },
      { id: 'ai', label: 'AI 处理', types: ['ai_analyzer', 'content_extract'] },
      { id: 'content', label: '内容生成', types: ['chat_response'] },
      { id: 'data', label: '输出 & 存储', types: ['write_db'] },
      { id: 'logic', label: '逻辑控制', types: ['loop_group'] },
      { id: 'agent', label: 'Agent 专区', types: ['agent_code_review'] },
    ]);
    expect(grouping.unmappedManifestTypes).toEqual(['community_node']);
  });

  it('keeps future unmapped manifest types out of the default groups and reports them separately', () => {
    const futureNodeType = 'future_node' as NodeType;
    const grouping = groupManifestForNodeStore([
      makeManifestItem('summary'),
      {
        ...makeManifestItem('summary'),
        type: futureNodeType,
        category: 'future',
        display_name: '未来节点',
      },
    ]);

    expect(grouping.groups).toEqual([
      { id: 'content', label: '内容生成', types: ['summary'] },
    ]);
    expect(grouping.unmappedManifestTypes).toEqual([futureNodeType]);
  });

  it('returns empty dynamic groups for an empty manifest while preserving the static skeleton helper', () => {
    const grouping = groupManifestForNodeStore([]);

    expect(grouping.groups).toEqual([]);
    expect(grouping.unmappedManifestTypes).toEqual([]);
    expect(getStaticNodeStoreGroups()).toHaveLength(6);
  });

  it('falls back to the static skeleton while loading, on error, or when the manifest is empty', () => {
    const staticGroups = getStaticNodeStoreGroups(false);

    expect(resolveNodeStoreGroupsForView([makeManifestItem('summary')], true, null)).toEqual({
      mode: 'static-fallback',
      groups: staticGroups,
      unmappedManifestTypes: [],
    });
    expect(resolveNodeStoreGroupsForView([makeManifestItem('summary')], false, '加载失败')).toEqual({
      mode: 'static-fallback',
      groups: staticGroups,
      unmappedManifestTypes: [],
    });
    expect(resolveNodeStoreGroupsForView([], false, null)).toEqual({
      mode: 'static-fallback',
      groups: staticGroups,
      unmappedManifestTypes: [],
    });
  });

  it('returns only non-empty groups in dynamic mode and keeps unmapped semantics intact', () => {
    const resolution = resolveNodeStoreGroupsForView(
      [
        makeManifestItem('summary'),
        makeManifestItem('write_db'),
        makeManifestItem('agent_news'),
        makeManifestItem('community_node'),
      ],
      false,
      null,
    );

    expect(resolution).toEqual({
      mode: 'dynamic',
      groups: [
        { id: 'content', label: '内容生成', types: ['summary'] },
        { id: 'data', label: '输出 & 存储', types: ['write_db'] },
        { id: 'agent', label: 'Agent 专区', types: ['agent_news'] },
      ],
      unmappedManifestTypes: ['community_node'],
    });
  });

  it('falls back to all when the selected category is missing from the resolved groups', () => {
    const groups: NodeStoreGroup[] = [
      { id: 'content', label: '内容生成', types: ['summary'] as NodeType[] },
      { id: 'data', label: '输出 & 存储', types: ['write_db'] as NodeType[] },
    ];

    expect(resolveSelectedNodeStoreCategory('content', groups)).toBe('content');
    expect(resolveSelectedNodeStoreCategory('logic', groups)).toBe(ALL_NODE_STORE_CATEGORY_ID);
    expect(resolveSelectedNodeStoreCategory(ALL_NODE_STORE_CATEGORY_ID, groups)).toBe(ALL_NODE_STORE_CATEGORY_ID);
  });
});
