import {
  buildApiUrl,
  buildAuthHeaders,
  credentialsFetch,
  parseApiError,
} from '@/services/api-client';
import type {
  InteractionToggleResponse,
  WorkflowContent,
  WorkflowMeta,
  WorkflowPublicView,
} from '@/types/workflow';

/**
 * API error that preserves the HTTP status code.
 * Callers can check `err instanceof ApiError && err.status === 401`
 * to distinguish "not authenticated" from other failures.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Discriminated union for fetch operations that may fail silently.
 * Callers can distinguish "genuinely empty data" from "request failed".
 */
export type FetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

interface WorkflowReadOptions<T> {
  token?: string;
  revalidate?: number;
  cache?: RequestCache;
  fallback: T;
  logLabel: string;
  logContext?: string;
  suppressStatuses?: number[];
  unauthorizedMessage?: string;
}

function buildWorkflowReadInit(
  token?: string,
  options: Pick<WorkflowReadOptions<unknown>, 'revalidate' | 'cache'> = {}
) {
  const init: RequestInit & { next?: { revalidate: number } } = {
    headers: buildAuthHeaders(token),
  };

  if (typeof options.revalidate === 'number') {
    init.next = { revalidate: options.revalidate };
  }
  if (options.cache) {
    init.cache = options.cache;
  }

  return init;
}

async function fetchWorkflowRead<T>(
  path: string,
  options: WorkflowReadOptions<T>
): Promise<T> {
  try {
    const response = await fetch(
      buildApiUrl(path),
      buildWorkflowReadInit(options.token, options),
    );

    if (!response.ok) {
      if (options.unauthorizedMessage && response.status === 401) {
        throw new ApiError(options.unauthorizedMessage, 401);
      }

      if (!options.suppressStatuses?.includes(response.status)) {
        if (options.logContext) {
          console.error(`[${options.logLabel}] HTTP ${response.status} for ${options.logContext}`);
        } else {
          console.error(`[${options.logLabel}] HTTP ${response.status}`);
        }
      }
      return options.fallback;
    }

    return (await response.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) {
      throw e;
    }
    console.error(`[${options.logLabel}] network error:`, e);
    return options.fallback;
  }
}

/* ── List (my workflows) ────────────────────────────────────── */

export async function fetchWorkflowList(
  token?: string,
  revalidate = 30
): Promise<WorkflowMeta[]> {
  return fetchWorkflowRead('/api/workflow', {
    token,
    revalidate,
    fallback: [],
    logLabel: 'fetchWorkflowList',
  });
}

/* ── Content (canvas editing) ───────────────────────────────── */

export async function fetchWorkflowContent(
  workflowId: string,
  token?: string
): Promise<WorkflowContent | null> {
  return fetchWorkflowRead(`/api/workflow/${workflowId}/content`, {
    token,
    revalidate: 0,
    fallback: null,
    logLabel: 'fetchWorkflowContent',
    logContext: workflowId,
    unauthorizedMessage: 'Unauthorized',
  });
}

/* ── Update workflow (name, description, tags, is_public) ──── */

export async function updateWorkflow(
  workflowId: string,
  payload: Partial<Pick<WorkflowMeta, 'name' | 'description' | 'tags' | 'is_public'>>
): Promise<WorkflowMeta> {
  const response = await credentialsFetch(`/api/workflow/${workflowId}`, {
    method: 'PUT',
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
  const response = await credentialsFetch(`/api/workflow/${workflowId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, '删除工作流失败'));
  }
}

/* ── Social: Like / Favorite Toggle ─────────────────────────── */

export async function toggleLike(
  workflowId: string
): Promise<InteractionToggleResponse> {
  const response = await credentialsFetch(`/api/workflow/${workflowId}/like`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new ApiError(await parseApiError(response, '点赞操作失败'), response.status);
  }
  return (await response.json()) as InteractionToggleResponse;
}

export async function toggleFavorite(
  workflowId: string
): Promise<InteractionToggleResponse> {
  const response = await credentialsFetch(`/api/workflow/${workflowId}/favorite`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new ApiError(await parseApiError(response, '收藏操作失败'), response.status);
  }
  return (await response.json()) as InteractionToggleResponse;
}

/* ── Public view (no auth required, optionally personalized) ── */

export async function fetchPublicWorkflow(
  workflowId: string,
  token?: string
): Promise<WorkflowPublicView | null> {
  return fetchWorkflowRead(`/api/workflow/${workflowId}/public`, {
    token,
    revalidate: 60,
    fallback: null,
    logLabel: 'fetchPublicWorkflow',
    logContext: workflowId,
    suppressStatuses: [404],
  });
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
): Promise<FetchResult<WorkflowMeta[]>> {
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
    if (!response.ok) {
      const errMsg = await parseApiError(response, `HTTP ${response.status}`);
      return { ok: false, error: errMsg, status: response.status };
    }
    return { ok: true, data: (await response.json()) as WorkflowMeta[] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '网络错误，请检查后端连接';
    return { ok: false, error: msg };
  }
}

/* ── Fork ───────────────────────────────────────────────────── */

export async function forkWorkflow(
  workflowId: string
): Promise<WorkflowMeta> {
  const response = await credentialsFetch(`/api/workflow/${workflowId}/fork`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new ApiError(await parseApiError(response, 'Fork 工作流失败'), response.status);
  }
  return (await response.json()) as WorkflowMeta;
}
