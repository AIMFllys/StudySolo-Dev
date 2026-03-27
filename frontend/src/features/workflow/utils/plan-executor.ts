import type { CanvasAction } from '@/features/workflow/hooks/use-action-executor';
import type { PlanStep } from '@/features/workflow/utils/parse-plan-xml';

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

export function planStepsToActions(steps: PlanStep[]): CanvasAction[] {
  return steps.reduce<CanvasAction[]>((actions, step) => {
    const operation = normalizeOperation(step.action);
    if (!operation) {
      return actions;
    }

    if (operation === 'ADD_NODE') {
      actions.push({
        operation,
        payload: {
          type: step.nodeType,
          label: step.description,
          anchor_node_id: step.anchor,
        },
      });
      return actions;
    }

    if (operation === 'UPDATE_NODE') {
      if (!step.anchor) {
        return actions;
      }
      actions.push({
        operation,
        target_node_id: step.anchor,
        payload: {
          updates: {
            label: step.description,
          },
        },
      });
      return actions;
    }

    if (operation === 'DELETE_NODE') {
      if (!step.anchor) {
        return actions;
      }
      actions.push({
        operation,
        target_node_id: step.anchor,
        payload: {},
      });
    }

    return actions;
  }, []);
}
