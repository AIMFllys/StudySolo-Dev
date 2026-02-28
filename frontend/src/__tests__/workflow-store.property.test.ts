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
      isDirty: false,
    });
  });

  it('setCurrentWorkflow injects nodes/edges exactly and sets currentWorkflowId', () => {
    fc.assert(
      fc.property(
        arbWorkflowId,
        fc.array(arbNode, { minLength: 0, maxLength: 10 }),
        fc.array(arbEdge, { minLength: 0, maxLength: 10 }),
        (workflowId, nodes, edges) => {
          useWorkflowStore.getState().setCurrentWorkflow(workflowId, nodes as any, edges as any);

          const state = useWorkflowStore.getState();

          // nodes and edges must exactly match injected data
          expect(state.nodes).toEqual(nodes);
          expect(state.edges).toEqual(edges);

          // currentWorkflowId must be set correctly
          expect(state.currentWorkflowId).toBe(workflowId);

          // isDirty must be false after setCurrentWorkflow
          expect(state.isDirty).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('setNodes marks isDirty and stores nodes correctly', () => {
    fc.assert(
      fc.property(
        fc.array(arbNode, { minLength: 0, maxLength: 10 }),
        (nodes) => {
          useWorkflowStore.getState().setNodes(nodes as any);

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
          useWorkflowStore.getState().setEdges(edges as any);

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
          useWorkflowStore.getState().setNodes(nodes as any);
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
