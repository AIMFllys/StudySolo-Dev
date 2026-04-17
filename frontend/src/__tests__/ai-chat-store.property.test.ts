import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAIChatStore } from '@/stores/chat/use-ai-chat-store';
import { useConversationStore } from '@/stores/chat/use-conversation-store';

describe('ai chat store side-effect boundary', () => {
  beforeEach(() => {
    useAIChatStore.setState({
      input: '',
      loading: false,
      streaming: false,
      streamingMessageId: null,
      error: null,
      history: [],
      mode: 'chat',
      thinkingDepth: 'fast',
      abortController: null,
    });
  });

  it('defaults to fast thinking depth for lightweight chat', () => {
    expect(useAIChatStore.getState().thinkingDepth).toBe('fast');
  });

  it('pushMessage only updates ai chat history and does not touch conversation persistence', () => {
    const createConversation = vi.fn(() => 'conv-1');
    const appendMessage = vi.fn();

    useConversationStore.setState({
      conversations: [],
      activeId: null,
      activeConversation: null,
      createConversation,
      appendMessage,
    });

    const id = useAIChatStore.getState().pushMessage('user', '你好，帮我规划一下');
    const state = useAIChatStore.getState();

    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toMatchObject({
      id,
      role: 'user',
      content: '你好，帮我规划一下',
    });
    expect(createConversation).not.toHaveBeenCalled();
    expect(appendMessage).not.toHaveBeenCalled();
  });
});
