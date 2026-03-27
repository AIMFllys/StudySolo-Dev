import { authedFetch, parseApiError, initCrossTabSync } from '@/services/api-client';

export { initCrossTabSync };

export interface LoginResult {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string; name?: string; avatar_url?: string; role?: string; tier?: string };
}

export interface RegisterResult {
  message: string;
  confirmed: boolean;
}

// Canonical tier values — matches DB CHECK constraint (snake_case)
export type TierType = 'free' | 'pro' | 'pro_plus' | 'ultra';

// Display labels for UI rendering
export const TIER_DISPLAY_LABELS: Record<TierType, string> = {
  free: 'Free',
  pro: 'Pro',
  pro_plus: 'Pro+',
  ultra: 'Ultra',
};

export function getTierLabel(tier: TierType | undefined): string {
  return TIER_DISPLAY_LABELS[tier ?? 'free'];
}

export function isPaidTier(tier: TierType | undefined): boolean {
  return tier !== undefined && tier !== 'free';
}

export interface UserInfo {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  role?: string;
  tier?: TierType;
}

/** Send verification code to email. Requires captcha token. */
export async function sendVerificationCode(
  email: string,
  captchaToken: string,
  codeType: 'register' | 'reset_password' = 'register',
): Promise<{ message: string }> {
  const res = await authedFetch('/api/auth/send-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, captcha_token: captchaToken, code_type: codeType }),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, '验证码发送失败，请重试'));
  }
  return res.json();
}

/** Login with email + password. */
export async function login(
  email: string,
  password: string,
  rememberMe = true,
): Promise<LoginResult> {
  const res = await authedFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, remember_me: rememberMe }),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, '登录失败，请检查邮箱和密码'));
  }
  return res.json();
}

/** Register a new account with email verification code. */
export async function register(
  email: string,
  password: string,
  verificationCode: string,
  name?: string,
  consent?: { agreedToTerms: boolean; agreedToPrivacy: boolean },
): Promise<RegisterResult> {
  const res = await authedFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      verification_code: verificationCode,
      ...(name ? { name } : {}),
      agreed_to_terms: consent?.agreedToTerms ?? false,
      agreed_to_privacy: consent?.agreedToPrivacy ?? false,
    }),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, '注册失败，请重试'));
  }
  return res.json();
}


/** Resend email verification link (legacy). */
export async function resendVerification(email: string): Promise<{ message: string }> {
  const res = await authedFetch('/api/auth/resend-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, '发送失败，请重试'));
  }
  return res.json();
}

/** Logout — clears both backend HttpOnly cookies and Supabase SSR session. */
export async function logout(): Promise<void> {
  const { createClient } = await import('@/utils/supabase/client');
  await authedFetch('/api/auth/logout', { method: 'POST' });
  const supabase = createClient();
  await supabase.auth.signOut();
}

/** Request a password reset email. */
export async function forgotPassword(email: string): Promise<{ message: string }> {
  const res = await authedFetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, '发送失败，请重试'));
  }
  return res.json();
}

/** Reset password using recovery tokens from the email link (legacy). */
export async function resetPassword(
  accessToken: string,
  refreshToken: string,
  newPassword: string
): Promise<{ message: string }> {
  const res = await authedFetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      new_password: newPassword,
    }),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, '重置失败，请重试'));
  }
  return res.json();
}

/** Reset password using email + verification code. */
export async function resetPasswordWithCode(
  email: string,
  code: string,
  newPassword: string,
): Promise<{ message: string }> {
  const res = await authedFetch('/api/auth/reset-password-with-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, new_password: newPassword }),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, '重置失败，请重试'));
  }
  return res.json();
}

/** Get current authenticated user info. */
export async function getUser(): Promise<UserInfo> {
  const res = await authedFetch('/api/auth/me');
  if (!res.ok) {
    throw new Error(await parseApiError(res, '获取用户信息失败'));
  }
  return res.json();
}
