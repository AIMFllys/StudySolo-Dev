-- ============================================================
-- Add user consent columns to user_profiles
-- ToS / Privacy Policy / Cookie Consent tracking
-- Migration: 20260327_add_user_consent_columns
-- ============================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS tos_accepted_at        timestamptz,
  ADD COLUMN IF NOT EXISTS tos_version            text DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS privacy_accepted_at    timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_version        text DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS cookie_consent_at      timestamptz,
  ADD COLUMN IF NOT EXISTS cookie_consent_level   text DEFAULT NULL;

-- Add CHECK constraint for cookie_consent_level
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_cookie_consent_level_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_cookie_consent_level_check
  CHECK (cookie_consent_level IS NULL OR cookie_consent_level = ANY(ARRAY['essential','all']));

-- Column comments for documentation
COMMENT ON COLUMN public.user_profiles.tos_accepted_at    IS '用户同意服务条款的时间（NULL=未同意）';
COMMENT ON COLUMN public.user_profiles.tos_version        IS '用户同意的服务条款版本号';
COMMENT ON COLUMN public.user_profiles.privacy_accepted_at IS '用户同意隐私政策的时间（NULL=未同意）';
COMMENT ON COLUMN public.user_profiles.privacy_version    IS '用户同意的隐私政策版本号';
COMMENT ON COLUMN public.user_profiles.cookie_consent_at  IS '用户处理 Cookie 同意的时间（NULL=未处理）';
COMMENT ON COLUMN public.user_profiles.cookie_consent_level IS 'Cookie 同意级别: essential=仅必要 / all=全部接受';
