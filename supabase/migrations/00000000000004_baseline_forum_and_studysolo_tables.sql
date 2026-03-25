-- ============================================================
-- BASELINE MIGRATION 4/5: Forum (fm_) + StudySolo (ss_) Tables
-- ============================================================

-- =====================================================================
-- FORUM TABLES (fm_)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.fm_categories (
  id text NOT NULL,
  parent_id text,
  name text NOT NULL,
  name_en text,
  icon text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  post_count integer DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fm_categories_pkey PRIMARY KEY (id),
  CONSTRAINT fm_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES fm_categories(id)
);
ALTER TABLE public.fm_categories ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fm_categories_parent_id ON public.fm_categories (parent_id);
CREATE POLICY fm_categories_select_all ON public.fm_categories FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.fm_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  author_id text NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,
  content text NOT NULL,
  content_html text,
  category_id text NOT NULL,
  tags text[] DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'draft'::text,
  view_count integer DEFAULT 0,
  like_count integer DEFAULT 0,
  comment_count integer DEFAULT 0,
  is_pinned boolean DEFAULT false,
  is_featured boolean DEFAULT false,
  auto_source text,
  auto_source_url text,
  ai_moderation_score double precision,
  ai_moderation_result jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fm_posts_pkey PRIMARY KEY (id),
  CONSTRAINT fm_posts_slug_key UNIQUE (slug),
  CONSTRAINT fm_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES pt_users_legacy(id),
  CONSTRAINT fm_posts_category_id_fkey FOREIGN KEY (category_id) REFERENCES fm_categories(id),
  CONSTRAINT fm_posts_status_check CHECK (status = ANY (ARRAY['draft','pending_review','published','rejected','archived']))
);
ALTER TABLE public.fm_posts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fm_posts_category ON public.fm_posts (category_id);
CREATE INDEX IF NOT EXISTS idx_fm_posts_author ON public.fm_posts (author_id);
CREATE INDEX IF NOT EXISTS idx_fm_posts_created ON public.fm_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fm_posts_status ON public.fm_posts (status);

CREATE POLICY fm_posts_select_published ON public.fm_posts FOR SELECT USING (status = 'published');
CREATE POLICY fm_posts_insert_auth ON public.fm_posts FOR INSERT WITH CHECK (((SELECT auth.uid())::text IS NOT NULL) OR (author_id IS NOT NULL));
CREATE POLICY fm_posts_update_author ON public.fm_posts FOR UPDATE USING (author_id = (SELECT auth.uid())::text);
CREATE POLICY fm_posts_delete_author ON public.fm_posts FOR DELETE USING (author_id = (SELECT auth.uid())::text);

CREATE TABLE IF NOT EXISTS public.fm_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  author_id text NOT NULL,
  parent_id uuid,
  content text NOT NULL,
  like_count integer DEFAULT 0,
  ai_moderation_score double precision,
  status text NOT NULL DEFAULT 'published'::text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fm_comments_pkey PRIMARY KEY (id),
  CONSTRAINT fm_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES fm_posts(id) ON DELETE CASCADE,
  CONSTRAINT fm_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES pt_users_legacy(id),
  CONSTRAINT fm_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES fm_comments(id),
  CONSTRAINT fm_comments_status_check CHECK (status = ANY (ARRAY['published','hidden','deleted']))
);
ALTER TABLE public.fm_comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fm_comments_post ON public.fm_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_fm_comments_parent ON public.fm_comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_fm_comments_author_id ON public.fm_comments (author_id);

CREATE POLICY fm_comments_select_published ON public.fm_comments FOR SELECT USING (status = 'published');
CREATE POLICY fm_comments_insert_auth ON public.fm_comments FOR INSERT WITH CHECK (author_id IS NOT NULL);
CREATE POLICY fm_comments_update_author ON public.fm_comments FOR UPDATE USING (author_id = (SELECT auth.uid())::text);

CREATE TABLE IF NOT EXISTS public.fm_interactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fm_interactions_pkey PRIMARY KEY (id),
  CONSTRAINT fm_interactions_user_id_target_type_target_id_action_key UNIQUE (user_id, target_type, target_id, action),
  CONSTRAINT fm_interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES pt_users_legacy(id),
  CONSTRAINT fm_interactions_target_type_check CHECK (target_type = ANY (ARRAY['post','comment'])),
  CONSTRAINT fm_interactions_action_check CHECK (action = ANY (ARRAY['like','bookmark']))
);
ALTER TABLE public.fm_interactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fm_interactions_target ON public.fm_interactions (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_fm_interactions_user ON public.fm_interactions (user_id);

CREATE POLICY fm_interactions_select_own ON public.fm_interactions FOR SELECT USING (true);
CREATE POLICY fm_interactions_insert_auth ON public.fm_interactions FOR INSERT WITH CHECK (user_id IS NOT NULL);
CREATE POLICY fm_interactions_delete_own ON public.fm_interactions FOR DELETE USING (user_id = (SELECT auth.uid())::text);

-- =====================================================================
-- STUDYSOLO TABLES (ss_)
-- =====================================================================

-- ss_admin_accounts — 管理员账号
CREATE TABLE IF NOT EXISTS public.ss_admin_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL,
  password_hash text NOT NULL,
  email text,
  is_active boolean DEFAULT true,
  force_change_password boolean DEFAULT true,
  last_login timestamptz,
  failed_attempts integer DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT ss_admin_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT ss_admin_accounts_username_key UNIQUE (username)
);
ALTER TABLE public.ss_admin_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_service_only ON public.ss_admin_accounts FOR ALL USING (false);

