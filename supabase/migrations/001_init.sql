-- ============================================
-- StudySolo MVP - Initial Database Schema
-- ============================================
-- Creates: users, workflows, workflow_runs
-- Enables: RLS on all tables
-- ============================================

-- Enable UUID extension (usually enabled by default on Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. users 表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT now(),
    last_login TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only read/update their own row
CREATE POLICY "users_select_own" ON users
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON users
    FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================
-- 2. workflows 表
-- ============================================
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    nodes_json JSONB DEFAULT '[]'::jsonb,
    edges_json JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'draft',
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own workflows
CREATE POLICY "workflows_select_own" ON workflows
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "workflows_insert_own" ON workflows
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workflows_update_own" ON workflows
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workflows_delete_own" ON workflows
    FOR DELETE
    USING (auth.uid() = user_id);

-- Index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);

-- ============================================
-- 3. workflow_runs 表
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    input TEXT,
    output JSONB,
    status TEXT DEFAULT 'running',
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    tokens_used INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own workflow runs
CREATE POLICY "workflow_runs_select_own" ON workflow_runs
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "workflow_runs_insert_own" ON workflow_runs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workflow_runs_update_own" ON workflow_runs
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workflow_runs_delete_own" ON workflow_runs
    FOR DELETE
    USING (auth.uid() = user_id);

-- Indexes on foreign keys for faster lookups
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_id ON workflow_runs(user_id);
