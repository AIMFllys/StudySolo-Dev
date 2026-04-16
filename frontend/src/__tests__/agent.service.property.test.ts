import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authedFetchMock, parseApiErrorMock } = vi.hoisted(() => ({
  authedFetchMock: vi.fn(),
  parseApiErrorMock: vi.fn(),
}));

vi.mock('@/services/api-client', () => ({
  authedFetch: authedFetchMock,
  parseApiError: parseApiErrorMock,
}));

import {
  getAgentModels,
  getAgents,
  invalidateAgentCache,
} from '@/services/agent.service';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('agent service', () => {
  beforeEach(() => {
    authedFetchMock.mockReset();
    parseApiErrorMock.mockReset();
    parseApiErrorMock.mockResolvedValue('加载 Agent 失败');
    invalidateAgentCache();
  });

  afterEach(() => {
    invalidateAgentCache();
    vi.restoreAllMocks();
  });

  it('loads and caches the enabled agent directory', async () => {
    const payload = [
      {
        name: 'code-review',
        description: '代码审查 Agent',
        models: ['code-review-v1'],
        owner: '主系统',
        healthy: true,
        capabilities: ['review'],
        skills_ready: false,
        mcp_ready: false,
      },
    ];
    authedFetchMock.mockResolvedValueOnce(jsonResponse(payload));

    const first = await getAgents();
    const second = await getAgents();

    expect(first).toEqual(payload);
    expect(second).toEqual(payload);
    expect(authedFetchMock).toHaveBeenCalledTimes(1);
    expect(authedFetchMock).toHaveBeenCalledWith('/api/agents');
  });

  it('loads agent models from the dedicated endpoint and reuses the cache per agent', async () => {
    const payload = {
      agent: 'news',
      healthy: true,
      source: 'runtime',
      models: ['last30days-quick', 'last30days'],
    };
    authedFetchMock.mockResolvedValueOnce(jsonResponse(payload));

    const first = await getAgentModels('news');
    const second = await getAgentModels('news');

    expect(first).toEqual(payload);
    expect(second).toEqual(payload);
    expect(authedFetchMock).toHaveBeenCalledTimes(1);
    expect(authedFetchMock).toHaveBeenCalledWith('/api/agents/news/models');
  });
});