-- ss_admin_audit_logs — 管理员审计日志
CREATE TABLE IF NOT EXISTS public.ss_admin_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id uuid,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT ss_admin_audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT ss_admin_audit_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES ss_admin_accounts(id)
);
ALTER TABLE public.ss_admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ss_admin_audit_logs_admin_id ON public.ss_admin_audit_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_ss_admin_audit_logs_action ON public.ss_admin_audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_ss_admin_audit_logs_created_at ON public.ss_admin_audit_logs (created_at DESC);
CREATE POLICY audit_service_only ON public.ss_admin_audit_logs FOR ALL USING (false);

-- ss_workflows — AI 工作流定义
CREATE TABLE IF NOT EXISTS public.ss_workflows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  nodes_json jsonb DEFAULT '[]'::jsonb,
  edges_json jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active'::text,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  annotations_json jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT ss_workflows_pkey PRIMARY KEY (id),
  CONSTRAINT ss_workflows_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.ss_workflows ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ss_workflows_user_id ON public.ss_workflows (user_id);
CREATE TRIGGER ss_workflows_updated_at BEFORE UPDATE ON ss_workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY ss_workflows_select_own ON public.ss_workflows FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY ss_workflows_insert_own ON public.ss_workflows FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY ss_workflows_update_own ON public.ss_workflows FOR UPDATE USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY ss_workflows_delete_own ON public.ss_workflows FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- ss_workflow_runs — 工作流执行记录
CREATE TABLE IF NOT EXISTS public.ss_workflow_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL,
  user_id uuid NOT NULL,
  input text,
  output jsonb,
  status text NOT NULL DEFAULT 'pending'::text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  tokens_used integer DEFAULT 0,
  current_step integer,
  total_steps integer,
  current_node text,
  CONSTRAINT ss_workflow_runs_pkey PRIMARY KEY (id),
  CONSTRAINT ss_workflow_runs_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES ss_workflows(id) ON DELETE CASCADE,
  CONSTRAINT ss_workflow_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.ss_workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ss_workflow_runs_user_id ON public.ss_workflow_runs (user_id);
CREATE INDEX IF NOT EXISTS idx_ss_workflow_runs_workflow_id ON public.ss_workflow_runs (workflow_id);
CREATE INDEX IF NOT EXISTS idx_ss_workflow_runs_started_at ON public.ss_workflow_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ss_workflow_runs_status ON public.ss_workflow_runs (status);

CREATE POLICY ss_workflow_runs_select_own ON public.ss_workflow_runs FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY ss_workflow_runs_insert_own ON public.ss_workflow_runs FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY ss_workflow_runs_update_own ON public.ss_workflow_runs FOR UPDATE USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY ss_workflow_runs_delete_own ON public.ss_workflow_runs FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- ss_ai_conversations — AI 对话会话
CREATE TABLE IF NOT EXISTS public.ss_ai_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workflow_id uuid,
  title text NOT NULL DEFAULT '新对话'::text,
  model_id text,
  platform text,
  message_count integer DEFAULT 0,
  is_pinned boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT ss_ai_conversations_pkey PRIMARY KEY (id),
  CONSTRAINT ss_ai_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT ss_ai_conversations_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES ss_workflows(id) ON DELETE SET NULL
);
ALTER TABLE public.ss_ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ss_ai_conversations_user_id ON public.ss_ai_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_ss_ai_conversations_workflow_id ON public.ss_ai_conversations (workflow_id);
CREATE INDEX IF NOT EXISTS idx_ss_ai_conversations_updated_at ON public.ss_ai_conversations (updated_at DESC);
CREATE TRIGGER trg_ss_ai_conversations_updated_at BEFORE UPDATE ON ss_ai_conversations FOR EACH ROW EXECUTE FUNCTION ss_ai_conversations_updated_at();

CREATE POLICY select_ss_ai_conversations_policy ON public.ss_ai_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY insert_ss_ai_conversations_policy ON public.ss_ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_ss_ai_conversations_policy ON public.ss_ai_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY delete_ss_ai_conversations_policy ON public.ss_ai_conversations FOR DELETE USING (auth.uid() = user_id);

