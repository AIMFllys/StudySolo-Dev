import { beforeEach, describe, expect, it } from 'vitest';
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';
import { executeCanvasActions } from '@/features/workflow/hooks/use-action-executor';

describe('action executor', () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      nodes: [],
      edges: [],
      currentWorkflowId: 'wf-1',
      currentWorkflowName: '测试工作流',
      isDirty: false,
    });
  });

  it('adds Agent nodes as regular canvas nodes when the type is registered', async () => {
    const result = await executeCanvasActions([
      {
        operation: 'ADD_NODE',
        payload: {
          type: 'agent_code_review',
          label: '代码审查 Agent',
          position: { x: 120, y: 120 },
        },
      },
    ]);

    expect(result).toEqual({ success: true, appliedCount: 1 });
    const state = useWorkflowStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0]?.type).toBe('agent_code_review');
    expect((state.nodes[0]?.data as { model_route?: string }).model_route).toBe('');
  });
});
