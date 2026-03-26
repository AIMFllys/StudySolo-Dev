-- ============================================================
-- Upgrade AI catalog to family + SKU model and switch usage
-- billing snapshots to CNY-per-million-token accounting.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_model_families (
  id text PRIMARY KEY,
  vendor text NOT NULL,
  family_name text NOT NULL,
  task_family text NOT NULL,
  routing_policy text NOT NULL,
  description text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_model_families ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_model_families_service_only ON public.ai_model_families FOR ALL USING (false);
CREATE TRIGGER ai_model_families_updated_at
BEFORE UPDATE ON public.ai_model_families
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.ai_model_skus (
  id text PRIMARY KEY,
  family_id text NOT NULL REFERENCES public.ai_model_families(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model_id text NOT NULL,
  display_name text NOT NULL,
  billing_channel text NOT NULL,
  required_tier text NOT NULL DEFAULT 'free',
  is_enabled boolean NOT NULL DEFAULT true,
  is_visible boolean NOT NULL DEFAULT true,
  is_user_selectable boolean NOT NULL DEFAULT true,
  is_fallback_only boolean NOT NULL DEFAULT false,
  supports_thinking boolean NOT NULL DEFAULT false,
  max_context_tokens integer,
  input_price_cny_per_million numeric(12,4) NOT NULL DEFAULT 0,
  output_price_cny_per_million numeric(12,4) NOT NULL DEFAULT 0,
  price_source text,
  pricing_verified_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_model_skus_provider_model_key UNIQUE (provider, model_id),
  CONSTRAINT ai_model_skus_required_tier_check CHECK (
    required_tier = ANY (ARRAY['free'::text, 'pro'::text, 'pro_plus'::text, 'ultra'::text])
  ),
  CONSTRAINT ai_model_skus_billing_channel_check CHECK (
    billing_channel = ANY (ARRAY['native'::text, 'proxy'::text, 'tool_service'::text])
  )
);
ALTER TABLE public.ai_model_skus ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_model_skus_service_only ON public.ai_model_skus FOR ALL USING (false);
CREATE INDEX IF NOT EXISTS idx_ai_model_skus_family_id ON public.ai_model_skus (family_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_skus_provider ON public.ai_model_skus (provider);
CREATE INDEX IF NOT EXISTS idx_ai_model_skus_visible ON public.ai_model_skus (is_visible, is_user_selectable, required_tier);
CREATE TRIGGER ai_model_skus_updated_at
BEFORE UPDATE ON public.ai_model_skus
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.ai_models IS 'Deprecated compatibility source. New AI catalog authority lives in ai_model_families + ai_model_skus.';

ALTER TABLE public.ss_ai_usage_events
  ADD COLUMN IF NOT EXISTS sku_id text,
  ADD COLUMN IF NOT EXISTS family_id text,
  ADD COLUMN IF NOT EXISTS vendor text,
  ADD COLUMN IF NOT EXISTS billing_channel text,
  ADD COLUMN IF NOT EXISTS input_price_cny_per_million numeric(12,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_price_cny_per_million numeric(12,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_amount_cny numeric(14,6) DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ss_ai_usage_events_sku_id_fkey'
  ) THEN
    ALTER TABLE public.ss_ai_usage_events
      ADD CONSTRAINT ss_ai_usage_events_sku_id_fkey
      FOREIGN KEY (sku_id) REFERENCES public.ai_model_skus(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ss_ai_usage_events_family_id_fkey'
  ) THEN
    ALTER TABLE public.ss_ai_usage_events
      ADD CONSTRAINT ss_ai_usage_events_family_id_fkey
      FOREIGN KEY (family_id) REFERENCES public.ai_model_families(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ss_ai_usage_events_sku_id ON public.ss_ai_usage_events (sku_id);
CREATE INDEX IF NOT EXISTS idx_ss_ai_usage_events_family_id ON public.ss_ai_usage_events (family_id);
CREATE INDEX IF NOT EXISTS idx_ss_ai_usage_events_vendor ON public.ss_ai_usage_events (vendor);

ALTER TABLE public.ss_ai_usage_minute
  ADD COLUMN IF NOT EXISTS sku_id text NOT NULL DEFAULT '__request__',
  ADD COLUMN IF NOT EXISTS family_id text NOT NULL DEFAULT '__request__',
  ADD COLUMN IF NOT EXISTS vendor text NOT NULL DEFAULT '__request__',
  ADD COLUMN IF NOT EXISTS billing_channel text NOT NULL DEFAULT 'request',
  ADD COLUMN IF NOT EXISTS total_cost_cny numeric(14,6) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ss_ai_usage_minute_sku_id ON public.ss_ai_usage_minute (sku_id);
CREATE INDEX IF NOT EXISTS idx_ss_ai_usage_minute_family_id ON public.ss_ai_usage_minute (family_id);

UPDATE public.ss_ai_usage_events
SET cost_amount_cny = ROUND(COALESCE(cost_amount_usd, 0) * 6.905, 6)
WHERE COALESCE(cost_amount_cny, 0) = 0
  AND COALESCE(cost_amount_usd, 0) > 0;

UPDATE public.ss_ai_usage_minute
SET total_cost_cny = ROUND(COALESCE(total_cost_usd, 0) * 6.905, 6)
WHERE COALESCE(total_cost_cny, 0) = 0
  AND COALESCE(total_cost_usd, 0) > 0;

ALTER TABLE public.ss_ai_usage_minute DROP CONSTRAINT IF EXISTS ss_ai_usage_minute_pkey;
ALTER TABLE public.ss_ai_usage_minute
  ADD CONSTRAINT ss_ai_usage_minute_pkey PRIMARY KEY (minute_bucket, user_id, source_type, source_subtype, sku_id);

CREATE OR REPLACE FUNCTION public.fn_ss_ai_usage_minute_increment(
    p_minute_bucket timestamptz,
    p_user_id uuid,
    p_source_type text,
    p_source_subtype text,
    p_provider text,
    p_model text,
    p_sku_id text,
    p_family_id text,
    p_vendor text,
    p_billing_channel text,
    p_logical_requests integer DEFAULT 0,
    p_provider_calls integer DEFAULT 0,
    p_successful_provider_calls integer DEFAULT 0,
    p_total_tokens integer DEFAULT 0,
    p_total_cost_cny numeric DEFAULT 0,
    p_error_count integer DEFAULT 0,
    p_fallback_count integer DEFAULT 0,
    p_latency_ms_sum bigint DEFAULT 0,
    p_latency_ms_count integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.ss_ai_usage_minute (
        minute_bucket,
        user_id,
        source_type,
        source_subtype,
        provider,
        model,
        sku_id,
        family_id,
        vendor,
        billing_channel,
        logical_requests,
        provider_calls,
        successful_provider_calls,
        total_tokens,
        total_cost_cny,
        error_count,
        fallback_count,
        latency_ms_sum,
        latency_ms_count
    )
    VALUES (
        date_trunc('minute', p_minute_bucket),
        p_user_id,
        p_source_type,
        p_source_subtype,
        p_provider,
        p_model,
        p_sku_id,
        p_family_id,
        p_vendor,
        p_billing_channel,
        p_logical_requests,
        p_provider_calls,
        p_successful_provider_calls,
        p_total_tokens,
        p_total_cost_cny,
        p_error_count,
        p_fallback_count,
        p_latency_ms_sum,
        p_latency_ms_count
    )
    ON CONFLICT (minute_bucket, user_id, source_type, source_subtype, sku_id)
    DO UPDATE SET
        provider = EXCLUDED.provider,
        model = EXCLUDED.model,
        family_id = EXCLUDED.family_id,
        vendor = EXCLUDED.vendor,
        billing_channel = EXCLUDED.billing_channel,
        logical_requests = ss_ai_usage_minute.logical_requests + EXCLUDED.logical_requests,
        provider_calls = ss_ai_usage_minute.provider_calls + EXCLUDED.provider_calls,
        successful_provider_calls = ss_ai_usage_minute.successful_provider_calls + EXCLUDED.successful_provider_calls,
        total_tokens = ss_ai_usage_minute.total_tokens + EXCLUDED.total_tokens,
        total_cost_cny = ss_ai_usage_minute.total_cost_cny + EXCLUDED.total_cost_cny,
        error_count = ss_ai_usage_minute.error_count + EXCLUDED.error_count,
        fallback_count = ss_ai_usage_minute.fallback_count + EXCLUDED.fallback_count,
        latency_ms_sum = ss_ai_usage_minute.latency_ms_sum + EXCLUDED.latency_ms_sum,
        latency_ms_count = ss_ai_usage_minute.latency_ms_count + EXCLUDED.latency_ms_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_ss_ai_usage_minute_increment(
    timestamptz,
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    integer,
    integer,
    integer,
    integer,
    numeric,
    integer,
    integer,
    bigint,
    integer
) TO service_role;

INSERT INTO public.ai_model_families (id, vendor, family_name, task_family, routing_policy, description, is_enabled)
VALUES
  ('deepseek_budget_chat', 'deepseek', 'DeepSeek Budget Chat', 'cheap_chat', 'native_first', '低成本日常对话与轻量任务，优先使用 DeepSeek 原生。', true),
  ('deepseek_reasoning', 'deepseek', 'DeepSeek Reasoning', 'reasoning', 'native_first', '低成本深度推理，优先使用 DeepSeek 原生。', true),
  ('qwen_budget_chat', 'qwen', 'Qwen Budget Chat', 'cheap_chat', 'native_first', '通义千问非 Max 系模型，优先使用阿里云百炼原生。', true),
  ('qwen_premium', 'qwen', 'Qwen Premium', 'premium_chat', 'proxy_first', '高价旗舰 Qwen 族，优先走聚合平台再回原生。', true),
  ('doubao_budget_chat', 'doubao', 'Doubao Budget Chat', 'cheap_chat', 'native_first', '豆包大多数常规模型，优先火山原生。', true),
  ('zhipu_budget_chat', 'zhipu', 'GLM Budget Chat', 'cheap_chat', 'native_first', 'GLM 通用聊天模型，优先智谱原生。', true),
  ('zhipu_ocr', 'zhipu', 'GLM OCR', 'ocr', 'capability_fixed', 'OCR 固定走智谱原生。', true),
  ('kimi_budget_chat', 'moonshot', 'Kimi Budget Chat', 'cheap_chat', 'native_first', 'Kimi 低价模型优先原生。', true),
  ('kimi_long_context', 'moonshot', 'Kimi Long Context', 'premium_chat', 'proxy_first', '长上下文高价 Kimi 模型优先聚合再回原生。', true),
  ('search_hybrid', 'qiniu', 'Hybrid Search', 'search', 'capability_fixed', '搜索主通道走七牛云，预留智谱扩量。', true),
  ('search_expansion_zhipu', 'zhipu', 'Search Expansion', 'search', 'capability_fixed', '搜索扩量与补充结果源。', true)
ON CONFLICT (id) DO UPDATE SET
  vendor = EXCLUDED.vendor,
  family_name = EXCLUDED.family_name,
  task_family = EXCLUDED.task_family,
  routing_policy = EXCLUDED.routing_policy,
  description = EXCLUDED.description,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = now();

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
  ('sku_deepseek_chat_native', 'deepseek_budget_chat', 'deepseek', 'deepseek-chat', 'DeepSeek V3（原生）', 'native', 'free', true, true, true, false, false, 131072, 2.0000, 3.0000, 'DeepSeek 官方定价', timezone('utc', now()), 10),
  ('sku_deepseek_reasoner_native', 'deepseek_reasoning', 'deepseek', 'deepseek-reasoner', 'DeepSeek R1（原生）', 'native', 'pro', true, true, true, false, true, 131072, 2.0000, 3.0000, 'DeepSeek 官方定价', timezone('utc', now()), 20),
  ('sku_dashscope_qwen_turbo_native', 'qwen_budget_chat', 'dashscope', 'qwen-turbo', 'Qwen Turbo（百炼）', 'native', 'free', true, true, true, false, false, 131072, 0.3000, 0.6000, '阿里云百炼官方定价', timezone('utc', now()), 30),
  ('sku_dashscope_qwen_plus_native', 'qwen_budget_chat', 'dashscope', 'qwen-plus', 'Qwen Plus（百炼）', 'native', 'pro', true, true, true, false, true, 131072, 0.8000, 2.0000, '阿里云百炼官方定价', timezone('utc', now()), 40),
  ('sku_dashscope_qwen_max_native', 'qwen_premium', 'dashscope', 'qwen-max', 'Qwen Max（百炼）', 'native', 'ultra', true, false, false, true, true, 262144, 0.0000, 0.0000, 'Pricing pending: 原生高价模型价格待核验。', NULL, 50),
  ('sku_qiniu_qwen3_max_proxy', 'qwen_premium', 'qiniu', 'Qwen3-Max', 'Qwen 3 Max（七牛）', 'proxy', 'pro_plus', true, true, true, false, true, 262144, 6.0000, 24.0000, '七牛云模型广场 2026 参考价', timezone('utc', now()), 60),
  ('sku_siliconflow_qwen_72b_proxy', 'qwen_premium', 'siliconflow', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen 72B（硅基流动）', 'proxy', 'pro_plus', true, false, false, true, false, 32768, 0.0000, 0.0000, 'Pricing pending: SiliconFlow 代理价格待核验。', NULL, 70),
  ('sku_volcengine_doubao_pro_32k_native', 'doubao_budget_chat', 'volcengine', 'Doubao-pro-32k', '豆包 Pro（火山）', 'native', 'free', true, true, true, false, false, 32768, 0.0000, 0.0000, 'Pricing pending: 需映射到最新火山方舟官方模型价格。', NULL, 80),
  ('sku_volcengine_doubao_pro_256k_native', 'doubao_budget_chat', 'volcengine', 'Doubao-pro-256k', '豆包 Pro 256K（火山）', 'native', 'pro', true, true, true, false, true, 262144, 0.0000, 0.0000, 'Pricing pending: 需映射到最新火山方舟官方模型价格。', NULL, 90),
  ('sku_zhipu_glm_4_flash_native', 'zhipu_budget_chat', 'zhipu', 'glm-4-flash', 'GLM-4 Flash（智谱）', 'native', 'free', true, true, true, false, false, 131072, 0.0000, 0.0000, 'Pricing pending: 智谱官方 flash 价格待核验。', NULL, 100),
  ('sku_zhipu_glm_4_native', 'zhipu_budget_chat', 'zhipu', 'glm-4', 'GLM-4（智谱）', 'native', 'pro', true, true, true, false, false, 131072, 0.0000, 0.0000, 'Pricing pending: 智谱官方价格待核验。', NULL, 110),
  ('sku_zhipu_glm_ocr_native', 'zhipu_ocr', 'zhipu', 'glm-ocr', 'GLM OCR（智谱）', 'tool_service', 'free', true, false, false, true, false, 0, 0.2000, 0.2000, '智谱 OCR 官方文档参考价', timezone('utc', now()), 120),
  ('sku_moonshot_v1_8k_native', 'kimi_budget_chat', 'moonshot', 'moonshot-v1-8k', 'Kimi 8K（原生）', 'native', 'free', true, true, true, false, false, 8192, 0.0000, 0.0000, 'Pricing pending: Moonshot 低价模型价格待核验。', NULL, 130),
  ('sku_moonshot_v1_128k_native', 'kimi_long_context', 'moonshot', 'moonshot-v1-128k', 'Kimi 128K（原生）', 'native', 'pro_plus', true, true, true, false, false, 131072, 0.0000, 0.0000, 'Pricing pending: Moonshot 长上下文原生价格待核验。', NULL, 140),
  ('sku_qiniu_kimi_k2_5_proxy', 'kimi_long_context', 'qiniu', 'Kimi-K2.5', 'Kimi K2.5（七牛）', 'proxy', 'pro_plus', true, true, true, false, false, 262144, 4.0000, 21.0000, '七牛云模型广场 2026 参考价', timezone('utc', now()), 150),
  ('sku_qiniu_search_primary', 'search_hybrid', 'qiniu', 'qiniu-search-hybrid', '七牛混合搜索', 'tool_service', 'free', true, false, false, true, false, 0, 36000.0000, 36000.0000, '七牛云 Baidu Search API：0.036元/次，按百万次等效展示。', timezone('utc', now()), 160),
  ('sku_zhipu_search_expansion', 'search_expansion_zhipu', 'zhipu', 'zhipu-search-expansion', '智谱搜索扩量', 'tool_service', 'free', true, false, false, true, false, 0, 0.0000, 0.0000, 'Pricing pending: 智谱搜索扩量价格待核验。', NULL, 170)
ON CONFLICT (id) DO UPDATE SET
  family_id = EXCLUDED.family_id,
  provider = EXCLUDED.provider,
  model_id = EXCLUDED.model_id,
  display_name = EXCLUDED.display_name,
  billing_channel = EXCLUDED.billing_channel,
  required_tier = EXCLUDED.required_tier,
  is_enabled = EXCLUDED.is_enabled,
  is_visible = EXCLUDED.is_visible,
  is_user_selectable = EXCLUDED.is_user_selectable,
  is_fallback_only = EXCLUDED.is_fallback_only,
  supports_thinking = EXCLUDED.supports_thinking,
  max_context_tokens = EXCLUDED.max_context_tokens,
  input_price_cny_per_million = EXCLUDED.input_price_cny_per_million,
  output_price_cny_per_million = EXCLUDED.output_price_cny_per_million,
  price_source = EXCLUDED.price_source,
  pricing_verified_at = EXCLUDED.pricing_verified_at,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
