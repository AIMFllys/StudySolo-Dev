-- ============================================================
-- BASELINE MIGRATION 3/5: Platform (pt_) Tables
-- 1037Solo Chat Platform — bcrypt/session auth, TEXT IDs
-- ============================================================

-- =====================================================================
-- pt_users_legacy — 旧版用户表 (TEXT id, bcrypt)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pt_users_legacy (
  id text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  nickname text,
  avatar_url text,
  role text NOT NULL DEFAULT 'student'::text,
  status text NOT NULL DEFAULT 'active'::text,
  total_tokens_used bigint DEFAULT 0,
  total_conversations integer DEFAULT 0,
  total_messages integer DEFAULT 0,
  login_count integer DEFAULT 0,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT pt_users_legacy_pkey PRIMARY KEY (id),
  CONSTRAINT pt_users_legacy_email_key UNIQUE (email)
);
ALTER TABLE public.pt_users_legacy ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- pt_sessions — Session 会话表
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pt_sessions (
  token text NOT NULL,
  user_id text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'student'::text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + '7 days'::interval),
  CONSTRAINT pt_sessions_pkey PRIMARY KEY (token)
);
ALTER TABLE public.pt_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pt_sessions_user_id ON public.pt_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_pt_sessions_expires ON public.pt_sessions (expires_at);

-- =====================================================================
-- pt_conversation_folders — 对话文件夹
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pt_conversation_folders (
  id text NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  parent_id text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT pt_conversation_folders_pkey PRIMARY KEY (id),
  CONSTRAINT pt_conversation_folders_user_id_fkey FOREIGN KEY (user_id) REFERENCES pt_users_legacy(id) ON DELETE CASCADE,
  CONSTRAINT pt_conversation_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES pt_conversation_folders(id) ON DELETE SET NULL
);
ALTER TABLE public.pt_conversation_folders ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pt_conversation_folders_user_id ON public.pt_conversation_folders (user_id);
CREATE INDEX IF NOT EXISTS idx_pt_conversation_folders_parent_id ON public.pt_conversation_folders (parent_id);

-- =====================================================================
-- pt_conversations — 对话会话表
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pt_conversations (
  id text NOT NULL,
  user_id text NOT NULL,
  title text NOT NULL DEFAULT '新对话'::text,
  model text NOT NULL,
  is_project boolean DEFAULT false,
  project_settings jsonb,
  folder_id text,
  total_tokens integer DEFAULT 0,
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  message_count integer DEFAULT 0,
  is_pinned boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT pt_conversations_pkey PRIMARY KEY (id),
  CONSTRAINT pt_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES pt_users_legacy(id) ON DELETE CASCADE,
  CONSTRAINT pt_conversations_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES pt_conversation_folders(id) ON DELETE SET NULL
);
ALTER TABLE public.pt_conversations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pt_conversations_user_id ON public.pt_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_pt_conversations_folder_id ON public.pt_conversations (folder_id);
CREATE INDEX IF NOT EXISTS idx_pt_conversations_created_at ON public.pt_conversations (created_at DESC);

-- =====================================================================
-- pt_messages — 消息表
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pt_messages (
  id text NOT NULL,
  conversation_id text NOT NULL,
  user_id text,
  role text NOT NULL,
  content text NOT NULL,
  model_id text,
  token_count integer DEFAULT 0,
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  metadata jsonb,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT pt_messages_pkey PRIMARY KEY (id),
  CONSTRAINT pt_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES pt_conversations(id) ON DELETE CASCADE
);
ALTER TABLE public.pt_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pt_messages_conversation_id ON public.pt_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_pt_messages_created_at ON public.pt_messages (created_at);

