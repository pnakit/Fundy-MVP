-- ============================================================
-- Fundy MVP — Initial Schema
-- 12 tables + RLS + indexes + pgvector + search function
-- ============================================================

-- Enable pgvector extension (must also be enabled in Supabase Dashboard)
CREATE EXTENSION IF NOT EXISTS vector;

-- Make vector type available without schema prefix
-- (Supabase installs extensions in the 'extensions' schema)
SET search_path TO public, extensions;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  company_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow TEXT NOT NULL CHECK (workflow IN ('onboarding', 'deepdive')),
  dify_conversation_id TEXT,
  category_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_conversations_user_workflow_category UNIQUE (user_id, workflow, category_id),
  CONSTRAINT chk_deepdive_has_category CHECK (workflow != 'deepdive' OR category_id IS NOT NULL)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE onboarding_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_data JSONB NOT NULL,
  onboarding_phase TEXT DEFAULT 'chat',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_onboarding_summaries_user UNIQUE (user_id)
);

CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  maturity_stage JSONB,
  dimensions JSONB,
  performance_metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_evaluations_user UNIQUE (user_id)
);

-- Updated from Architecture.md per datastructure.md:
-- - Replaced `source TEXT` with source_type/source_id/dimension_id/action_key
-- - Added 'critical' to priority CHECK constraint
CREATE TABLE action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_key TEXT,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed')),
  source_type TEXT CHECK (source_type IN ('evaluation', 'investment')),
  source_id TEXT,
  dimension_id TEXT,
  file_ids TEXT[],
  custom_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE investment_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_type TEXT NOT NULL,
  selected BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_investment_selections_user_type UNIQUE (user_id, investment_type)
);

-- New table from datastructure.md
CREATE TABLE investment_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendations JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_investment_recommendations_user UNIQUE (user_id)
);

-- Updated from Architecture.md: added extracted_text_path column
CREATE TABLE file_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  dify_file_id TEXT,
  context TEXT,
  extracted_text_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE deletion_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_user_id UUID NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  deleted_by TEXT NOT NULL  -- 'user_request', 'admin'
);

-- New table: vector store for semantic search
CREATE TABLE document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('conversation', 'file', 'summary')),
  source_id UUID,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_document_embeddings_source_chunk UNIQUE (source_type, source_id, chunk_index)
);

-- ============================================================
-- INDEXES (critical for RLS performance)
-- ============================================================

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_user_created ON conversations(user_id, created_at DESC);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX idx_onboarding_summaries_user_id ON onboarding_summaries(user_id);
CREATE INDEX idx_evaluations_user_id ON evaluations(user_id);
CREATE INDEX idx_action_items_user_id ON action_items(user_id);
CREATE INDEX idx_action_items_user_status ON action_items(user_id, status);
CREATE INDEX idx_investment_selections_user_id ON investment_selections(user_id);
CREATE INDEX idx_investment_recommendations_user_id ON investment_recommendations(user_id);
CREATE INDEX idx_file_metadata_user_id ON file_metadata(user_id);
CREATE INDEX idx_document_embeddings_user_id ON document_embeddings(user_id);
CREATE INDEX idx_document_embeddings_source ON document_embeddings(source_type, source_id);

-- HNSW index for fast approximate nearest neighbor search (cosine distance)
CREATE INDEX idx_document_embeddings_vector
  ON document_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- User-managed tables: full CRUD
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON user_profiles FOR ALL USING (auth.uid() = id);

ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own action items" ON action_items FOR ALL USING (auth.uid() = user_id);

ALTER TABLE investment_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own investments" ON investment_selections FOR ALL USING (auth.uid() = user_id);

-- Append-only tables: SELECT + INSERT only (server manages updates via service_role)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own conversations" ON conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own messages" ON messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own messages" ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Server-managed tables: client can SELECT only
ALTER TABLE onboarding_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own summary" ON onboarding_summaries FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own evaluations" ON evaluations FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE investment_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own recommendations" ON investment_recommendations FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own files" ON file_metadata FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upload own files" ON file_metadata FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Global config: read-only for all, write via service_role only
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read config" ON app_config FOR SELECT USING (true);

-- Deletion audit: no public access (service_role only)
ALTER TABLE deletion_audit ENABLE ROW LEVEL SECURITY;

-- Document embeddings: no public access (service_role only)
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TRIGGER: enforce messages.user_id matches conversations.user_id
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_message_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id != (SELECT user_id FROM conversations WHERE id = NEW.conversation_id) THEN
    RAISE EXCEPTION 'message user_id must match conversation user_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_message_user_id
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION enforce_message_user_id();

-- ============================================================
-- FUNCTION: vector similarity search
-- ============================================================

CREATE OR REPLACE FUNCTION search_embeddings(
  p_user_id UUID,
  p_embedding vector(1536),
  p_top_k INTEGER DEFAULT 5,
  p_similarity_threshold FLOAT DEFAULT 0.7,
  p_source_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  content TEXT,
  source_type TEXT,
  source_id UUID,
  chunk_index INTEGER,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.content,
    de.source_type,
    de.source_id,
    de.chunk_index,
    (1 - (de.embedding <=> p_embedding))::FLOAT AS similarity,
    de.metadata
  FROM document_embeddings de
  WHERE de.user_id = p_user_id
    AND (p_source_types IS NULL OR de.source_type = ANY(p_source_types))
    AND (1 - (de.embedding <=> p_embedding)) >= p_similarity_threshold
  ORDER BY de.embedding <=> p_embedding
  LIMIT p_top_k;
END;
$$;

-- ============================================================
-- SEED: app_config with embedding model configuration
-- ============================================================

INSERT INTO app_config (key, value) VALUES
  ('embedding_model', '{"provider": "openai", "model": "text-embedding-3-small", "dimensions": 1536}'::JSONB);
