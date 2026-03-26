import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

const { authedFetchMock, parseApiErrorMock } = vi.hoisted(() => ({
  authedFetchMock: vi.fn(),
  parseApiErrorMock: vi.fn(),
}));

vi.mock('@/services/api-client', () => ({
  authedFetch: authedFetchMock,
  parseApiError: parseApiErrorMock,
}));

import { getUsageLive, getUsageOverview, getUsageTimeseries } from '@/services/usage.service';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('usage service helpers', () => {
  beforeEach(() => {
    authedFetchMock.mockReset();
    parseApiErrorMock.mockReset();
    authedFetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })));
    parseApiErrorMock.mockResolvedValue('request failed');
  });

  it('serializes overview range directly into the API path', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom('24h', '7d'), async (range) => {
        authedFetchMock.mockClear();

        await getUsageOverview(range);

        expect(authedFetchMock).toHaveBeenCalledTimes(1);
        expect(authedFetchMock.mock.calls[0]?.[0]).toBe(`/api/usage/overview?range=${range}`);
      }),
      { numRuns: 20 }
    );
  });

  it('serializes live window directly into the API path', async () => {
    authedFetchMock.mockClear();

    await getUsageLive('5m');

    expect(authedFetchMock).toHaveBeenCalledTimes(1);
    expect(authedFetchMock.mock.calls[0]?.[0]).toBe('/api/usage/live?window=5m');
  });

  it('serializes timeseries range and source without rewriting values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('24h', '7d'),
        fc.constantFrom('all', 'assistant', 'workflow'),
        async (range, source) => {
          authedFetchMock.mockClear();

          await getUsageTimeseries(range, source);

          expect(authedFetchMock).toHaveBeenCalledTimes(1);
          expect(authedFetchMock.mock.calls[0]?.[0]).toBe(
            `/api/usage/timeseries?range=${range}&source=${source}`
          );
        }
      ),
      { numRuns: 30 }
    );
  });

  it('surfaces parsed API errors from the shared client helper', async () => {
    authedFetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));

    await expect(getUsageOverview('24h')).rejects.toThrow('request failed');
    expect(parseApiErrorMock).toHaveBeenCalledTimes(1);
  });
});
