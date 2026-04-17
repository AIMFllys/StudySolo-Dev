-- Migration: Personal Access Tokens + Workflow Run Events
-- Adds PAT table for CLI/MCP Bearer auth, and a node-level event stream
-- table that drives the new run progress / events REST endpoints.
-- Date: 2026-04-17

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. New table: ss_api_tokens — Personal Access Tokens for CLI / MCP
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ss_api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- SHA-256 hex of the plaintext token; the plaintext is shown exactly once
  -- at creation time and never stored anywhere.
  token_hash TEXT NOT NULL UNIQUE,
  -- First 12 chars of the plaintext (e.g. "sk_studyso...") for UI display only.
  token_prefix TEXT NOT NULL,
  -- Reserved for fine-grained permissions; initial release is fixed to ['*'].
  scopes JSONB NOT NULL DEFAULT '["*"]'::jsonb,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

COMMENT ON TABLE public.ss_api_tokens IS 'Personal Access Tokens for CLI / MCP Server Bearer authentication.';
COMMENT ON COLUMN public.ss_api_tokens.token_hash IS 'SHA-256 hex digest of the plaintext token. Plaintext is never stored.';
COMMENT ON COLUMN public.ss_api_tokens.token_prefix IS 'First 12 chars of the plaintext for UI display (e.g. "sk_studyso..").';
COMMENT ON COLUMN public.ss_api_tokens.scopes IS 'Reserved for future fine-grained scopes. Initial release is fixed to ["*"].';

CREATE INDEX IF NOT EXISTS idx_ss_api_tokens_user_id
  ON public.ss_api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_ss_api_tokens_token_hash
  ON public.ss_api_tokens(token_hash);

ALTER TABLE public.ss_api_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tokens; the plaintext is never returned anyway.
CREATE POLICY ss_api_tokens_select_own
  ON public.ss_api_tokens FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY ss_api_tokens_insert_own
  ON public.ss_api_tokens FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY ss_api_tokens_delete_own
  ON public.ss_api_tokens FOR DELETE
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY ss_api_tokens_update_own
  ON public.ss_api_tokens FOR UPDATE
  USING (user_id = (SELECT auth.uid()));


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. New table: ss_workflow_run_events — node-level event stream for progress
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ss_workflow_run_events (
  run_id UUID NOT NULL REFERENCES public.ss_workflow_runs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, seq)
);

COMMENT ON TABLE public.ss_workflow_run_events IS 'Node-level workflow run event stream. Key frames only (no token deltas) to keep table small and enable REST progress / events polling replay.';
COMMENT ON COLUMN public.ss_workflow_run_events.seq IS 'Monotonic per-run sequence, starting from 1, enforced by the backend run_worker sink.';
COMMENT ON COLUMN public.ss_workflow_run_events.event_type IS 'One of: workflow_status, node_input, node_status, node_done, workflow_done.';

CREATE INDEX IF NOT EXISTS idx_ss_wf_run_events_run_seq
  ON public.ss_workflow_run_events(run_id, seq DESC);

ALTER TABLE public.ss_workflow_run_events ENABLE ROW LEVEL SECURITY;

-- Owner can read their own run events via the parent run record.
CREATE POLICY ss_wf_run_events_select_own
  ON public.ss_workflow_run_events FOR SELECT
  USING (run_id IN (
    SELECT id FROM public.ss_workflow_runs
    WHERE user_id = (SELECT auth.uid())
  ));

-- Public access for shared runs, same pattern as ss_workflow_run_traces.
CREATE POLICY ss_wf_run_events_select_shared
  ON public.ss_workflow_run_events FOR SELECT
  USING (run_id IN (
    SELECT id FROM public.ss_workflow_runs
    WHERE is_shared = TRUE
  ));

-- Service-role inserts (backend uses service_role key; same pattern as traces).
CREATE POLICY ss_wf_run_events_insert_service
  ON public.ss_workflow_run_events FOR INSERT
  WITH CHECK (true);
