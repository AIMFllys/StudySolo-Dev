ALTER TABLE public.verification_codes_v2
ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;

UPDATE public.verification_codes_v2
SET attempt_count = 0
WHERE attempt_count IS NULL;

CREATE INDEX IF NOT EXISTS idx_verification_codes_v2_email_type_attempts
ON public.verification_codes_v2 (email, type, is_used, expires_at, attempt_count);

CREATE TABLE IF NOT EXISTS public.captcha_challenges (
  id text PRIMARY KEY,
  seed integer NOT NULL,
  target_x integer NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  consumed boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_captcha_challenges_expiry
ON public.captcha_challenges (expires_at);

CREATE TABLE IF NOT EXISTS public.auth_rate_limit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  event_type text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limit_events_bucket
ON public.auth_rate_limit_events (bucket, event_type, created_at);
