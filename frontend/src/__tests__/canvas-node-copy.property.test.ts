import { describe, expect, it } from 'vitest';
import type { NodeManifestItem } from '@/types';
import { resolveCanvasNodeDescription } from '@/features/workflow/components/nodes/resolve-canvas-node-description';

function makeManifestItem(
  type: NodeManifestItem['type'],
  overrides: Partial<NodeManifestItem> = {},
): NodeManifestItem {
  return {
    type,
    category: 'generation',
    display_name: 'Manifest 标题',
    description: 'Manifest 描述',
    is_llm_node: true,
    output_format: 'markdown',
    icon: 'icon',
    color: '#000000',
    config_schema: [],
    output_capabilities: [],
    supports_upload: false,
    supports_preview: true,
    deprecated_surface: null,
    renderer: null,
    version: '1.0.0',
    changelog: { '1.0.0': '初始版本' },
    model_source: 'catalog',
    agent_name: null,
    ...overrides,
  };
}

describe('canvas node description resolver', () => {
  it('prefers manifest description for regular nodes', () => {
    const description = resolveCanvasNodeDescription({
      nodeType: 'summary',
      manifestItem: makeManifestItem('summary', { description: '更具体的 Manifest 描述' }),
    });

    expect(description).toBe('更具体的 Manifest 描述');
  });

  it('falls back to workflow meta description when regular node manifest description is blank', () => {
    const description = resolveCanvasNodeDescription({
      nodeType: 'summary',
      manifestItem: makeManifestItem('summary', { description: '   ' }),
    });

    expect(description).toBe('整理重点、结论与复习摘要');
  });

  it('keeps community input_hint as the highest-priority description', () => {
    const description = resolveCanvasNodeDescription({
      nodeType: 'community_node',
      isCommunityNode: true,
      inputHint: '先输入课程资料与目标',
      manifestItem: makeManifestItem('community_node', { description: 'Manifest 社区描述' }),
    });

    expect(description).toBe('先输入课程资料与目标');
  });

  it('falls back to manifest description when community input_hint is blank', () => {
    const description = resolveCanvasNodeDescription({
      nodeType: 'community_node',
      isCommunityNode: true,
      inputHint: '   ',
      manifestItem: makeManifestItem('community_node', { description: 'Manifest 社区描述' }),
    });

    expect(description).toBe('Manifest 社区描述');
  });

  it('falls back to the default community description when input_hint and manifest description are missing', () => {
    const description = resolveCanvasNodeDescription({
      nodeType: 'community_node',
      isCommunityNode: true,
      inputHint: '   ',
      manifestItem: makeManifestItem('community_node', { description: '   ' }),
    });

    expect(description).toBe('社区共享的封装 AI 节点');
  });

  it('treats blank manifest descriptions as missing', () => {
    const description = resolveCanvasNodeDescription({
      nodeType: 'summary',
      manifestItem: makeManifestItem('summary', { description: '' }),
    });

    expect(description).toBe('整理重点、结论与复习摘要');
  });
});