-- ss_ai_messages — AI 对话消息
CREATE TABLE IF NOT EXISTS public.ss_ai_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL DEFAULT ''::text,
  intent text,
  actions_json jsonb,
  canvas_snapshot jsonb,
  tokens_used integer DEFAULT 0,
  model_used text,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT ss_ai_messages_pkey PRIMARY KEY (id),
  CONSTRAINT ss_ai_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES ss_ai_conversations(id) ON DELETE CASCADE,
  CONSTRAINT ss_ai_messages_role_check CHECK (role = ANY (ARRAY['user','assistant','system'])),
  CONSTRAINT ss_ai_messages_intent_check CHECK (intent IS NULL OR intent = ANY (ARRAY['BUILD','MODIFY','CHAT','ACTION']))
);
ALTER TABLE public.ss_ai_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ss_ai_messages_conversation_id ON public.ss_ai_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_ss_ai_messages_created_at ON public.ss_ai_messages (created_at);

CREATE POLICY select_ss_ai_messages_policy ON public.ss_ai_messages FOR SELECT USING (EXISTS (SELECT 1 FROM ss_ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY insert_ss_ai_messages_policy ON public.ss_ai_messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM ss_ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY update_ss_ai_messages_policy ON public.ss_ai_messages FOR UPDATE USING (EXISTS (SELECT 1 FROM ss_ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY delete_ss_ai_messages_policy ON public.ss_ai_messages FOR DELETE USING (EXISTS (SELECT 1 FROM ss_ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));

-- ss_notices — 公告通知
CREATE TABLE IF NOT EXISTS public.ss_notices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL,
  content text NOT NULL,
  audience text NOT NULL DEFAULT 'all'::text,
  priority integer DEFAULT 5,
  status text NOT NULL DEFAULT 'draft'::text,
  popup_enabled boolean DEFAULT false,
  popup_type text,
  start_time timestamptz,
  end_time timestamptz,
  action_text text,
  action_url text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  published_at timestamptz,
  expires_at timestamptz,
  CONSTRAINT ss_notices_pkey PRIMARY KEY (id),
  CONSTRAINT ss_notices_created_by_fkey FOREIGN KEY (created_by) REFERENCES ss_admin_accounts(id),
  CONSTRAINT ss_notices_type_check CHECK (type = ANY (ARRAY['system','feature','promotion','education','changelog','maintenance'])),
  CONSTRAINT ss_notices_status_check CHECK (status = ANY (ARRAY['draft','published','archived']))
);
ALTER TABLE public.ss_notices ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ss_notices_created_by ON public.ss_notices (created_by);
CREATE POLICY "Authenticated users can read published notices" ON public.ss_notices FOR SELECT TO authenticated USING (status = 'published');

-- ss_notice_reads — 通知已读
CREATE TABLE IF NOT EXISTS public.ss_notice_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamptz DEFAULT now(),
  CONSTRAINT ss_notice_reads_pkey PRIMARY KEY (id),
  CONSTRAINT ss_notice_reads_notice_id_user_id_key UNIQUE (notice_id, user_id),
  CONSTRAINT ss_notice_reads_notice_id_fkey FOREIGN KEY (notice_id) REFERENCES ss_notices(id) ON DELETE CASCADE,
  CONSTRAINT ss_notice_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.ss_notice_reads ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ss_notice_reads_user_id ON public.ss_notice_reads (user_id);

CREATE POLICY "Users can read their own notice reads" ON public.ss_notice_reads FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can insert their own notice reads" ON public.ss_notice_reads FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update their own notice reads" ON public.ss_notice_reads FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- ss_ratings — 用户评分
CREATE TABLE IF NOT EXISTS public.ss_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rating_type text NOT NULL,
  score integer NOT NULL,
  comment text,
  context text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT ss_ratings_pkey PRIMARY KEY (id),
  CONSTRAINT ss_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT ss_ratings_rating_type_check CHECK (rating_type = ANY (ARRAY['nps','csat']))
);
ALTER TABLE public.ss_ratings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ss_ratings_user_id ON public.ss_ratings (user_id);
CREATE POLICY "Users can insert their own ratings" ON public.ss_ratings FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

-- ss_system_config — 系统配置
CREATE TABLE IF NOT EXISTS public.ss_system_config (
  key text NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_by uuid,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT ss_system_config_pkey PRIMARY KEY (key),
  CONSTRAINT ss_system_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES ss_admin_accounts(id)
);
ALTER TABLE public.ss_system_config ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ss_system_config_updated_by ON public.ss_system_config (updated_by);
CREATE POLICY config_service_only ON public.ss_system_config FOR ALL USING (false);

-- ss_usage_daily — 每日使用量
CREATE TABLE IF NOT EXISTS public.ss_usage_daily (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  executions_count integer DEFAULT 0,
  tokens_used bigint DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT ss_usage_daily_pkey PRIMARY KEY (id),
  CONSTRAINT ss_usage_daily_user_id_date_key UNIQUE (user_id, date),
  CONSTRAINT ss_usage_daily_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.ss_usage_daily ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ss_usage_daily_user_date ON public.ss_usage_daily (user_id, date);

CREATE POLICY ss_usage_daily_select_own ON public.ss_usage_daily FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY ss_usage_daily_insert_own ON public.ss_usage_daily FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY ss_usage_daily_update_own ON public.ss_usage_daily FOR UPDATE USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
