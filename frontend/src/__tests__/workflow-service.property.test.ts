import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

const { credentialsFetchMock, parseApiErrorMock } = vi.hoisted(() => ({
  credentialsFetchMock: vi.fn(),
  parseApiErrorMock: vi.fn(),
}));

vi.mock('@/services/api-client', () => ({
  buildApiUrl: (path: string) => path,
  buildAuthHeaders: () => ({ 'Content-Type': 'application/json' }),
  credentialsFetch: credentialsFetchMock,
  parseApiError: parseApiErrorMock,
}));

import {
  ApiError,
  deleteWorkflow,
  fetchPublicWorkflow,
  fetchWorkflowContent,
  fetchWorkflowList,
  forkWorkflow,
  toggleFavorite,
  toggleLike,
  updateWorkflow,
} from '@/services/workflow.service';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('workflow service mutation helpers', () => {
  beforeEach(() => {
    credentialsFetchMock.mockReset();
    parseApiErrorMock.mockReset();
    parseApiErrorMock.mockResolvedValue('request failed');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('routes updateWorkflow through credentialsFetch with a JSON body', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.string({ minLength: 1, maxLength: 24 }), async (workflowId, name) => {
        credentialsFetchMock.mockClear();
        credentialsFetchMock.mockResolvedValueOnce(jsonResponse({ id: workflowId, name }));

        await updateWorkflow(workflowId, { name });

        expect(credentialsFetchMock).toHaveBeenCalledTimes(1);
        expect(credentialsFetchMock.mock.calls[0]?.[0]).toBe(`/api/workflow/${workflowId}`);
        expect(credentialsFetchMock.mock.calls[0]?.[1]).toMatchObject({
          method: 'PUT',
          body: JSON.stringify({ name }),
          headers: { 'Content-Type': 'application/json' },
        });
      }),
      { numRuns: 40 }
    );
  });

  it('routes deleteWorkflow through credentialsFetch without adding bespoke auth headers', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (workflowId) => {
        credentialsFetchMock.mockClear();
        credentialsFetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

        await deleteWorkflow(workflowId);

        expect(credentialsFetchMock).toHaveBeenCalledTimes(1);
        expect(credentialsFetchMock.mock.calls[0]?.[0]).toBe(`/api/workflow/${workflowId}`);
        expect(credentialsFetchMock.mock.calls[0]?.[1]).toMatchObject({
          method: 'DELETE',
        });
      }),
      { numRuns: 30 }
    );
  });

  it('routes social mutations through credentialsFetch and preserves 401 status in ApiError', async () => {
    const cases = [
      { run: toggleLike, path: '/like', fallback: '点赞操作失败' },
      { run: toggleFavorite, path: '/favorite', fallback: '收藏操作失败' },
      { run: forkWorkflow, path: '/fork', fallback: 'Fork 工作流失败' },
    ] as const;

    for (const testCase of cases) {
      credentialsFetchMock.mockReset();
      parseApiErrorMock.mockReset();
      parseApiErrorMock.mockResolvedValueOnce('unauthorized');
      credentialsFetchMock.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }));

      await expect(testCase.run('wf-1')).rejects.toMatchObject({
        name: 'ApiError',
        message: 'unauthorized',
        status: 401,
      } satisfies Partial<ApiError>);

      expect(credentialsFetchMock).toHaveBeenCalledWith(`/api/workflow/wf-1${testCase.path}`, {
        method: 'POST',
      });
      expect(parseApiErrorMock).toHaveBeenCalledTimes(1);
      expect(parseApiErrorMock).toHaveBeenCalledWith(expect.any(Response), testCase.fallback);
    }
  });

  it('routes workflow list reads through fetch with auth headers and revalidate hints', async () => {
    const fetchMock = vi.fn(async () => jsonResponse([{ id: 'wf-1', name: '测试工作流' }]));
    vi.stubGlobal('fetch', fetchMock);

    const workflows = await fetchWorkflowList('token-1', 15);

    expect(workflows).toEqual([{ id: 'wf-1', name: '测试工作流' }]);
    expect(fetchMock).toHaveBeenCalledWith('/api/workflow', {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 15 },
    });
  });

  it('preserves 401 responses from fetchWorkflowContent as ApiError for server-side retry handling', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })));

    await expect(fetchWorkflowContent('wf-401', 'token-1')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Unauthorized',
      status: 401,
    } satisfies Partial<ApiError>);
  });

  it('suppresses 404 logging for public workflow fetches and returns null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const workflow = await fetchPublicWorkflow('wf-missing', 'token-1');

    expect(workflow).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
