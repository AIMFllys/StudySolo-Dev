import { describe, expect, it } from 'vitest';

import {
  chooseDefaultChatModel,
  type ChatModelOption,
} from '@/services/ai-catalog.service';

function model(
  key: string,
  overrides: Partial<ChatModelOption> = {},
): ChatModelOption {
  return {
    key,
    displayName: key,
    requiredTier: 'free',
    sortOrder: 1,
    brandColor: '#000000',
    description: '',
    hasFallback: false,
    isRecommended: false,
    isPremium: false,
    isAccessible: true,
    skuId: key,
    supportsThinking: false,
    ...overrides,
  };
}

describe('chat model default selection', () => {
  it('prefers the first accessible non-thinking model by sort order', () => {
    const picked = chooseDefaultChatModel([
      model('r1', { sortOrder: 1, supportsThinking: true }),
      model('locked-fast', { sortOrder: 2, isAccessible: false }),
      model('qwen-fast', { sortOrder: 3, supportsThinking: false }),
    ]);

    expect(picked?.key).toBe('qwen-fast');
  });

  it('falls back to accessible thinking models, then any model', () => {
    expect(chooseDefaultChatModel([
      model('r1', { sortOrder: 1, supportsThinking: true }),
    ])?.key).toBe('r1');

    expect(chooseDefaultChatModel([
      model('locked', { sortOrder: 1, isAccessible: false }),
    ])?.key).toBe('locked');
  });

  it('keeps the existing selection when one is already set', () => {
    const previous = model('previous', { sortOrder: 99, supportsThinking: true });
    const picked = chooseDefaultChatModel([
      model('qwen-fast', { sortOrder: 1 }),
    ], previous);

    expect(picked).toBe(previous);
  });
});
