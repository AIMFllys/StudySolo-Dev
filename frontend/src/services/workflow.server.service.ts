import { cookies } from 'next/headers';
import {
  ApiError,
  fetchPublicWorkflow,
  fetchWorkflowContent,
  fetchWorkflowList,
} from '@/services/workflow.service';
import type { WorkflowContent, WorkflowMeta, WorkflowPublicView } from '@/types/workflow';
import { buildApiUrl, buildAuthHeaders } from '@/services/api-client';

async function getAccessTokenFromCookieStore() {
  const cookieStore = await cookies();
  return cookieStore.get('access_token')?.value;
}

/**
 * Attempt to refresh the access token server-side using the refresh_token cookie.
 * Returns the new access_token or undefined if refresh failed.
 */
async function tryServerRefresh(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;
  if (!refreshToken) return undefined;

  try {
    // Forward refresh_token and remember_me cookies to the backend refresh endpoint
    const cookieParts = [`refresh_token=${refreshToken}`];
    const rememberMe = cookieStore.get('remember_me')?.value;
    if (rememberMe) cookieParts.push(`remember_me=${rememberMe}`);

    const res = await fetch(buildApiUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieParts.join('; ') },
      cache: 'no-store',
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.access_token ?? undefined;
  } catch {
    return undefined;
  }
}

export async function fetchWorkflowListForServer(): Promise<WorkflowMeta[]> {
  const token = await getAccessTokenFromCookieStore();
  return fetchWorkflowList(token, 30);
}

export async function fetchWorkflowContentForServer(
  workflowId: string
): Promise<WorkflowContent | null> {
  const token = await getAccessTokenFromCookieStore();
  try {
    return await fetchWorkflowContent(workflowId, token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      // Token expired — try refreshing and retry once
      const freshToken = await tryServerRefresh();
      if (freshToken) {
        try {
          return await fetchWorkflowContent(workflowId, freshToken);
        } catch {
          return null;
        }
      }
    }
    return null;
  }
}

export async function fetchPublicWorkflowForServer(
  workflowId: string
): Promise<WorkflowPublicView | null> {
  const token = await getAccessTokenFromCookieStore();
  return fetchPublicWorkflow(workflowId, token);
}

export interface UserWorkflowQuota {
  tier: string;
  workflows_used: number;
  workflows_base_limit: number;
  workflows_addon_qty: number;
  workflows_total: number;
  workflows_remaining: number;
  // Daily quotas
  daily_chat_used: number;
  daily_chat_limit: number;
  daily_execution_used: number;
  daily_execution_limit: number;
}


export async function fetchUserQuotaForServer(): Promise<UserWorkflowQuota | null> {
  const token = await getAccessTokenFromCookieStore();
  if (!token) return null;
  try {
    const res = await fetch(buildApiUrl('/api/usage/quota'), {
      headers: buildAuthHeaders(token),
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json() as Promise<UserWorkflowQuota>;
  } catch {
    return null;
  }
}
