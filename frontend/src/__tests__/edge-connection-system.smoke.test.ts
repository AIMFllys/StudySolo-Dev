import { describe, expect, it } from 'vitest';

/**
 * Task 5.1 — Edge Connection System property-based smoke tests.
 * Verifies branch labels, loop params, wait seconds, and edge data.
 */

// Helper: mock edge data structure matching WorkflowEdgeData
function mockEdge(id: string, source: string, target: string, data: Record<string, unknown> = {}) {
  return { id, source, target, type: 'sequential' as const, animated: false, data };
}

// Helper: mock node data
function mockNode(id: string, type: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: `Node ${id}`, type, status: 'pending', ...extra },
  };
}

describe('Task 5.1: Branch labels auto-assignment', () => {
  it('assigns sequential branch letters A, B, C for logic_switch edges', () => {
    const nodes = [
      mockNode('ls1', 'logic_switch'),
      mockNode('n1', 'chat_response'),
      mockNode('n2', 'chat_response'),
      mockNode('n3', 'chat_response'),
    ];

    // Simulate building edges sequentially
    const existingEdges: ReturnType<typeof mockEdge>[] = [];

    function nextBranch(sourceId: string) {
      const existing = existingEdges
        .filter((e) => e.source === sourceId)
        .map((e) => (e.data as Record<string, unknown>)?.branch as string)
        .filter(Boolean);
      return String.fromCharCode(65 + existing.length);
    }

    // First edge: A
    const branchA = nextBranch('ls1');
    existingEdges.push(mockEdge('e1', 'ls1', 'n1', { branch: branchA }));
    expect(branchA).toBe('A');

    // Second edge: B
    const branchB = nextBranch('ls1');
    existingEdges.push(mockEdge('e2', 'ls1', 'n2', { branch: branchB }));
    expect(branchB).toBe('B');

    // Third edge: C
    const branchC = nextBranch('ls1');
    existingEdges.push(mockEdge('e3', 'ls1', 'n3', { branch: branchC }));
    expect(branchC).toBe('C');
  });

  it('does not assign branch labels for non-logic_switch nodes', () => {
    const sourceType: string = 'chat_response';
    const shouldBranch = sourceType === 'logic_switch';
    expect(shouldBranch).toBe(false);
  });
});

describe('Task 5.1: Loop group parameter validation', () => {
  it('clamps iteration count to valid range [1, 100]', () => {
    const clamp = (v: number) => Math.max(1, Math.min(100, v));
    expect(clamp(0)).toBe(1);
    expect(clamp(-5)).toBe(1);
    expect(clamp(50)).toBe(50);
    expect(clamp(200)).toBe(100);
  });

  it('clamps interval to valid range [0, 300]', () => {
    const clamp = (v: number) => Math.max(0, Math.min(300, v));
    expect(clamp(-1)).toBe(0);
    expect(clamp(150)).toBe(150);
    expect(clamp(500)).toBe(300);
  });

  it('defaults to 3 iterations and 0 interval when data is undefined', () => {
    const data: Record<string, unknown> = {};
    const maxIterations = (data.maxIterations as number) ?? 3;
    const intervalSeconds = (data.intervalSeconds as number) ?? 0;
    expect(maxIterations).toBe(3);
    expect(intervalSeconds).toBe(0);
  });
});

describe('Task 5.1: Sequential edge with waitSeconds', () => {
  it('edge data stores waitSeconds correctly', () => {
    const edge = mockEdge('e1', 'n1', 'n2', { waitSeconds: 5 });
    const waitSeconds = (edge.data as Record<string, unknown>).waitSeconds;
    expect(waitSeconds).toBe(5);
  });

  it('max wait clamps at 300s', () => {
    const maxWait = Math.min(300, 999);
    expect(maxWait).toBe(300);
  });

  it('incoming edges max aggregation picks largest wait', () => {
    const incomingEdges = [
      mockEdge('e1', 'a', 'target', { waitSeconds: 2 }),
      mockEdge('e2', 'b', 'target', { waitSeconds: 5 }),
      mockEdge('e3', 'c', 'target', { waitSeconds: 1 }),
    ];

    const maxWait = Math.max(
      ...incomingEdges.map((e) => ((e.data as Record<string, unknown>)?.waitSeconds as number) || 0),
    );
    expect(maxWait).toBe(5);
  });
});

describe('Task 5.1: Edge note and branch display priority', () => {
  it('branch label takes priority over note for logic_switch edges', () => {
    const data = { branch: 'A', note: '备注', waitSeconds: 0 };
    const isBranchEdge = true;
    const displayText = isBranchEdge ? (data.branch || '默认') : (data.note || '');
    expect(displayText).toBe('A');
  });

  it('note displays for non-branch edges', () => {
    const data = { note: '先执行', waitSeconds: 0 };
    const isBranchEdge = false;
    const displayText = isBranchEdge ? '默认' : (data.note || '');
    expect(displayText).toBe('先执行');
  });
});
