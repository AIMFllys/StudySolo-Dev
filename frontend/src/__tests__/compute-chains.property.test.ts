/**
 * Property tests for compute-chains.ts — workflow chain computation.
 */
import { describe, it, expect } from 'vitest';
import { computeWorkflowChains } from '@/features/workflow/utils/compute-chains';
import type { Edge, Node } from '@xyflow/react';

function n(id: string, type = 'summary', parentId?: string): Node {
  return { id, type, position: { x: 0, y: 0 }, data: {}, ...(parentId ? { parentId } : {}) } as Node;
}
function e(source: string, target: string): Edge {
  return { id: `e-${source}-${target}`, source, target } as Edge;
}

describe('computeWorkflowChains', () => {
  it('returns empty for no nodes', () => {
    expect(computeWorkflowChains([], [])).toEqual([]);
  });

  it('single node = single chain', () => {
    const chains = computeWorkflowChains([n('a')], []);
    expect(chains).toHaveLength(1);
    expect(chains[0].nodeIds).toEqual(['a']);
  });

  it('linear chain a→b→c', () => {
    const chains = computeWorkflowChains(
      [n('a'), n('b'), n('c')],
      [e('a', 'b'), e('b', 'c')],
    );
    expect(chains).toHaveLength(1);
    expect(chains[0].nodeIds).toEqual(['a', 'b', 'c']);
  });

  it('diamond produces two chains', () => {
    const chains = computeWorkflowChains(
      [n('a'), n('b'), n('c'), n('d')],
      [e('a', 'b'), e('a', 'c'), e('b', 'd'), e('c', 'd')],
    );
    expect(chains).toHaveLength(2);
    const allPaths = chains.map((c) => c.nodeIds.join(','));
    expect(allPaths).toContain('a,b,d');
    expect(allPaths).toContain('a,c,d');
  });

  it('excludes annotation nodes', () => {
    const chains = computeWorkflowChains(
      [n('a'), n('b', 'annotation'), n('c')],
      [e('a', 'c')],
    );
    const allIds = chains.flatMap((c) => c.nodeIds);
    expect(allIds).not.toContain('b');
  });

  it('excludes child nodes (parentId)', () => {
    const chains = computeWorkflowChains(
      [n('loop'), n('child', 'summary', 'loop'), n('after')],
      [e('loop', 'after')],
    );
    const allIds = chains.flatMap((c) => c.nodeIds);
    expect(allIds).not.toContain('child');
  });

  it('parallel roots produce separate chains', () => {
    const chains = computeWorkflowChains(
      [n('a'), n('b')],
      [],
    );
    expect(chains).toHaveLength(2);
  });

  it('chains have sequential labels', () => {
    const chains = computeWorkflowChains(
      [n('a'), n('b')],
      [],
    );
    expect(chains[0].chainId).toBe(1);
    expect(chains[1].chainId).toBe(2);
    expect(chains[0].label).toContain('1');
  });
});
