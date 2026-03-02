-- ============================================================
-- Repair migration: vector table, indexes, RLS, trigger, function
-- 001 partially applied — tables 1-11 created, everything after
-- document_embeddings failed due to unqualified vector type.
-- ============================================================

-- Make vector type available without schema prefix
SET search_path TO public, extensions;

-- ============================================================
-- MISSING TABLE: document_embeddings (pgvector)
-- ============================================================

CREATE TABLE IF NOT EXISTS document_embeddings (
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
-- INDEXES (all missing — 001 failed before reaching these)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_created ON conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_summaries_user_id ON onboarding_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_user_id ON evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_action_items_user_id ON action_items(user_id);
CREATE INDEX IF NOT EXISTS idx_action_items_user_status ON action_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_investment_selections_user_id ON investment_selections(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_recommendations_user_id ON investment_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_user_id ON file_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_user_id ON document_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_source ON document_embeddings(source_type, source_id);

-- HNSW index for fast approximate nearest neighbor search (cosine distance)
CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector
  ON document_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- RLS POLICIES (all missing)
-- ============================================================

-- User-managed tables: full CRUD
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own profile" ON user_profiles FOR ALL USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own action items" ON action_items FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE investment_selections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own investments" ON investment_selections FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Append-only tables: SELECT + INSERT only
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own conversations" ON conversations FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users create own conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own messages" ON messages FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users create own messages" ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Server-managed tables: client can SELECT only
ALTER TABLE onboarding_summaries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own summary" ON onboarding_summaries FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own evaluations" ON evaluations FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE investment_recommendations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own recommendations" ON investment_recommendations FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own files" ON file_metadata FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users upload own files" ON file_metadata FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Global config: read-only for all
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Anyone can read config" ON app_config FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- No public access
ALTER TABLE deletion_audit ENABLE ROW LEVEL SECURITY;
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

DO $$ BEGIN
  CREATE TRIGGER trg_enforce_message_user_id
    BEFORE INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION enforce_message_user_id();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

INSERT INTO app_config (key, value)
VALUES ('embedding_model', '{"provider": "openai", "model": "text-embedding-3-small", "dimensions": 1536}'::JSONB)
ON CONFLICT (key) DO NOTHING;
