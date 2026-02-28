import { createClient } from '@/utils/supabase/client';

const API_BASE = '';

/** Redirect to /login, preserving current path as ?next= */
function redirectToLogin() {
  if (typeof window === 'undefined') return;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login?next=${next}`;
}

/** Fetch wrapper that auto-redirects on 401 (skipped for auth endpoints) */
async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
  });
  // Don't redirect on 401 for auth endpoints — let the caller handle the error
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    redirectToLogin();
  }
  return res;
}

export interface LoginResult {
  access_token: string;
  user: { id: string; email: string; name?: string; avatar_url?: string; role?: string };
}

export interface UserInfo {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  role?: string;
}

/** Login with email + password. Returns user info on success. */
export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || '登录失败，请检查邮箱和密码');
  }
  return res.json();
}

/** Register a new account. Backend triggers email verification. */
export async function register(email: string, password: string): Promise<{ message: string }> {
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || '注册失败，请重试');
  }
  return res.json();
}

/** Logout — clears HttpOnly cookies on the backend. */
export async function logout(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' });
}

/** Get current authenticated user info. */
export async function getUser(): Promise<UserInfo> {
  const res = await apiFetch('/api/auth/me');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || '获取用户信息失败');
  }
  return res.json();
}

/**
 * Initialize cross-tab logout sync.
 * Call once at app startup (e.g. in root layout or a client component).
 * Listens for Supabase SIGNED_OUT events and redirects all tabs to /login.
 * Returns an unsubscribe function.
 */
export function initCrossTabSync(): () => void {
  const supabase = createClient();
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      redirectToLogin();
    }
  });
  return () => subscription.unsubscribe();
}
