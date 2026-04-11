import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildAuthHeadersMock,
  cookieValues,
  cookiesMock,
} = vi.hoisted(() => {
  const cookieValues = new Map<string, string>();
  const cookiesMock = vi.fn(async () => ({
    get: (name: string) => {
      const value = cookieValues.get(name);
      return value ? { value } : undefined;
    },
  }));

  return {
    buildAuthHeadersMock: vi.fn(),
    cookieValues,
    cookiesMock,
  };
});

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

vi.mock('@/services/api-client', () => ({
  buildApiUrl: (path: string) => path,
  buildAuthHeaders: buildAuthHeadersMock,
}));

import { fetchRunForServer } from '@/services/memory.server.service';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('memory server service', () => {
  beforeEach(() => {
    cookieValues.clear();
    cookiesMock.mockClear();
    buildAuthHeadersMock.mockReset();
    buildAuthHeadersMock.mockImplementation((token?: string) =>
      token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers the authenticated owner endpoint when an access token exists', async () => {
    cookieValues.set('access_token', 'owner-token');
    const fetchMock = vi.fn(async () => jsonResponse({ id: 'run-1', mode: 'owner' }));
    vi.stubGlobal('fetch', fetchMock);

    const run = await fetchRunForServer('run-1');

    expect(run).toEqual({ id: 'run-1', mode: 'owner' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/workflow-runs/run-1', {
      headers: { Authorization: 'Bearer owner-token', 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
    });
  });

  it('falls back to the public endpoint when the owner endpoint is unavailable', async () => {
    cookieValues.set('access_token', 'owner-token');
    const fetchMock = vi.fn(async (path: string) => {
      if (path.endsWith('/public')) {
        return jsonResponse({ id: 'run-1', mode: 'public' });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const run = await fetchRunForServer('run-1');

    expect(run).toEqual({ id: 'run-1', mode: 'public' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/workflow-runs/run-1/public', {
      headers: { Authorization: 'Bearer owner-token', 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
  });
});
