-- ============================================================
-- Phase 1: Seed missing chat_models SKUs + required families
-- Resolves: config.yaml chat_models references 6 SKU IDs that
-- do not exist in ai_model_skus, causing brandColor fallback,
-- identity injection failure, and usage tracking gaps.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Insert new families required by the new SKUs
-- ────────────────────────────────────────────────────────────
INSERT INTO public.ai_model_families (id, vendor, family_name, task_family, routing_policy, description, is_enabled)
VALUES
  ('zhipu_premium',       'zhipu',    'GLM Premium',          'premium_chat', 'native_first',    'GLM 旗舰级模型（GLM-5 / GLM-4.7 等），优先智谱原生。',  true),
  ('doubao_premium',      'doubao',   'Doubao Premium',       'premium_chat', 'proxy_first',     '豆包旗舰 Seed 系列，优先聚合平台后回火山原生。',          true),
  ('kimi_reasoning',      'moonshot', 'Kimi Reasoning',       'reasoning',    'native_first',    '月之暗面推理与深度思考模型，优先原生。',                   true),
  ('openai_oss',          'openai',   'OpenAI OSS',           'premium_chat', 'proxy_first',     'OpenAI 开放权重模型（GPT-OSS 系列），走七牛代理。',        true)
ON CONFLICT (id) DO UPDATE SET
  vendor        = EXCLUDED.vendor,
  family_name   = EXCLUDED.family_name,
  task_family   = EXCLUDED.task_family,
  routing_policy= EXCLUDED.routing_policy,
  description   = EXCLUDED.description,
  is_enabled    = EXCLUDED.is_enabled,
  updated_at    = now();

-- ────────────────────────────────────────────────────────────
-- 2. Insert the 7 missing SKU records
--    (6 primary + 1 fallback for doubao_seed)
-- ────────────────────────────────────────────────────────────
INSERT INTO public.ai_model_skus (
  id,
  family_id,
  provider,
  model_id,
  display_name,
  billing_channel,
  required_tier,
  is_enabled,
  is_visible,
  is_user_selectable,
  is_fallback_only,
  supports_thinking,
  max_context_tokens,
  input_price_cny_per_million,
  output_price_cny_per_million,
  price_source,
  pricing_verified_at,
  sort_order
)
VALUES
  -- Qwen3.5-Flash via DashScope (百炼原生)
  (
    'sku_dashscope_qwen35_flash_native',
    'qwen_budget_chat',
    'dashscope',
    'qwen3.5-flash',
    'Qwen3.5-Flash（百炼）',
    'native',
    'free',
    true, true, true, false,
    true,          -- supports thinking mode
    1048576,       -- 1M context
    0.2000,        -- 0.2元/百万 input (≤128K)
    2.0000,        -- 2元/百万 output (≤128K)
    '阿里云百炼官方定价 2026-03',
    timezone('utc', now()),
    25
  ),

  -- GLM-4.5 via Zhipu (智谱原生，免费 tier)
  (
    'sku_zhipu_glm_45_native',
    'zhipu_budget_chat',
    'zhipu',
    'glm-4.5-air',
    'GLM-4.5（智谱）',
    'native',
    'free',
    true, true, true, false,
    false,
    131072,
    0.8000,        -- 0.8元/百万 input
    6.0000,        -- 6元/百万 output
    '百炼第三方 GLM 官方定价 2026-03',
    timezone('utc', now()),
    105
  ),

  -- GLM-4.7 (GLM-5) via Zhipu (智谱旗舰)
  (
    'sku_zhipu_glm_47_native',
    'zhipu_premium',
    'zhipu',
    'glm-5',
    'GLM-5（智谱旗舰）',
    'native',
    'pro',
    true, true, true, false,
    true,          -- supports thinking
    202000,
    4.0000,        -- 4元/百万 input (≤32K)
    18.0000,       -- 18元/百万 output (≤32K)
    '百炼第三方 GLM-5 官方定价 2026-03',
    timezone('utc', now()),
    106
  ),

  -- Doubao Seed 2.0 Lite via Qiniu proxy (七牛代理，首选)
  (
    'sku_qiniu_doubao_seed_lite_proxy',
    'doubao_premium',
    'qiniu',
    'doubao-seed-1.6',
    'DouBao Seed 1.6（七牛）',
    'proxy',
    'pro',
    true, true, true, false,
    false,
    131072,
    0.6000,        -- 0.0006元/K → 0.6元/百万
    3.6000,        -- 0.0036元/K → 3.6元/百万
    '七牛云模型广场 Doubao Seed 1.6 2026 参考价',
    timezone('utc', now()),
    85
  ),

  -- Doubao Seed 2.0 via Volcengine (火山原生，doubao_seed 降级链)
  (
    'sku_volcengine_doubao_seed_native',
    'doubao_premium',
    'volcengine',
    'Doubao Seed 2.0 Lite',
    'DouBao Seed 2.0 Lite（火山）',
    'native',
    'pro',
    true, false, false, true,   -- fallback only
    false,
    131072,
    0.6000,
    3.6000,
    '火山引擎 Doubao Seed 2.0 Lite 参考价（降级通道）',
    NULL,
    86
  ),

  -- Kimi K2 via Moonshot native (月之暗面推理)
  (
    'sku_moonshot_kimi_k2_native',
    'kimi_reasoning',
    'moonshot',
    'kimi-k2.5',
    'Kimi K2.5（原生）',
    'native',
    'pro',
    true, true, true, false,
    true,          -- supports thinking
    262144,
    4.0000,        -- 0.004元/K
    21.0000,       -- 0.021元/K
    'Moonshot 官方 Kimi K2.5 定价',
    timezone('utc', now()),
    135
  ),

  -- GPT-OSS-120B via Qiniu proxy (Mapping to openai/gpt-5.4 available on Qnaigc)
  (
    'sku_qiniu_gpt_oss_120b_proxy',
    'openai_oss',
    'qiniu',
    'openai/gpt-5.4',
    'GPT-5.4（七牛代理）',
    'proxy',
    'pro',
    true, true, true, false,
    false,
    131072,
    1.0800,        -- 0.00108元/K → 1.08元/百万
    5.4000,        -- 0.0054元/K → 5.4元/百万
    '七牛云模型广场 GPT-5.4 2026 参考价',
    timezone('utc', now()),
    175
  )

ON CONFLICT (id) DO UPDATE SET
  family_id                   = EXCLUDED.family_id,
  provider                    = EXCLUDED.provider,
  model_id                    = EXCLUDED.model_id,
  display_name                = EXCLUDED.display_name,
  billing_channel             = EXCLUDED.billing_channel,
  required_tier               = EXCLUDED.required_tier,
  is_enabled                  = EXCLUDED.is_enabled,
  is_visible                  = EXCLUDED.is_visible,
  is_user_selectable          = EXCLUDED.is_user_selectable,
  is_fallback_only            = EXCLUDED.is_fallback_only,
  supports_thinking           = EXCLUDED.supports_thinking,
  max_context_tokens          = EXCLUDED.max_context_tokens,
  input_price_cny_per_million = EXCLUDED.input_price_cny_per_million,
  output_price_cny_per_million= EXCLUDED.output_price_cny_per_million,
  price_source                = EXCLUDED.price_source,
  pricing_verified_at         = EXCLUDED.pricing_verified_at,
  sort_order                  = EXCLUDED.sort_order,
  updated_at                  = now();
