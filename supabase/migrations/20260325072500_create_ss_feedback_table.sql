-- ============================================================
-- ss_feedback: 用户产品反馈表 (StudySolo 专属)
-- ============================================================
CREATE TABLE IF NOT EXISTS ss_feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email    text NOT NULL DEFAULT '',
  user_nickname text DEFAULT '',

  -- 问卷数据
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  issue_type    text DEFAULT '',
  content       text NOT NULL DEFAULT '',

  -- 奖励相关
  reward_days   smallint NOT NULL DEFAULT 3,
  reward_applied boolean NOT NULL DEFAULT false,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_ss_feedback_user_id ON ss_feedback(user_id);
CREATE INDEX idx_ss_feedback_created_at ON ss_feedback(created_at DESC);

-- RLS
ALTER TABLE ss_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
  ON ss_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own feedback"
  ON ss_feedback FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Service role full access"
  ON ss_feedback FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE ss_feedback IS '【ss_ StudySolo】用户产品反馈与体验问卷表';
