import { createClient } from '@/utils/supabase/client';

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, '');
}

/**
 * Resolve the API base URL.
 * - Browser: empty string (relative requests, proxied by next.config rewrites)
 * - Server:  reads INTERNAL_API_BASE_URL / NEXT_PUBLIC_API_BASE_URL
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return '';
  }

  return normalizeBaseUrl(
    process.env.INTERNAL_API_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'http://127.0.0.1:2038'
  );
}

export function buildApiUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}

export function buildAuthHeaders(token?: string): Record<string, string> {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  };
}

function buildRequestHeaders(
  init?: RequestInit,
  token?: string,
): Headers {
  const headers = new Headers(init?.headers);

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const isFormDataBody =
    typeof FormData !== 'undefined' && init?.body instanceof FormData;

  if (!isFormDataBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

/**
 * Parse a non-ok API response into a user-facing error message.
 */
export async function parseApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  if ([500, 502, 503, 504].includes(response.status)) {
    return '后端服务暂不可用，请确认 StudySolo 后端已启动（默认端口 2038）';
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return fallback;
  }

  try {
    const data = await response.json();
    return data.detail || data.error || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Credentials-included fetch with optional auth token header.
 */
export function credentialsFetch(
  path: string,
  init?: RequestInit,
  token?: string,
): Promise<Response> {
  return fetch(buildApiUrl(path), {
    credentials: 'include',
    ...init,
    headers: buildRequestHeaders(init, token),
  });
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  const next = encodeURIComponent(
    window.location.pathname + window.location.search,
  );
  window.location.href = `/login?next=${next}`;
}

let restorePromise: Promise<boolean> | null = null;

async function tryRestoreSession(): Promise<boolean> {
  const { restoreAuthSession } = await import(
    '@/services/auth-session.service'
  );
  return restoreAuthSession();
}

/**
 * Authenticated API fetch with auto-retry on 401.
 * - On 401: attempts to restore the auth session once, then retries.
 * - On second 401: redirects to /login.
 * - Skips retry for auth-related endpoints.
 */
export async function authedFetch(
  path: string,
  init?: RequestInit,
  allowRetry = true,
): Promise<Response> {
  const response = await credentialsFetch(path, init);

  if (response.status !== 401 || path.startsWith('/api/auth/')) {
    return response;
  }

  if (allowRetry) {
    if (!restorePromise) {
      restorePromise = tryRestoreSession().finally(() => {
        restorePromise = null;
      });
    }

    if (await restorePromise) {
      const retriedResponse = await credentialsFetch(path, init);
      if (retriedResponse.status !== 401) {
        return retriedResponse;
      }
    }
  }

  redirectToLogin();
  return response;
}

/**
 * Initialize cross-tab logout sync.
 * Call once at app startup (e.g. in root layout).
 * Returns an unsubscribe function.
 */
export function initCrossTabSync(): () => void {
  try {
    const supabase = createClient();
    if (!supabase) return () => {};
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_OUT') {
        redirectToLogin();
      }
    });
    return () => subscription.unsubscribe();
  } catch (err) {
    console.warn('[initCrossTabSync] Supabase init failed, skipping:', err instanceof Error ? err.message : err);
    return () => {};
  }
}
