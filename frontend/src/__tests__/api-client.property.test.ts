import { afterEach, describe, expect, it, vi } from 'vitest';

import { credentialsFetch } from '@/services/api-client';

describe('api client request header defaults', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds a default JSON content type for plain JSON requests', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await credentialsFetch('/api/example', {
      method: 'POST',
      body: JSON.stringify({ ok: true }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/\/api\/example$/);
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'include',
      method: 'POST',
      body: JSON.stringify({ ok: true }),
    });
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('does not inject JSON content type when the body is FormData', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const formData = new FormData();
    formData.append('name', '节点');

    await credentialsFetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.has('Content-Type')).toBe(false);
  });

  it('preserves explicitly provided content type headers', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await credentialsFetch('/api/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'hello',
    });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('Content-Type')).toBe('text/plain');
  });
});
