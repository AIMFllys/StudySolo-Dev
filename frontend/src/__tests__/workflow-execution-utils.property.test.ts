import { describe, expect, it } from 'vitest';
import { computeWorkflowChains } from '@/features/workflow/utils/compute-chains';
import { extractSseEvents } from '@/features/workflow/utils/parse-sse';
import {
  resolveNodeConfigPopoverPosition,
  type NodeConfigAnchorRect,
} from '@/features/workflow/components/node-config/popover-position';
import type { Edge, Node } from '@xyflow/react';

function makeNode(id: string, type = 'summary', parentId?: string): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: id, system_prompt: '', model_route: '', status: 'pending', output: '' },
    ...(parentId ? { parentId } : {}),
  } as Node;
}

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target, type: 'sequential' } as Edge;
}

describe('workflow execution utils', () => {
  it('extracts complete SSE events and preserves incomplete remainder', () => {
    const chunk = [
      'event: node_status\n',
      'data: {"node_id":"n1","status":"running"}\n\n',
      'event: node_done\n',
      'data: {"node_id":"n1","full_output":"ok"}',
    ].join('');

    const parsed = extractSseEvents(chunk);

    expect(parsed.events).toEqual([
      {
        event: 'node_status',
        data: '{"node_id":"n1","status":"running"}',
      },
    ]);
    expect(parsed.remainder).toContain('event: node_done');
  });

  it('computes root-to-leaf chains and keeps merged nodes in multiple chains', () => {
    const nodes = [
      makeNode('start'),
      makeNode('switch', 'logic_switch'),
      makeNode('branch-a'),
      makeNode('branch-b'),
      makeNode('merge'),
    ];
    const edges = [
      makeEdge('e1', 'start', 'switch'),
      makeEdge('e2', 'switch', 'branch-a'),
      makeEdge('e3', 'switch', 'branch-b'),
      makeEdge('e4', 'branch-a', 'merge'),
      makeEdge('e5', 'branch-b', 'merge'),
    ];

    const chains = computeWorkflowChains(nodes, edges);

    expect(chains).toEqual([
      { chainId: 1, label: '线路 1', nodeIds: ['start', 'switch', 'branch-a', 'merge'] },
      { chainId: 2, label: '线路 2', nodeIds: ['start', 'switch', 'branch-b', 'merge'] },
    ]);
  });

  it('ignores annotation, generating and loop_group child nodes when computing chains', () => {
    const nodes = [
      makeNode('start'),
      makeNode('note', 'annotation'),
      makeNode('loading', 'generating'),
      makeNode('group', 'loop_group'),
      makeNode('child', 'summary', 'group'),
      makeNode('end'),
    ];
    const edges = [
      makeEdge('e1', 'start', 'end'),
      makeEdge('e2', 'group', 'end'),
      makeEdge('e3', 'child', 'end'),
    ];

    const chains = computeWorkflowChains(nodes, edges);

    expect(chains.map((chain) => chain.nodeIds)).toEqual([
      ['start', 'end'],
      ['group', 'end'],
    ]);
  });

  it('keeps popover inside viewport and flips to the left when needed', () => {
    const anchorRect: NodeConfigAnchorRect = {
      top: 500,
      left: 980,
      right: 1010,
      bottom: 530,
      width: 30,
      height: 30,
    };

    const position = resolveNodeConfigPopoverPosition(
      anchorRect,
      { width: 1200, height: 800 },
      { width: 380, height: 360 },
    );

    expect(position.left).toBeLessThan(anchorRect.left);
    expect(position.top).toBeGreaterThanOrEqual(12);
    expect(position.top + 360).toBeLessThanOrEqual(788);
  });
});
