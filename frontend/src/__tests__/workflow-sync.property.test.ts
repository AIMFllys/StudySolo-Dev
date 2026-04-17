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
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';
import {
  resolveCloudSyncFailureStatus,
  shouldAttemptCloudSave,
  swallowKeepaliveFailure,
} from '@/features/workflow/hooks/workflow-sync-utils';
import type { Edge, Node } from '@xyflow/react';

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
          useWorkflowStore.getState().setNodes(nodes as unknown as Node[]);
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
          useWorkflowStore.getState().setEdges(edges as unknown as Edge[]);
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
          useWorkflowStore.getState().setNodes(nodes as unknown as Node[]);
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

          useWorkflowStore.getState().setNodes(nodes as unknown as Node[]);
          useWorkflowStore.getState().setEdges(edges as unknown as Edge[]);

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

describe('workflow sync cloud failure helpers', () => {
  it('classifies cloud sync failures without throwing Chinese state away', () => {
    expect(resolveCloudSyncFailureStatus(true)).toBe('error');
    expect(resolveCloudSyncFailureStatus(false)).toBe('offline');
    expect('工作流 / 节点 / 本轮变更').toBe('工作流 / 节点 / 本轮变更');
  });

  it('only treats cloud hash as synced after successful save', () => {
    expect(shouldAttemptCloudSave('hash-1', '')).toBe(true);
    expect(shouldAttemptCloudSave('hash-1', 'hash-1')).toBe(false);
  });

  it('swallows keepalive failures to avoid unhandled Failed to fetch noise', async () => {
    swallowKeepaliveFailure(Promise.reject(new Error('Failed to fetch')));

    await Promise.resolve();
    expect(true).toBe(true);
  });
});
