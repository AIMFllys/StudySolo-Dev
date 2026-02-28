/**
 * Property 7: 三层同步脏标记管理
 * Feature: studysolo-mvp, Property 7: 三层同步脏标记管理
 *
 * For any sequence of node modifications to the Zustand Store,
 * isDirty must be true after modification and false after markClean().
 *
 * Validates: Requirements 3.9, 3.10
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useWorkflowStore } from '@/stores/use-workflow-store';

const arbNodeStatus = fc.constantFrom('pending' as const, 'running' as const, 'done' as const, 'error' as const, 'paused' as const);
const arbNodeType = fc.constantFrom(
  'trigger_input' as const, 'ai_analyzer' as const, 'ai_planner' as const,
  'outline_gen' as const, 'content_extract' as const, 'summary' as const,
  'flashcard' as const, 'chat_response' as const, 'write_db' as const
);

const arbNode = fc.record({
  id: fc.uuid(),
  type: arbNodeType,
  position: fc.record({ x: fc.float(), y: fc.float() }),
  data: fc.record({
    label: fc.string({ minLength: 1, maxLength: 30 }),
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

describe('Property 7: 三层同步脏标记管理', () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      nodes: [],
      edges: [],
      currentWorkflowId: null,
      isDirty: false,
    });
  });

  it('isDirty becomes true after setNodes', () => {
    fc.assert(
      fc.property(
        fc.array(arbNode, { minLength: 1, maxLength: 8 }),
        (nodes) => {
          useWorkflowStore.setState({ isDirty: false });
          useWorkflowStore.getState().setNodes(nodes as any);
          expect(useWorkflowStore.getState().isDirty).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isDirty becomes true after setEdges', () => {
    fc.assert(
      fc.property(
        fc.array(arbEdge, { minLength: 1, maxLength: 8 }),
        (edges) => {
          useWorkflowStore.setState({ isDirty: false });
          useWorkflowStore.getState().setEdges(edges as any);
          expect(useWorkflowStore.getState().isDirty).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isDirty becomes false after markClean (simulating successful cloud sync)', () => {
    fc.assert(
      fc.property(
        fc.array(arbNode, { minLength: 1, maxLength: 8 }),
        (nodes) => {
          // Simulate modification → dirty
          useWorkflowStore.getState().setNodes(nodes as any);
          expect(useWorkflowStore.getState().isDirty).toBe(true);

          // Simulate cloud sync success → markClean
          useWorkflowStore.getState().markClean();
          expect(useWorkflowStore.getState().isDirty).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isDirty remains true after multiple modifications until markClean', () => {
    fc.assert(
      fc.property(
        fc.array(arbNode, { minLength: 1, maxLength: 5 }),
        fc.array(arbEdge, { minLength: 1, maxLength: 5 }),
        (nodes, edges) => {
          useWorkflowStore.setState({ isDirty: false });

          useWorkflowStore.getState().setNodes(nodes as any);
          useWorkflowStore.getState().setEdges(edges as any);

          // Still dirty — cloud sync hasn't happened
          expect(useWorkflowStore.getState().isDirty).toBe(true);

          // After cloud sync
          useWorkflowStore.getState().markClean();
          expect(useWorkflowStore.getState().isDirty).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