-- =====================================================================
-- pt_message_feedback — 消息反馈
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pt_message_feedback (
  id bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY,
  message_id text NOT NULL,
  user_id text NOT NULL,
  type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT pt_message_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT pt_message_feedback_message_id_user_id_key UNIQUE (message_id, user_id)
);
ALTER TABLE public.pt_message_feedback ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- pt_usage_daily / pt_usage_stats — 使用量统计
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pt_usage_daily (
  id bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY,
  user_id text NOT NULL,
  model text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 0,
  CONSTRAINT pt_usage_daily_pkey PRIMARY KEY (id),
  CONSTRAINT pt_usage_daily_user_id_model_date_key UNIQUE (user_id, model, date)
);
ALTER TABLE public.pt_usage_daily ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pt_usage_stats (
  id bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY,
  user_id text NOT NULL,
  model_id text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  request_count integer DEFAULT 0,
  total_tokens bigint DEFAULT 0,
  prompt_tokens bigint DEFAULT 0,
  completion_tokens bigint DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT pt_usage_stats_pkey PRIMARY KEY (id),
  CONSTRAINT pt_usage_stats_user_id_model_id_date_key UNIQUE (user_id, model_id, date)
);
ALTER TABLE public.pt_usage_stats ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- pt_user_* — 用户相关表
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pt_user_preferences (
  user_id text NOT NULL,
  theme text DEFAULT 'dark'::text,
  language text DEFAULT 'zh-CN'::text,
  font_size integer DEFAULT 14,
  send_key text DEFAULT 'Enter'::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT pt_user_preferences_pkey PRIMARY KEY (user_id)
);
ALTER TABLE public.pt_user_preferences ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pt_user_model_limits (
  id bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY,
  user_id text NOT NULL,
  model_id text NOT NULL,
  daily_limit integer,
  is_unlimited boolean DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT pt_user_model_limits_pkey PRIMARY KEY (id),
  CONSTRAINT pt_user_model_limits_user_id_model_id_key UNIQUE (user_id, model_id)
);
ALTER TABLE public.pt_user_model_limits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pt_user_login_logs (
  id bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY,
  user_id text NOT NULL,
  login_type text DEFAULT 'password'::text,
  ip_address text,
  device_info text,
  status text DEFAULT 'success'::text,
  fail_reason text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT pt_user_login_logs_pkey PRIMARY KEY (id)
);
ALTER TABLE public.pt_user_login_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pt_user_memories (
  id text NOT NULL,
  user_id text NOT NULL,
  content text NOT NULL,
  category text DEFAULT 'general'::text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT pt_user_memories_pkey PRIMARY KEY (id),
  CONSTRAINT pt_user_memories_user_id_fkey FOREIGN KEY (user_id) REFERENCES pt_users_legacy(id) ON DELETE CASCADE
);
ALTER TABLE public.pt_user_memories ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pt_user_memories_user_id ON public.pt_user_memories (user_id);

CREATE POLICY "Users can read own memories" ON public.pt_user_memories FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "Users can insert own memories" ON public.pt_user_memories FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid())::text);
CREATE POLICY "Users can delete own memories" ON public.pt_user_memories FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid())::text);

CREATE TABLE IF NOT EXISTS public.pt_user_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text,
  category text DEFAULT 'general'::text,
  source_type text DEFAULT 'home'::text,
  source_id text,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT pt_user_files_pkey PRIMARY KEY (id),
  CONSTRAINT pt_user_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES pt_users_legacy(id),
  CONSTRAINT pt_user_files_category_check CHECK (category = ANY (ARRAY['general','post_attachment','avatar','document'])),
  CONSTRAINT pt_user_files_source_type_check CHECK (source_type = ANY (ARRAY['home','studysolo','wiki']))
);
ALTER TABLE public.pt_user_files ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pt_user_files_user ON public.pt_user_files (user_id);
CREATE INDEX IF NOT EXISTS idx_pt_user_files_source ON public.pt_user_files (source_type, source_id);

CREATE POLICY pt_user_files_select_own ON public.pt_user_files FOR SELECT USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY pt_user_files_insert_auth ON public.pt_user_files FOR INSERT WITH CHECK (user_id IS NOT NULL);
CREATE POLICY pt_user_files_delete_own ON public.pt_user_files FOR DELETE USING (user_id = (SELECT auth.uid())::text);

-- =====================================================================
-- pt_verification_codes — 验证码
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pt_verification_codes (
  id bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY,
  email text NOT NULL,
  code text NOT NULL,
  type text NOT NULL DEFAULT 'register'::text,
  is_used boolean DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT pt_verification_codes_pkey PRIMARY KEY (id)
);
ALTER TABLE public.pt_verification_codes ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- pt_captcha_challenges / pt_login_attempts — 安全防护
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pt_captcha_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  seed integer NOT NULL,
  target_x integer NOT NULL,
  is_verified boolean DEFAULT false,
  captcha_token text,
  ip_address text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  CONSTRAINT pt_captcha_challenges_pkey PRIMARY KEY (id),
  CONSTRAINT pt_captcha_challenges_captcha_token_key UNIQUE (captcha_token)
);
ALTER TABLE public.pt_captcha_challenges ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pt_captcha_expires ON public.pt_captcha_challenges (expires_at);
CREATE INDEX IF NOT EXISTS idx_pt_captcha_token ON public.pt_captcha_challenges (captcha_token) WHERE captcha_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pt_login_attempts (
  id bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY,
  ip_address text NOT NULL,
  email text,
  attempted_at timestamptz DEFAULT now(),
  success boolean DEFAULT false,
  CONSTRAINT pt_login_attempts_pkey PRIMARY KEY (id)
);
ALTER TABLE public.pt_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pt_login_attempts_ip ON public.pt_login_attempts (ip_address, attempted_at);
CREATE INDEX IF NOT EXISTS idx_pt_login_attempts_email ON public.pt_login_attempts (email, attempted_at);
