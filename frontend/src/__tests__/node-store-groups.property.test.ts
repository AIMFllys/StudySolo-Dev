import { describe, expect, it } from 'vitest';
import {
  getStaticNodeStoreGroups,
  groupManifestForNodeStore,
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
  };
}

describe('node store groups resolver', () => {
  it('returns the current five static groups with the existing order and node ordering', () => {
    expect(getStaticNodeStoreGroups()).toEqual([
      { id: 'trigger', label: '输入源', types: ['trigger_input', 'knowledge_base', 'web_search'] },
      { id: 'ai', label: 'AI 处理', types: ['ai_analyzer', 'ai_planner', 'content_extract', 'merge_polish'] },
      { id: 'content', label: '内容生成', types: ['outline_gen', 'summary', 'flashcard', 'quiz_gen', 'mind_map', 'chat_response'] },
      { id: 'data', label: '输出 & 存储', types: ['write_db', 'export_file'] },
      { id: 'logic', label: '逻辑控制', types: ['compare', 'logic_switch', 'loop_map', 'loop_group'] },
    ]);
  });

  it('projects a full manifest sample into the current five groups regardless of manifest order', () => {
    const manifest = [
      makeManifestItem('community_node'),
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
      makeManifestItem('community_node'),
    ]);

    expect(grouping.groups).toEqual([
      { id: 'trigger', label: '输入源', types: ['trigger_input'] },
      { id: 'ai', label: 'AI 处理', types: ['ai_analyzer', 'content_extract'] },
      { id: 'content', label: '内容生成', types: ['chat_response'] },
      { id: 'data', label: '输出 & 存储', types: ['write_db'] },
      { id: 'logic', label: '逻辑控制', types: ['loop_group'] },
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
    expect(getStaticNodeStoreGroups()).toHaveLength(5);
  });
});
