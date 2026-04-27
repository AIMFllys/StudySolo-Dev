/**
 * Property tests for tokens.service.ts — API token CRUD.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock authedFetch before importing the module
const mockFetch = vi.fn();
vi.mock('@/services/api-client', () => ({
  authedFetch: (...args: unknown[]) => mockFetch(...args),
  parseApiError: async (res: Response, fallback: string) => {
    try {
      const body = await res.json();
      return body?.detail ?? fallback;
    } catch {
      return fallback;
    }
  },
}));

import { listApiTokens, createApiToken, deleteApiToken } from '@/services/tokens.service';

function mockResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('listApiTokens', () => {
  it('returns token list on success', async () => {
    const tokens = [{ id: 't1', name: 'test', token_prefix: 'ss_' }];
    mockFetch.mockResolvedValue(mockResponse(tokens));
    const result = await listApiTokens();
    expect(result).toEqual(tokens);
    expect(mockFetch).toHaveBeenCalledWith('/api/tokens');
  });

  it('throws on error', async () => {
    mockFetch.mockResolvedValue(mockResponse({ detail: 'fail' }, false, 500));
    await expect(listApiTokens()).rejects.toThrow();
  });
});

describe('createApiToken', () => {
  it('sends name and returns created token', async () => {
    const created = { id: 't1', name: 'new', token: 'ss_secret' };
    mockFetch.mockResolvedValue(mockResponse(created));
    const result = await createApiToken({ name: 'new' });
    expect(result.token).toBe('ss_secret');
    expect(mockFetch).toHaveBeenCalledWith('/api/tokens', expect.objectContaining({ method: 'POST' }));
  });

  it('sends expires_in_days', async () => {
    mockFetch.mockResolvedValue(mockResponse({ id: 't1', token: 'x' }));
    await createApiToken({ name: 'exp', expires_in_days: 30 });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.expires_in_days).toBe(30);
  });

  it('defaults expires_in_days to null', async () => {
    mockFetch.mockResolvedValue(mockResponse({ id: 't1', token: 'x' }));
    await createApiToken({ name: 'no-exp' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.expires_in_days).toBeNull();
  });
});

describe('deleteApiToken', () => {
  it('calls DELETE endpoint', async () => {
    mockFetch.mockResolvedValue(mockResponse({}, true));
    await deleteApiToken('t1');
    expect(mockFetch).toHaveBeenCalledWith('/api/tokens/t1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('throws on error', async () => {
    mockFetch.mockResolvedValue(mockResponse({ detail: 'not found' }, false, 404));
    await expect(deleteApiToken('bad')).rejects.toThrow();
  });
});
