import { buildApiUrl, buildAuthHeaders, parseApiError } from '@/services/api-client';
import type {
  InteractionToggleResponse,
  WorkflowContent,
  WorkflowMeta,
  WorkflowPublicView,
} from '@/types/workflow';

/* ── List (my workflows) ────────────────────────────────────── */

export async function fetchWorkflowList(
  token?: string,
  revalidate = 30
): Promise<WorkflowMeta[]> {
  try {
    const response = await fetch(buildApiUrl('/api/workflow'), {
      headers: buildAuthHeaders(token),
      next: { revalidate },
    });

    if (!response.ok) return [];
    return (await response.json()) as WorkflowMeta[];
  } catch {
    return [];
  }
}

/* ── Content (canvas editing) ───────────────────────────────── */

export async function fetchWorkflowContent(
  workflowId: string,
  token?: string
): Promise<WorkflowContent | null> {
  try {
    const response = await fetch(
      buildApiUrl(`/api/workflow/${workflowId}/content`),
      {
        headers: buildAuthHeaders(token),
        next: { revalidate: 0 },
      }
    );

    if (!response.ok) return null;
    return (await response.json()) as WorkflowContent;
  } catch {
    return null;
  }
}

/* ── Update workflow (name, description, tags, is_public) ──── */

export async function updateWorkflow(
  workflowId: string,
  payload: Partial<Pick<WorkflowMeta, 'name' | 'description' | 'tags' | 'is_public'>>
): Promise<WorkflowMeta> {
  const response = await fetch(`/api/workflow/${workflowId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, '更新工作流失败'));
  }
  return (await response.json()) as WorkflowMeta;
}

/** @deprecated Use updateWorkflow({ name }) instead */
export const renameWorkflow = (id: string, name: string) =>
  updateWorkflow(id, { name });

/* ── Delete ─────────────────────────────────────────────────── */

export async function deleteWorkflow(workflowId: string): Promise<void> {
  const response = await fetch(`/api/workflow/${workflowId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, '删除工作流失败'));
  }
}

/* ── Social: Like / Favorite Toggle ─────────────────────────── */

export async function toggleLike(
  workflowId: string
): Promise<InteractionToggleResponse> {
  const response = await fetch(`/api/workflow/${workflowId}/like`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, '点赞操作失败'));
  }
  return (await response.json()) as InteractionToggleResponse;
}

export async function toggleFavorite(
  workflowId: string
): Promise<InteractionToggleResponse> {
  const response = await fetch(`/api/workflow/${workflowId}/favorite`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, '收藏操作失败'));
  }
  return (await response.json()) as InteractionToggleResponse;
}

/* ── Public view (no auth required, optionally personalized) ── */

export async function fetchPublicWorkflow(
  workflowId: string,
  token?: string
): Promise<WorkflowPublicView | null> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Cookie'] = `access_token=${token}`;
    const response = await fetch(buildApiUrl(`/api/workflow/${workflowId}/public`), {
      headers,
      next: { revalidate: 60 },
    });
    if (!response.ok) return null;
    return (await response.json()) as WorkflowPublicView;
  } catch {
    return null;
  }
}

/* ── Marketplace ────────────────────────────────────────────── */

interface MarketplaceParams {
  filter?: 'official' | 'public' | 'featured';
  search?: string;
  tags?: string[];
  sort?: 'likes' | 'newest' | 'favorites';
  page?: number;
  limit?: number;
}

export async function fetchMarketplace(
  params: MarketplaceParams = {}
): Promise<WorkflowMeta[]> {
  const qs = new URLSearchParams();
  if (params.filter) qs.set('filter', params.filter);
  if (params.search) qs.set('search', params.search);
  if (params.tags?.length) qs.set('tags', params.tags.join(','));
  if (params.sort) qs.set('sort', params.sort);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));

  try {
    const response = await fetch(
      buildApiUrl(`/api/workflow/marketplace?${qs.toString()}`),
      { cache: 'no-store' }
    );
    if (!response.ok) return [];
    return (await response.json()) as WorkflowMeta[];
  } catch {
    return [];
  }
}

/* ── Fork ───────────────────────────────────────────────────── */

export async function forkWorkflow(
  workflowId: string
): Promise<WorkflowMeta> {
  const response = await fetch(`/api/workflow/${workflowId}/fork`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Fork 工作流失败'));
  }
  return (await response.json()) as WorkflowMeta;
}
