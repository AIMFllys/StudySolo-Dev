-- Migration: create_knowledge_base_tables
-- Creates knowledge base tables: ss_kb_documents, ss_kb_document_summaries,
-- ss_kb_document_chunks, ss_kb_chunk_embeddings, ss_kb_summary_embeddings
-- Requires: pgvector extension for embedding storage

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================================
-- 1. kb_documents — 文档元信息
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ss_kb_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf',  -- pdf, docx, md, txt
  file_size_bytes BIGINT DEFAULT 0,
  file_path TEXT,                          -- Supabase Storage path
  status TEXT DEFAULT 'pending',           -- pending, processing, ready, error
  error_message TEXT,
  total_chunks INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ss_kb_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY ss_kb_documents_select_own ON public.ss_kb_documents
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY ss_kb_documents_insert_own ON public.ss_kb_documents
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY ss_kb_documents_update_own ON public.ss_kb_documents
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY ss_kb_documents_delete_own ON public.ss_kb_documents
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Updated at trigger
CREATE TRIGGER ss_kb_documents_updated_at
  BEFORE UPDATE ON public.ss_kb_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_ss_kb_documents_user_id ON public.ss_kb_documents(user_id);
CREATE INDEX idx_ss_kb_documents_status ON public.ss_kb_documents(status);

-- =====================================================================
-- 2. kb_document_summaries — AI 生成的文档摘要
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ss_kb_document_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.ss_kb_documents(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  key_concepts JSONB DEFAULT '[]'::jsonb,   -- ["概念1", "概念2", ...]
  table_of_contents JSONB DEFAULT '[]'::jsonb, -- [{title, level, page}]
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (inherit from parent document ownership)
ALTER TABLE public.ss_kb_document_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY ss_kb_document_summaries_select ON public.ss_kb_document_summaries
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM public.ss_kb_documents
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY ss_kb_document_summaries_insert ON public.ss_kb_document_summaries
  FOR INSERT WITH CHECK (
    document_id IN (
      SELECT id FROM public.ss_kb_documents
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY ss_kb_document_summaries_delete ON public.ss_kb_document_summaries
  FOR DELETE USING (
    document_id IN (
      SELECT id FROM public.ss_kb_documents
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- Index
CREATE INDEX idx_ss_kb_document_summaries_doc_id ON public.ss_kb_document_summaries(document_id);

-- =====================================================================
-- 3. kb_document_chunks — 分块后的文本
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ss_kb_document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.ss_kb_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,  -- {heading, page, section}
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ss_kb_document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY ss_kb_document_chunks_select ON public.ss_kb_document_chunks
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM public.ss_kb_documents
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY ss_kb_document_chunks_insert ON public.ss_kb_document_chunks
  FOR INSERT WITH CHECK (
    document_id IN (
      SELECT id FROM public.ss_kb_documents
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY ss_kb_document_chunks_delete ON public.ss_kb_document_chunks
  FOR DELETE USING (
    document_id IN (
      SELECT id FROM public.ss_kb_documents
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- Indexes
CREATE INDEX idx_ss_kb_document_chunks_doc_id ON public.ss_kb_document_chunks(document_id);
CREATE INDEX idx_ss_kb_document_chunks_order ON public.ss_kb_document_chunks(document_id, chunk_index);

-- =====================================================================
-- 4. kb_chunk_embeddings — 分块向量
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ss_kb_chunk_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL REFERENCES public.ss_kb_document_chunks(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.ss_kb_documents(id) ON DELETE CASCADE,
  embedding vector(1024),  -- text-embedding-v4 outputs 1024 dimensions
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ss_kb_chunk_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY ss_kb_chunk_embeddings_select ON public.ss_kb_chunk_embeddings
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM public.ss_kb_documents
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY ss_kb_chunk_embeddings_insert ON public.ss_kb_chunk_embeddings
  FOR INSERT WITH CHECK (
    document_id IN (
      SELECT id FROM public.ss_kb_documents
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY ss_kb_chunk_embeddings_delete ON public.ss_kb_chunk_embeddings
  FOR DELETE USING (
    document_id IN (
      SELECT id FROM public.ss_kb_documents
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- Indexes
CREATE INDEX idx_ss_kb_chunk_embeddings_chunk_id ON public.ss_kb_chunk_embeddings(chunk_id);
CREATE INDEX idx_ss_kb_chunk_embeddings_doc_id ON public.ss_kb_chunk_embeddings(document_id);

-- HNSW index for fast vector similarity search
CREATE INDEX idx_ss_kb_chunk_embeddings_vector ON public.ss_kb_chunk_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- =====================================================================
-- 5. kb_summary_embeddings — 摘要向量（粗粒度检索）
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ss_kb_summary_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.ss_kb_documents(id) ON DELETE CASCADE,
  embedding vector(1024),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ss_kb_summary_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY ss_kb_summary_embeddings_select ON public.ss_kb_summary_embeddings
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM public.ss_kb_documents
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY ss_kb_summary_embeddings_insert ON public.ss_kb_summary_embeddings
  FOR INSERT WITH CHECK (
    document_id IN (
      SELECT id FROM public.ss_kb_documents
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY ss_kb_summary_embeddings_delete ON public.ss_kb_summary_embeddings
  FOR DELETE USING (
    document_id IN (
      SELECT id FROM public.ss_kb_documents
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- Index
CREATE INDEX idx_ss_kb_summary_embeddings_doc_id ON public.ss_kb_summary_embeddings(document_id);

-- HNSW index for summary vector similarity search
CREATE INDEX idx_ss_kb_summary_embeddings_vector ON public.ss_kb_summary_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- =====================================================================
-- RPC: 向量相似度搜索函数
-- =====================================================================

-- 在用户的知识库中搜索与 query embedding 最相似的 chunks
CREATE OR REPLACE FUNCTION match_kb_chunks(
  query_embedding vector(1024),
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.document_id,
    c.content,
    c.metadata,
    1 - (ce.embedding <=> query_embedding) AS similarity
  FROM public.ss_kb_chunk_embeddings ce
  JOIN public.ss_kb_document_chunks c ON c.id = ce.chunk_id
  JOIN public.ss_kb_documents d ON d.id = c.document_id
  WHERE d.user_id = COALESCE(p_user_id, (SELECT auth.uid()))
    AND d.status = 'ready'
    AND 1 - (ce.embedding <=> query_embedding) > match_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
