import type { Node } from '@xyflow/react';
import type { CanvasAction } from '@/features/workflow/hooks/use-action-executor';
import type { PlanStep } from '@/features/workflow/utils/parse-plan-xml';
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';

const VALID_OPERATIONS = new Set<CanvasAction['operation']>([
  'ADD_NODE',
  'DELETE_NODE',
  'UPDATE_NODE',
  'ADD_EDGE',
  'DELETE_EDGE',
  'COPY_NODE',
]);

function normalizeOperation(action: string): CanvasAction['operation'] | null {
  const normalized = action.trim().toUpperCase() as CanvasAction['operation'];
  return VALID_OPERATIONS.has(normalized) ? normalized : null;
}

/**
 * Resolve an anchor string (which may be an id OR a label) into an actual node
 * id from the current canvas. Returns `undefined` if no match can be made so
 * callers can decide to skip the action instead of pointing at a ghost id.
 */
function resolveAnchorId(anchor: string | undefined): string | undefined {
  if (!anchor) return undefined;
  const nodes: Node[] = useWorkflowStore.getState().nodes;
  // Exact id match first.
  if (nodes.some((n) => n.id === anchor)) return anchor;
  // Exact label match.
  const byLabel = nodes.find(
    (n) => (n.data as { label?: string } | undefined)?.label === anchor,
  );
  if (byLabel) return byLabel.id;
  // Case-insensitive / substring fallback.
  const lower = anchor.toLowerCase();
  const fuzzy = nodes.find((n) => {
    const lbl = ((n.data as { label?: string } | undefined)?.label ?? '').toLowerCase();
    return lbl === lower || lbl.includes(lower) || lower.includes(lbl);
  });
  return fuzzy?.id;
}

export function planStepsToActions(steps: PlanStep[]): CanvasAction[] {
  return steps.reduce<CanvasAction[]>((actions, step) => {
    const operation = normalizeOperation(step.action);
    if (!operation) {
      return actions;
    }

    if (operation === 'ADD_NODE') {
      const resolvedAnchor = resolveAnchorId(step.anchor);
      actions.push({
        operation,
        payload: {
          type: step.nodeType,
          label: step.description,
          anchor_node_id: resolvedAnchor,
        },
      });
      return actions;
    }

    if (operation === 'UPDATE_NODE') {
      const resolved = resolveAnchorId(step.anchor);
      if (!resolved) {
        return actions;
      }
      actions.push({
        operation,
        target_node_id: resolved,
        payload: {
          updates: {
            label: step.description,
          },
        },
      });
      return actions;
    }

    if (operation === 'DELETE_NODE') {
      const resolved = resolveAnchorId(step.anchor);
      if (!resolved) {
        return actions;
      }
      actions.push({
        operation,
        target_node_id: resolved,
        payload: {},
      });
    }

    return actions;
  }, []);
}
