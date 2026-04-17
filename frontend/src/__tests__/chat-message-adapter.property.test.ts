import { describe, expect, it } from 'vitest';

import {
  adaptChatMessage,
  extractSuggestMode,
  stripSuggestModeMarker,
} from '@/components/layout/sidebar/chat-message-adapter';
import type { ChatEntry } from '@/stores/chat/use-conversation-store';

function assistant(entry: Partial<ChatEntry>): ChatEntry {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: '',
    timestamp: 1,
    ...entry,
  };
}

describe('chat message adapter', () => {
  it('converts legacy content into thinking and answer segments', () => {
    const model = adaptChatMessage(assistant({
      content: '<think>推理</think>回答 [SUGGEST_MODE:plan]',
    }));

    expect(model.suggestMode).toBe('plan');
    expect(model.hasPlan).toBe(false);
    expect(model.segments).toMatchObject([
      { id: 'msg-1-thinking', kind: 'thinking', text: '推理' },
      { id: 'msg-1-answer', kind: 'answer', text: '回答 [SUGGEST_MODE:plan]' },
    ]);
  });

  it('extracts suggest mode from structured answer segments', () => {
    const model = adaptChatMessage(assistant({
      segments: [
        {
          id: 'seg-answer',
          kind: 'answer',
          text: '请创建节点 [SUGGEST_MODE:create]',
        },
      ],
    }));

    expect(model.suggestMode).toBe('create');
    expect('text' in model.segments[0] ? stripSuggestModeMarker(model.segments[0].text) : '').toBe('请创建节点');
  });

  it('detects plan content and preserves raw plan xml for PlanCard', () => {
    const rawPlan = '<plan><response>规划工作流节点</response></plan>';
    const model = adaptChatMessage(assistant({ content: rawPlan }));

    expect(model.hasPlan).toBe(true);
    expect(model.rawPlanContent).toBe(rawPlan);
  });

  it('keeps Chinese workflow text unchanged while removing markers', () => {
    const text = '工作流 / 节点 / 本轮变更 [SUGGEST_MODE:chat]';

    expect(extractSuggestMode(text)).toBe('chat');
    expect(stripSuggestModeMarker(text)).toBe('工作流 / 节点 / 本轮变更');
  });
});
