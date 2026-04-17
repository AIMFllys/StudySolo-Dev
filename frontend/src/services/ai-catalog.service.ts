import { authedFetch, parseApiError } from '@/services/api-client';
import {
  DEFAULT_MODEL,
  FALLBACK_AI_MODEL_OPTIONS,
  mapCatalogSkuToOption,
  type AIModelOption,
} from '@/features/workflow/constants/ai-models';
import type { TierType } from '@/services/auth.service';
import type { AdminCatalogResponse, AdminCatalogUpdateRequest, AdminCatalogUpdateResponse, UserCatalogResponse } from '@/types/ai-catalog';
import { adminFetch } from '@/services/admin.service';

// Track A: Chat panel model definition
export interface ChatModelOption {
  key: string;
  displayName: string;
  requiredTier: TierType;
  sortOrder: number;
  brandColor: string;
  description: string;
  hasFallback: boolean;
  isRecommended: boolean;
  isPremium: boolean;
  isAccessible: boolean;
  skuId: string | null;
  supportsThinking: boolean;
}

// Track A: Fetch curated chat panel model list from dedicated endpoint
export async function getChatModelList(): Promise<ChatModelOption[]> {
  const response = await authedFetch('/api/ai/chat/models');
  if (!response.ok) {
    throw new Error(await parseApiError(response, '加载对话模型列表失败'));
  }
  const data = await response.json() as { models: ChatModelOption[] };
  return data.models ?? [];
}

export function chooseDefaultChatModel(
  models: ChatModelOption[],
  previous: ChatModelOption | null = null,
): ChatModelOption | null {
  if (previous) return previous;
  const sorted = [...models].sort((a, b) => a.sortOrder - b.sortOrder);
  const accessible = sorted.filter((m) => m.isAccessible);
  return (
    accessible.find((m) => !m.supportsThinking) ??
    accessible[0] ??
    sorted[0] ??
    null
  );
}

export async function getUserAiModelCatalog(): Promise<AIModelOption[]> {
  const response = await authedFetch('/api/ai/models/catalog');
  if (!response.ok) {
    throw new Error(await parseApiError(response, '加载 AI 模型目录失败'));
  }
  const data = await response.json() as UserCatalogResponse;
  const items = (data.items ?? []).map(mapCatalogSkuToOption);
  return items.length > 0 ? items : FALLBACK_AI_MODEL_OPTIONS;
}

export async function getAdminAiModelCatalog() {
  const data = await adminFetch<AdminCatalogResponse>('/models/catalog');
  return data.items ?? [];
}

export async function updateAdminAiModelCatalogItem(skuId: string, payload: AdminCatalogUpdateRequest) {
  return adminFetch<AdminCatalogUpdateResponse>(`/models/${skuId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function getDefaultAiModel(options: AIModelOption[]): AIModelOption {
  return options[0] ?? DEFAULT_MODEL;
}
