import { describe, expect, it } from 'vitest';

import { buildChatStreamRequestBody } from '@/features/workflow/hooks/use-stream-chat';

describe('use-stream-chat request body', () => {
  it('keeps current workflow context even when the canvas is empty', () => {
    const body = buildChatStreamRequestBody({
      userInput: '把当前工作流重命名为「Docker 入门」',
      canvasContext: {
        workflowId: 'wf-empty',
        workflowName: '空白工作流',
        nodesSummary: [],
        dagDescription: '',
        selectedNodeId: null,
        executionStatus: null,
        serializedAt: 0,
      },
      history: [],
      mode: 'chat',
      selectedModel: { skuId: null, supportsThinking: null },
      thinkingDepth: 'fast',
    });

    expect(body.canvas_context).toMatchObject({
      workflow_id: 'wf-empty',
      workflow_name: '空白工作流',
      nodes: [],
    });
    expect(body.mode).toBe('chat');
    expect(body.thinking_level).toBe('fast');
  });
});
