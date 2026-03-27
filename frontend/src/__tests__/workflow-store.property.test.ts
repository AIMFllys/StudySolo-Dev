/**
 * Property 6: Zustand Store 状态一致性
 * Feature: studysolo-mvp, Property 6: Zustand Store 状态一致性
 *
 * For any valid nodes/edges data injected into the Zustand Store,
 * the Store's nodes and edges must exactly match the injected data,
 * and currentWorkflowId must be correctly set.
 *
 * Validates: Requirements 3.7, 5.8
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import type { Edge, Node } from '@xyflow/react';

// Arbitraries
const arbNodeStatus = fc.constantFrom('pending', 'running', 'done', 'error', 'paused');
const arbNodeType = fc.constantFrom(
  'trigger_input', 'ai_analyzer', 'ai_planner', 'outline_gen',
  'content_extract', 'summary', 'flashcard', 'chat_response', 'write_db'
);

const arbNode = fc.record({
  id: fc.uuid(),
  type: arbNodeType,
  position: fc.record({ x: fc.float(), y: fc.float() }),
  data: fc.record({
    label: fc.string({ minLength: 1, maxLength: 50 }),
    system_prompt: fc.string(),
    model_route: fc.string(),
    status: arbNodeStatus,
    output: fc.string(),
  }),
});

const arbEdge = fc.record({
  id: fc.uuid(),
  source: fc.uuid(),
  target: fc.uuid(),
});

const arbWorkflowId = fc.uuid();

describe('Property 6: Zustand Store 状态一致性', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useWorkflowStore.setState({
      nodes: [],
      edges: [],
      currentWorkflowId: null,
      currentWorkflowName: null,
      isDirty: false,
    });
  });

  it('setCurrentWorkflow normalizes edges and sets currentWorkflowId', () => {
    fc.assert(
      fc.property(
        arbWorkflowId,
        fc.array(arbNode, { minLength: 0, maxLength: 10 }),
        fc.array(arbEdge, { minLength: 0, maxLength: 10 }),
        (workflowId, nodes, edges) => {
          useWorkflowStore.getState().setCurrentWorkflow(workflowId, `工作流-${workflowId}`, nodes as unknown as Node[], edges as unknown as Edge[]);

          const state = useWorkflowStore.getState();

          expect(state.nodes).toEqual(nodes);
          expect(state.edges).toHaveLength(edges.length);
          state.edges.forEach((edge, index) => {
            expect(edge.id).toBe(edges[index].id);
            expect(edge.source).toBe(edges[index].source);
            expect(edge.target).toBe(edges[index].target);
            expect(edge.type).toBe('sequential');
            expect(edge.sourceHandle).toBe('source-right');
            expect(edge.targetHandle).toBe('target-left');
            expect(edge.data).toEqual({});
          });

          expect(state.nodes).toEqual(nodes);

          // currentWorkflowId must be set correctly
          expect(state.currentWorkflowId).toBe(workflowId);
          expect(state.currentWorkflowName).toBe(`工作流-${workflowId}`);

          // isDirty must be false after setCurrentWorkflow
          expect(state.isDirty).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('setCurrentWorkflow filters legacy loop_region nodes', () => {
    const nodes = [
      {
        id: 'node-1',
        type: 'summary',
        position: { x: 0, y: 0 },
        data: { label: 'A', system_prompt: '', model_route: '', status: 'pending', output: '' },
      },
      {
        id: 'legacy-loop',
        type: 'loop_region',
        position: { x: 10, y: 10 },
        data: {},
      },
    ] as unknown as Node[];

    useWorkflowStore.getState().setCurrentWorkflow('wf-1', '工作流 1', nodes, []);

    const state = useWorkflowStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0]?.id).toBe('node-1');
  });

  it('onConnect assigns branch labels for logic_switch edges', () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'switch-1',
          type: 'logic_switch',
          position: { x: 0, y: 0 },
          data: { label: '分支', system_prompt: '', model_route: '', status: 'pending', output: '', type: 'logic_switch' },
        },
        {
          id: 'node-a',
          type: 'summary',
          position: { x: 100, y: 0 },
          data: { label: 'A', system_prompt: '', model_route: '', status: 'pending', output: '' },
        },
        {
          id: 'node-b',
          type: 'summary',
          position: { x: 200, y: 0 },
          data: { label: 'B', system_prompt: '', model_route: '', status: 'pending', output: '' },
        },
      ] as unknown as Node[],
      edges: [],
      currentWorkflowId: null,
      currentWorkflowName: null,
      isDirty: false,
    });

    useWorkflowStore.getState().onConnect({
      source: 'switch-1',
      target: 'node-a',
      sourceHandle: null,
      targetHandle: null,
    });
    useWorkflowStore.getState().onConnect({
      source: 'switch-1',
      target: 'node-b',
      sourceHandle: null,
      targetHandle: null,
    });

    const [first, second] = useWorkflowStore.getState().edges;
    expect((first?.data as { branch?: string } | undefined)?.branch).toBe('A');
    expect((second?.data as { branch?: string } | undefined)?.branch).toBe('B');
  });

  it('startExecutionSession stores workflowName and chainIds', () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'start',
          type: 'summary',
          position: { x: 0, y: 0 },
          data: { label: '开始', system_prompt: '', model_route: '', status: 'pending', output: '' },
        },
        {
          id: 'branch-a',
          type: 'summary',
          position: { x: 100, y: 0 },
          data: { label: 'A', system_prompt: '', model_route: '', status: 'pending', output: '' },
        },
        {
          id: 'branch-b',
          type: 'summary',
          position: { x: 100, y: 100 },
          data: { label: 'B', system_prompt: '', model_route: '', status: 'pending', output: '' },
        },
      ] as unknown as Node[],
      edges: [
        { id: 'e1', source: 'start', target: 'branch-a' },
        { id: 'e2', source: 'start', target: 'branch-b' },
      ] as unknown as Edge[],
      currentWorkflowId: 'wf-chain',
      currentWorkflowName: '链路测试',
      isDirty: false,
    });

    useWorkflowStore.getState().startExecutionSession('wf-chain', '链路测试');

    const session = useWorkflowStore.getState().executionSession;
    expect(session?.workflowName).toBe('链路测试');
    expect(session?.chains).toHaveLength(2);
    expect(session?.traces.find((trace) => trace.nodeId === 'start')?.chainIds).toEqual([1, 2]);
  });

  it('setNodes marks isDirty and stores nodes correctly', () => {
    fc.assert(
      fc.property(
        fc.array(arbNode, { minLength: 0, maxLength: 10 }),
        (nodes) => {
          useWorkflowStore.getState().setNodes(nodes as unknown as Node[]);

          const state = useWorkflowStore.getState();
          expect(state.nodes).toEqual(nodes);
          expect(state.isDirty).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('setEdges marks isDirty and stores edges correctly', () => {
    fc.assert(
      fc.property(
        fc.array(arbEdge, { minLength: 0, maxLength: 10 }),
        (edges) => {
          useWorkflowStore.getState().setEdges(edges as unknown as Edge[]);

          const state = useWorkflowStore.getState();
          expect(state.edges).toEqual(edges);
          expect(state.isDirty).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('markClean resets isDirty to false regardless of prior state', () => {
    fc.assert(
      fc.property(
        fc.array(arbNode, { minLength: 1, maxLength: 5 }),
        (nodes) => {
          // Set nodes to make dirty
          useWorkflowStore.getState().setNodes(nodes as unknown as Node[]);
          expect(useWorkflowStore.getState().isDirty).toBe(true);

          // markClean should reset
          useWorkflowStore.getState().markClean();
          expect(useWorkflowStore.getState().isDirty).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
