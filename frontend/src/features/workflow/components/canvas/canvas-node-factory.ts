import { NODE_TYPE_META } from '@/features/workflow/constants/workflow-meta';
import type { CommunityNodeInsertPayload, NodeType } from '@/types';

/** Create default node data for any node type. */
export function createDefaultNodeData(nodeType: string): Record<string, unknown> {
  if (nodeType === 'loop_group') {
    return { label: '循环块', maxIterations: 3, intervalSeconds: 0 };
  }
  if (nodeType === 'trigger_input') {
    return {
      label: '输入触发',
      type: 'trigger_input',
      system_prompt: '',
      model_route: '',
      status: 'pending',
      output: '',
      config: {},
      user_content: '',
    };
  }
  if (nodeType === 'community_node') {
    return {
      label: '社区节点',
      type: nodeType,
      system_prompt: '',
      model_route: '',
      status: 'pending',
      output: '',
      output_format: 'markdown',
      input_hint: '',
      config: {},
    };
  }
  const meta = NODE_TYPE_META[nodeType as NodeType];
  return {
    label: meta?.label ?? nodeType,
    type: nodeType,
    system_prompt: '',
    model_route: '',
    status: 'pending',
    output: '',
    output_format: 'markdown',
    config: {},
  };
}

export function createCommunityNodeData(
  communityNode: CommunityNodeInsertPayload | null | undefined,
): Record<string, unknown> {
  return {
    label: communityNode?.name || '社区节点',
    type: 'community_node',
    system_prompt: '',
    model_route: '',
    status: 'pending',
    output: '',
    config: {},
    community_node_id: communityNode?.id || '',
    community_icon: communityNode?.icon || 'Bot',
    output_format: communityNode?.output_format || 'markdown',
    model_preference: communityNode?.model_preference || 'auto',
    input_hint: communityNode?.input_hint || '',
    description: communityNode?.description || '',
  };
}
