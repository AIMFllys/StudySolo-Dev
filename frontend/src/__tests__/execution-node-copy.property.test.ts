import { describe, expect, it } from 'vitest';
import { buildExecutionNodeNameMap, resolveExecutionNodeCopy } from '@/features/workflow/utils/execution-node-copy';
import type { Node } from '@xyflow/react';
import type { NodeManifestItem } from '@/types';

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
    ...overrides,
  };
}

describe('execution node copy helpers', () => {
  it('keeps trace nodeName as the highest-priority title', () => {
    const copy = resolveExecutionNodeCopy({
      nodeType: 'summary',
      traceNodeName: '运行时节点标题',
      nodeLabel: '节点标题',
      manifestItem: makeManifestItem('summary', { display_name: 'Manifest 标题' }),
    });

    expect(copy.title).toBe('运行时节点标题');
  });

  it('prefers node label over manifest when trace nodeName is missing', () => {
    const copy = resolveExecutionNodeCopy({
      nodeType: 'summary',
      nodeLabel: '节点标题',
      manifestItem: makeManifestItem('summary', { display_name: 'Manifest 标题' }),
    });

    expect(copy.title).toBe('节点标题');
  });

  it('uses manifest title when node label is missing', () => {
    const copy = resolveExecutionNodeCopy({
      nodeType: 'summary',
      nodeLabel: '   ',
      manifestItem: makeManifestItem('summary', { display_name: 'Manifest 标题' }),
    });

    expect(copy.title).toBe('Manifest 标题');
  });

  it('falls back to workflow meta title when manifest title is blank', () => {
    const copy = resolveExecutionNodeCopy({
      nodeType: 'summary',
      nodeLabel: '   ',
      manifestItem: makeManifestItem('summary', { display_name: '   ' }),
    });

    expect(copy.title).toBe('总结归纳');
  });

  it('prefers manifest description over workflow meta description', () => {
    const copy = resolveExecutionNodeCopy({
      nodeType: 'summary',
      manifestItem: makeManifestItem('summary', { description: '更具体的 Manifest 描述' }),
    });

    expect(copy.description).toBe('更具体的 Manifest 描述');
  });

  it('falls back to workflow meta description when manifest description is blank', () => {
    const copy = resolveExecutionNodeCopy({
      nodeType: 'summary',
      manifestItem: makeManifestItem('summary', { description: '   ' }),
    });

    expect(copy.description).toBe('整理重点、结论与复习摘要');
  });

  it('builds nodeNameMap from node label, then manifest title, then workflow meta', () => {
    const nodes = [
      {
        id: 'node-1',
        type: 'summary',
        data: { label: '节点标题', type: 'summary' },
      },
      {
        id: 'node-2',
        type: 'summary',
        data: { label: '   ', type: 'summary' },
      },
      {
        id: 'node-3',
        type: 'summary',
        data: { type: 'summary' },
      },
    ] as unknown as Node[];

    const nodeNameMap = buildExecutionNodeNameMap(nodes, {
      summary: makeManifestItem('summary', { display_name: 'Manifest 标题' }),
    });

    expect(nodeNameMap['node-1']).toBe('节点标题');
    expect(nodeNameMap['node-2']).toBe('Manifest 标题');
    expect(nodeNameMap['node-3']).toBe('Manifest 标题');
  });

  it('falls back to node id only when node label, manifest, and meta title are all unavailable', () => {
    const nodes = [
      {
        id: 'node-raw',
        type: 'unknown_type',
        data: { label: '   ', type: 'unknown_type' },
      },
    ] as unknown as Node[];

    const nodeNameMap = buildExecutionNodeNameMap(nodes, {});

    expect(nodeNameMap['node-raw']).toBe('node-raw');
  });

  it('builds mixed nodeNameMap entries from label, manifest, workflow meta, and node id fallbacks', () => {
    const nodes = [
      {
        id: 'node-labeled',
        type: 'summary',
        data: { label: '自定义标题', type: 'summary' },
      },
      {
        id: 'node-manifest',
        type: 'summary',
        data: { label: '   ', type: 'summary' },
      },
      {
        id: 'node-meta',
        type: 'flashcard',
        data: { label: '   ', type: 'flashcard' },
      },
      {
        id: 'node-id',
        type: 'unknown_type',
        data: { label: '   ', type: 'unknown_type' },
      },
    ] as unknown as Node[];

    const nodeNameMap = buildExecutionNodeNameMap(nodes, {
      summary: makeManifestItem('summary', { display_name: 'Manifest 总结标题' }),
    });

    expect(nodeNameMap['node-labeled']).toBe('自定义标题');
    expect(nodeNameMap['node-manifest']).toBe('Manifest 总结标题');
    expect(nodeNameMap['node-meta']).toBe('闪卡生成');
    expect(nodeNameMap['node-id']).toBe('node-id');
  });
});
