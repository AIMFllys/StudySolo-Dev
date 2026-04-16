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
  getNodeManifest,
  invalidateNodeManifestCache,
  peekNodeManifestCache,
} from '@/services/node-manifest.service';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('node manifest service', () => {
  beforeEach(() => {
    authedFetchMock.mockReset();
    parseApiErrorMock.mockReset();
    parseApiErrorMock.mockResolvedValue('加载节点能力清单失败');
    invalidateNodeManifestCache();
  });

  afterEach(() => {
    invalidateNodeManifestCache();
    vi.restoreAllMocks();
  });

  it('preserves manifest contract fields in the cached payload', async () => {
    const payload = [
      {
        type: 'quiz_gen',
        category: 'generation',
        display_name: '测验生成',
        description: '生成测验题目',
        is_llm_node: true,
        output_format: 'json',
        icon: '📝',
        color: '#ef4444',
        config_schema: [],
        output_capabilities: ['preview'],
        supports_upload: false,
        supports_preview: true,
        deprecated_surface: null,
        renderer: 'QuizRenderer',
        version: '1.0.0',
        changelog: { '1.0.0': '初始版本' },
        model_source: 'catalog',
        agent_name: null,
      },
    ];
    authedFetchMock.mockResolvedValueOnce(jsonResponse(payload));

    const manifest = await getNodeManifest();

    expect(manifest).toEqual(payload);
    expect(peekNodeManifestCache()).toEqual(payload);
    expect(authedFetchMock).toHaveBeenCalledWith('/api/nodes/manifest');
  });

  it('reuses the in-memory cache for repeated reads', async () => {
    const payload = [
      {
        type: 'summary',
        category: 'generation',
        display_name: '总结归纳',
        description: '生成简洁的学习总结',
        is_llm_node: true,
        output_format: 'markdown',
        icon: '📝',
        color: '#f59e0b',
        config_schema: [],
        output_capabilities: [],
        supports_upload: false,
        supports_preview: true,
        deprecated_surface: null,
        renderer: null,
        version: '1.0.0',
        changelog: { '1.0.0': '初始版本' },
        model_source: 'catalog',
        agent_name: null,
      },
    ];
    authedFetchMock.mockResolvedValueOnce(jsonResponse(payload));

    await getNodeManifest();
    const second = await getNodeManifest();

    expect(second).toEqual(payload);
    expect(authedFetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces API errors through parseApiError', async () => {
    authedFetchMock.mockResolvedValueOnce(new Response('bad request', { status: 400 }));
    parseApiErrorMock.mockResolvedValueOnce('manifest failed');

    await expect(getNodeManifest()).rejects.toThrow('manifest failed');
    expect(parseApiErrorMock).toHaveBeenCalledTimes(1);
  });
});
