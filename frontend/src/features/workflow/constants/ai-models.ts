import type { TierType } from '@/services/auth.service';
import type { CatalogSku } from '@/types/ai-catalog';

export interface AIModelOption {
  skuId: string;
  familyId: string;
  familyName: string;
  provider: string;
  vendor: string;
  modelId: string;
  displayName: string;
  providerName: string;
  brandColor: string;
  billingChannel: CatalogSku['billing_channel'];
  taskFamily: string;
  routingPolicy: CatalogSku['routing_policy'];
  requiredTier: TierType;
  isPremium: boolean;
  isEnabled: boolean;
  isVisible: boolean;
  isUserSelectable: boolean;
  isFallbackOnly: boolean;
  supportsThinking: boolean;
  maxContextTokens: number | null;
  inputPriceCnyPerMillion: number;
  outputPriceCnyPerMillion: number;
  priceSource: string | null;
  pricingVerifiedAt: string | null;
  sortOrder: number;
  description: string;
  platform: string;
  model: string;
}

const PROVIDER_BRAND_COLORS: Record<string, string> = {
  deepseek: '#4D6BFE',
  dashscope: '#F97316',
  volcengine: '#3370FF',
  zhipu: '#2563EB',
  moonshot: '#111827',
  qiniu: '#0082FA',
  siliconflow: '#0F766E',
  compshare: '#7C3AED',
};

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  deepseek: 'DeepSeek',
  dashscope: '通义千问',
  volcengine: '豆包',
  zhipu: '智谱',
  moonshot: 'Kimi',
  qiniu: '七牛云',
  siliconflow: '硅基流动',
  compshare: '优云智算',
};

function buildDescription(item: CatalogSku) {
  const source = item.billing_channel === 'native'
    ? '原生'
    : item.billing_channel === 'proxy'
      ? '聚合'
      : '工具';
  return `${source} · ${item.vendor} · ${item.task_family}`;
}

export function mapCatalogSkuToOption(item: CatalogSku): AIModelOption {
  return {
    skuId: item.sku_id,
    familyId: item.family_id,
    familyName: item.family_name,
    provider: item.provider,
    vendor: item.vendor,
    modelId: item.model_id,
    displayName: item.display_name,
    providerName: PROVIDER_DISPLAY_NAMES[item.provider] ?? item.provider,
    brandColor: PROVIDER_BRAND_COLORS[item.provider] ?? '#4B5563',
    billingChannel: item.billing_channel,
    taskFamily: item.task_family,
    routingPolicy: item.routing_policy,
    requiredTier: item.required_tier,
    isPremium: item.required_tier !== 'free',
    isEnabled: item.is_enabled,
    isVisible: item.is_visible,
    isUserSelectable: item.is_user_selectable,
    isFallbackOnly: item.is_fallback_only,
    supportsThinking: item.supports_thinking,
    maxContextTokens: item.max_context_tokens,
    inputPriceCnyPerMillion: item.input_price_cny_per_million,
    outputPriceCnyPerMillion: item.output_price_cny_per_million,
    priceSource: item.price_source,
    pricingVerifiedAt: item.pricing_verified_at,
    sortOrder: item.sort_order,
    description: buildDescription(item),
    platform: item.provider,
    model: item.model_id,
  };
}

export function compareTier(userTier: TierType | undefined, requiredTier: TierType | undefined): number {
  const order: Record<TierType, number> = {
    free: 0,
    pro: 1,
    pro_plus: 2,
    ultra: 3,
  };
  return (order[userTier ?? 'free'] ?? 0) - (order[requiredTier ?? 'free'] ?? 0);
}

export function canAccessModel(userTier: TierType | undefined, model: AIModelOption): boolean {
  return compareTier(userTier, model.requiredTier) >= 0;
}

export function groupModelsByProvider(options: AIModelOption[]) {
  const groups: Record<string, AIModelOption[]> = {};
  for (const model of options) {
    if (!groups[model.providerName]) {
      groups[model.providerName] = [];
    }
    groups[model.providerName].push(model);
  }
  return groups;
}

// Vendor brand names for Track B (workflow node 2-level menu)
const VENDOR_DISPLAY_NAMES: Record<string, string> = {
  deepseek: 'DeepSeek',
  qwen: '通义千问',
  zhipu: '智谱 GLM',
  doubao: '豆包',
  moonshot: 'Kimi (月之暗面)',
  openai_oss: 'GPT OSS',
};

export function groupModelsByVendor(options: AIModelOption[]): Record<string, AIModelOption[]> {
  const groups: Record<string, AIModelOption[]> = {};
  for (const model of options) {
    const vendorKey = model.vendor ?? 'other';
    const displayVendor = VENDOR_DISPLAY_NAMES[vendorKey] ?? vendorKey;
    (groups[displayVendor] ??= []).push(model);
  }
  return groups;
}

export const FALLBACK_AI_MODEL_OPTIONS: AIModelOption[] = [
  {
    skuId: 'sku_deepseek_chat_native',
    familyId: 'deepseek_budget_chat',
    familyName: 'DeepSeek Budget Chat',
    provider: 'deepseek',
    vendor: 'deepseek',
    modelId: 'deepseek-chat',
    displayName: 'DeepSeek V3',
    providerName: 'DeepSeek',
    brandColor: '#4D6BFE',
    billingChannel: 'native',
    taskFamily: 'cheap_chat',
    routingPolicy: 'native_first',
    requiredTier: 'free',
    isPremium: false,
    isEnabled: true,
    isVisible: true,
    isUserSelectable: true,
    isFallbackOnly: false,
    supportsThinking: false,
    maxContextTokens: 64000,
    inputPriceCnyPerMillion: 0,
    outputPriceCnyPerMillion: 0,
    priceSource: null,
    pricingVerifiedAt: null,
    sortOrder: 10,
    description: '原生 · deepseek · cheap_chat',
    platform: 'deepseek',
    model: 'deepseek-chat',
  },
];

export const DEFAULT_MODEL = FALLBACK_AI_MODEL_OPTIONS[0];
