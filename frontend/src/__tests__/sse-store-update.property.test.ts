/**
 * Property 17: SSE 事件驱动 Store 更新
 * Feature: studysolo-mvp, Property 17: SSE 事件驱动 Store 更新
 *
 * For any received SSE event, the Zustand Store must correctly update
 * the corresponding node's state:
 * - node_status → updates status field
 * - node_token → appends to output content
 * - node_done → sets final output and status='done'
 *
 * Validates: Requirements 6.7
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import type { Node } from '@xyflow/react';

const arbNodeStatus = fc.constantFrom('pending' as const, 'running' as const, 'done' as const, 'error' as const);

function makeNode(id: string, status = 'pending', output = ''): Node {
  return {
    id,
    type: 'summary',
    position: { x: 0, y: 0 },
    data: { label: id, system_prompt: '', model_route: '', status, output },
  };
}

describe('Property 17: SSE 事件驱动 Store 更新', () => {
  beforeEach(() => {
    useWorkflowStore.setState({ nodes: [], edges: [], currentWorkflowId: null, isDirty: false });
  });

  it('node_status event updates node status correctly', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        arbNodeStatus,
        (nodeId, newStatus) => {
          // Setup: node exists in store
          useWorkflowStore.getState().setNodes([makeNode(nodeId)]);
          useWorkflowStore.setState({ isDirty: false });

          // Simulate node_status event handler
          useWorkflowStore.getState().updateNodeData(nodeId, { status: newStatus });

          const node = useWorkflowStore.getState().nodes.find((n) => n.id === nodeId);
          expect((node?.data as any).status).toBe(newStatus);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('node_token event appends token to output', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (nodeId, existingOutput, token) => {
          // Setup: node with existing output
          useWorkflowStore.getState().setNodes([makeNode(nodeId, 'running', existingOutput)]);
          useWorkflowStore.setState({ isDirty: false });

          // Simulate node_token event handler
          useWorkflowStore.getState().updateNodeData(nodeId, (prev: any) => ({
            output: (prev.output ?? '') + token,
          }));

          const node = useWorkflowStore.getState().nodes.find((n) => n.id === nodeId);
          expect((node?.data as any).output).toBe(existingOutput + token);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('node_done event sets final output and status=done', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 0, maxLength: 200 }),
        (nodeId, finalOutput) => {
          // Setup: node in running state
          useWorkflowStore.getState().setNodes([makeNode(nodeId, 'running', 'partial...')]);
          useWorkflowStore.setState({ isDirty: false });

          // Simulate node_done event handler
          useWorkflowStore.getState().updateNodeData(nodeId, {
            output: finalOutput,
            status: 'done',
          });

          const node = useWorkflowStore.getState().nodes.find((n) => n.id === nodeId);
          expect((node?.data as any).output).toBe(finalOutput);
          expect((node?.data as any).status).toBe('done');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple token events accumulate output correctly', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 20 }),
        (nodeId, tokens) => {
          useWorkflowStore.getState().setNodes([makeNode(nodeId, 'running', '')]);
          useWorkflowStore.setState({ isDirty: false });

          // Simulate receiving multiple node_token events
          for (const token of tokens) {
            useWorkflowStore.getState().updateNodeData(nodeId, (prev: any) => ({
              output: (prev.output ?? '') + token,
            }));
          }

          const node = useWorkflowStore.getState().nodes.find((n) => n.id === nodeId);
          expect((node?.data as any).output).toBe(tokens.join(''));
        }
      ),
      { numRuns: 100 }
    );
  });
});
