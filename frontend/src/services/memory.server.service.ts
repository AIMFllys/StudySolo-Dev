/**
 * Memory server service — server-side data fetching for m/[id] route.
 */

import { cookies } from 'next/headers';
import { buildApiUrl, buildAuthHeaders } from '@/services/api-client';
import type { WorkflowRunDetail } from '@/types/memory';

async function getAccessTokenFromCookieStore() {
  const cookieStore = await cookies();
  return cookieStore.get('access_token')?.value;
}

async function withServerAccessToken<T>(runner: (token?: string) => Promise<T>): Promise<T> {
  const token = await getAccessTokenFromCookieStore();
  return runner(token);
}

async function fetchRunDetail(
  path: string,
  token?: string,
  includeCredentials = false,
): Promise<WorkflowRunDetail | null> {
  const res = await fetch(buildApiUrl(path), {
    headers: buildAuthHeaders(token),
    ...(includeCredentials ? { credentials: 'include' as const } : {}),
    cache: 'no-store',
  });
  if (!res.ok) {
    return null;
  }
  return res.json() as Promise<WorkflowRunDetail>;
}

/**
 * Fetch a run's detail for rendering in the m/[id] Server Component.
 *
 * Access logic:
 * 1. If user has a token → try authenticated endpoint (owner access)
 * 2. If no token or authed attempt fails → try public endpoint (shared access)
 * 3. Returns null if both fail → page.tsx shows notFound()
 */
export async function fetchRunForServer(
  runId: string,
): Promise<WorkflowRunDetail | null> {
  return withServerAccessToken(async (token) => {
    if (token) {
      try {
        const ownerRun = await fetchRunDetail(`/api/workflow-runs/${runId}`, token, true);
        if (ownerRun) {
          return ownerRun;
        }
      } catch {
        // Fall through to public access
      }
    }

    try {
      return await fetchRunDetail(`/api/workflow-runs/${runId}/public`, token);
    } catch {
      return null;
    }
  });
}
