import { authedFetch, parseApiError } from '@/services/api-client';

export type CookieConsentLevel = 'essential' | 'all';

export interface ConsentStatus {
  needs_tos: boolean;
  needs_privacy: boolean;
  needs_cookie_consent: boolean;
  tos_version: string | null;
  cookie_consent_level: CookieConsentLevel | null;
  current_tos_version: string;
  current_privacy_version: string;
}

export async function fetchConsentStatus(): Promise<ConsentStatus> {
  const res = await authedFetch('/api/auth/consent/status');
  if (!res.ok) throw new Error(await parseApiError(res, '获取同意状态失败'));
  return res.json();
}

export async function updateCookieConsent(level: CookieConsentLevel): Promise<void> {
  const res = await authedFetch('/api/auth/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cookie_consent_level: level }),
  });
  if (!res.ok) throw new Error(await parseApiError(res, '保存 Cookie 偏好失败'));
}

export async function resignConsent(opts: {
  agreedToTerms?: boolean;
  agreedToPrivacy?: boolean;
}): Promise<void> {
  const res = await authedFetch('/api/auth/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agreed_to_terms: opts.agreedToTerms,
      agreed_to_privacy: opts.agreedToPrivacy,
    }),
  });
  if (!res.ok) throw new Error(await parseApiError(res, '同意记录保存失败'));
}
