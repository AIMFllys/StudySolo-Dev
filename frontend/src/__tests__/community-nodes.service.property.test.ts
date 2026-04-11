import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authedFetchMock, parseApiErrorMock } = vi.hoisted(() => ({
  authedFetchMock: vi.fn(),
  parseApiErrorMock: vi.fn(),
}));

vi.mock('@/services/api-client', () => ({
  authedFetch: authedFetchMock,
  parseApiError: parseApiErrorMock,
}));

import { publishCommunityNode } from '@/services/community-nodes.service';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('community nodes service', () => {
  beforeEach(() => {
    authedFetchMock.mockReset();
    parseApiErrorMock.mockReset();
    parseApiErrorMock.mockResolvedValue('request failed');
  });

  it('routes community node publishing through authedFetch with FormData', async () => {
    authedFetchMock.mockResolvedValueOnce(jsonResponse({ id: 'node-1' }));

    await publishCommunityNode({
      name: '测试节点',
      description: '说明',
      icon: 'sparkles',
      category: 'generation',
      prompt: 'do work',
      input_hint: 'hint',
      output_format: 'markdown',
      model_preference: 'gpt-4.1',
      output_schema: { type: 'object' },
    });

    expect(authedFetchMock).toHaveBeenCalledTimes(1);
    expect(authedFetchMock.mock.calls[0]?.[0]).toBe('/api/community-nodes');
    expect(authedFetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: expect.any(FormData),
    });

    const body = authedFetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get('name')).toBe('测试节点');
    expect(body.get('description')).toBe('说明');
    expect(body.get('category')).toBe('generation');
    expect(body.get('output_schema')).toBe(JSON.stringify({ type: 'object' }));
  });
});
