-- ============================================================
-- BASELINE MIGRATION 1/5: Extensions, Functions & Triggers
-- Generated: 2026-03-25 from live DB schema (hofcaclztjazoytmckup)
-- This is a squashed baseline of 40 previously executed migrations.
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================================
-- Shared trigger function
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- =====================================================================
-- Auth trigger: handle_new_user
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
    INSERT INTO public.user_profiles (id, email, nickname, registered_from, legacy_id)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'nickname',
            NEW.raw_user_meta_data->>'name',
            split_part(NEW.email, '@', 1)
        ),
        COALESCE(NEW.raw_user_meta_data->>'registered_from', 'studysolo'),
        (SELECT id FROM public.pt_users_legacy WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1)
    );
    RETURN NEW;
END;
$function$;

-- =====================================================================
-- StudySolo AI conversations updated_at trigger function
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ss_ai_conversations_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- =====================================================================
-- Session cleanup
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS integer LANGUAGE plpgsql SET search_path TO '' AS $function$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.pt_sessions WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_verification_codes()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  DELETE FROM verification_codes_v2
  WHERE expires_at < now() - interval '1 hour';
END;
$function$;

-- =====================================================================
-- Platform RPC functions
-- =====================================================================
CREATE OR REPLACE FUNCTION public.increment_conversation_tokens(
  p_conversation_id text, p_total_tokens bigint DEFAULT 0,
  p_prompt_tokens bigint DEFAULT 0, p_completion_tokens bigint DEFAULT 0,
  p_message_count integer DEFAULT 2
) RETURNS void LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  UPDATE conversations SET
    updated_at = NOW(),
    total_tokens = total_tokens + p_total_tokens,
    prompt_tokens = prompt_tokens + p_prompt_tokens,
    completion_tokens = completion_tokens + p_completion_tokens,
    message_count = message_count + p_message_count
  WHERE id = p_conversation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_redeem_used_count(p_code text)
RETURNS void LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  UPDATE redeem_codes SET used_count = used_count + 1 WHERE code = p_code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_usage_daily(
  p_user_id text, p_model text, p_date date DEFAULT CURRENT_DATE
) RETURNS void LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  INSERT INTO usage_daily (user_id, model, date, count)
  VALUES (p_user_id, p_model, p_date, 1)
  ON CONFLICT (user_id, model, date) DO UPDATE SET count = usage_daily.count + 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_user_tokens(
  p_user_id text, p_tokens bigint DEFAULT 0, p_messages integer DEFAULT 0
) RETURNS void LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  UPDATE users SET
    total_tokens_used = total_tokens_used + p_tokens,
    total_messages = total_messages + p_messages
  WHERE id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_assistant_message(
  p_id text, p_conversation_id text, p_user_id text, p_role text, p_content text,
  p_model_id text, p_token_count integer DEFAULT 0,
  p_prompt_tokens integer DEFAULT 0, p_completion_tokens integer DEFAULT 0
) RETURNS void LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  INSERT INTO messages (id, conversation_id, user_id, role, content, model_id, token_count, prompt_tokens, completion_tokens)
  VALUES (p_id, p_conversation_id, p_user_id, p_role, p_content, p_model_id, p_token_count, p_prompt_tokens, p_completion_tokens)
  ON CONFLICT (id) DO UPDATE SET
    content = EXCLUDED.content, model_id = EXCLUDED.model_id,
    token_count = EXCLUDED.token_count, prompt_tokens = EXCLUDED.prompt_tokens,
    completion_tokens = EXCLUDED.completion_tokens;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_message_feedback(
  p_message_id text, p_user_id text, p_type text
) RETURNS void LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  INSERT INTO message_feedback (message_id, user_id, type)
  VALUES (p_message_id, p_user_id, p_type)
  ON CONFLICT (message_id, user_id) DO UPDATE SET type = EXCLUDED.type, created_at = NOW();
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_usage_stats(
  p_user_id text, p_model_id text, p_date date DEFAULT CURRENT_DATE,
  p_total_tokens bigint DEFAULT 0, p_prompt_tokens bigint DEFAULT 0,
  p_completion_tokens bigint DEFAULT 0
) RETURNS void LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  INSERT INTO usage_stats (user_id, model_id, date, request_count, total_tokens, prompt_tokens, completion_tokens)
  VALUES (p_user_id, p_model_id, p_date, 1, p_total_tokens, p_prompt_tokens, p_completion_tokens)
  ON CONFLICT (user_id, model_id, date) DO UPDATE SET
    request_count = usage_stats.request_count + 1,
    total_tokens = usage_stats.total_tokens + EXCLUDED.total_tokens,
    prompt_tokens = usage_stats.prompt_tokens + EXCLUDED.prompt_tokens,
    completion_tokens = usage_stats.completion_tokens + EXCLUDED.completion_tokens,
    updated_at = NOW();
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_user_model_limit(
  p_user_id text, p_model_id text,
  p_daily_limit integer DEFAULT NULL, p_monthly_limit integer DEFAULT NULL,
  p_is_unlimited boolean DEFAULT false, p_expires_at timestamptz DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  INSERT INTO user_model_limits (user_id, model_id, daily_limit, monthly_limit, is_unlimited, expires_at)
  VALUES (p_user_id, p_model_id, p_daily_limit, p_monthly_limit, p_is_unlimited, p_expires_at)
  ON CONFLICT (user_id, model_id) DO UPDATE SET
    daily_limit = EXCLUDED.daily_limit, monthly_limit = EXCLUDED.monthly_limit,
    is_unlimited = EXCLUDED.is_unlimited, expires_at = EXCLUDED.expires_at, updated_at = NOW();
END;
$function$;

-- Admin RPC functions
CREATE OR REPLACE FUNCTION public.get_admin_overview()
RETURNS json LANGUAGE plpgsql SET search_path TO '' AS $function$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'users', json_build_object('total_users', (SELECT COUNT(*) FROM users))
  ) INTO result;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_trends(p_range text DEFAULT '7d')
RETURNS json LANGUAGE plpgsql SET search_path TO '' AS $function$
DECLARE date_filter TIMESTAMPTZ; result JSON;
BEGIN
  CASE p_range
    WHEN 'today' THEN date_filter := CURRENT_DATE;
    WHEN '7d' THEN date_filter := CURRENT_DATE - INTERVAL '7 days';
    WHEN '30d' THEN date_filter := CURRENT_DATE - INTERVAL '30 days';
    ELSE date_filter := NULL;
  END CASE;
  SELECT json_build_object('registrations', '[]'::json) INTO result;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_costs(p_range text DEFAULT 'all')
RETURNS json LANGUAGE plpgsql SET search_path TO '' AS $function$
DECLARE result JSON;
BEGIN
  SELECT json_build_object('daily', '[]'::json, 'models', '[]'::json) INTO result;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id text)
RETURNS json LANGUAGE plpgsql SET search_path TO '' AS $function$
DECLARE result JSON;
BEGIN
  SELECT json_build_object('user', NULL) INTO result;
  RETURN result;
END;
$function$;
