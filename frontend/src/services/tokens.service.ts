import { authedFetch, parseApiError } from '@/services/api-client';

export interface ApiTokenListItem {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface ApiTokenCreated extends ApiTokenListItem {
  /**
   * Plaintext token, returned **exactly once** by POST /api/tokens.
   * Never persist this in localStorage — users must copy it into their
   * CLI / MCP config immediately.
   */
  token: string;
}

export async function listApiTokens(): Promise<ApiTokenListItem[]> {
  const response = await authedFetch('/api/tokens');
  if (!response.ok) {
    throw new Error(await parseApiError(response, '加载 API Token 列表失败'));
  }
  return response.json();
}

export async function createApiToken(params: {
  name: string;
  expires_in_days?: number | null;
}): Promise<ApiTokenCreated> {
  const response = await authedFetch('/api/tokens', {
    method: 'POST',
    body: JSON.stringify({
      name: params.name,
      expires_in_days: params.expires_in_days ?? null,
    }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, '创建 API Token 失败'));
  }
  return response.json();
}

export async function deleteApiToken(tokenId: string): Promise<void> {
  const response = await authedFetch(`/api/tokens/${tokenId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, '撤销 API Token 失败'));
  }
}
