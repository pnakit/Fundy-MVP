# App Template — Dify + Vercel + Supabase Stack

A comprehensive guide for bootstrapping AI-powered apps using this stack. Distilled from building and iterating a production AI-powered app. Consult this before writing any code.

---

## Table of Contents

1. [Stack Overview & Rationale](#1-stack-overview--rationale)
2. [Project Structure](#2-project-structure)
3. [Environment Variables](#3-environment-variables)
4. [Supabase Setup](#4-supabase-setup)
5. [Vercel Serverless Functions](#5-vercel-serverless-functions)
6. [Authentication Pattern](#6-authentication-pattern)
7. [Dify Integration Patterns](#7-dify-integration-patterns)
8. [Dify Workflow Building — Hard-Won Rules](#8-dify-workflow-building--hard-won-rules)
9. [SSE Streaming Pattern](#9-sse-streaming-pattern)
10. [Knowledge Base & Vector Search Pipeline](#10-knowledge-base--vector-search-pipeline)
11. [Client-Side API Layer](#11-client-side-api-layer)
12. [Mock Mode Pattern](#12-mock-mode-pattern)
13. [File Upload Pipeline](#13-file-upload-pipeline)
14. [React App Architecture](#14-react-app-architecture)
15. [Testing Setup](#15-testing-setup)
16. [Linting & Formatting](#16-linting--formatting)
17. [Dev vs Production Routing](#17-dev-vs-production-routing)
18. [Security Checklist](#18-security-checklist)
19. [Vercel Deployment](#19-vercel-deployment)
20. [Common Failure Modes & Fixes](#20-common-failure-modes--fixes)
21. [Start Here: What to Do From Day 1](#21-start-here-what-to-do-from-day-1)
22. [Architectural Decisions — What Worked and What Didn't](#22-architectural-decisions--what-worked-and-what-didnt)
23. [Real Bugs Encountered & Their Root Causes](#23-real-bugs-encountered--their-root-causes)
24. [LLM Output Design Lessons](#24-llm-output-design-lessons)
25. [Dify Chatflow Design Guide](#25-dify-chatflow-design-guide)
26. [Action Item Lifecycle Pattern](#26-action-item-lifecycle-pattern)
27. [Direct OpenAI as Dify-Compatible Backend](#27-direct-openai-as-dify-compatible-backend)
28. [Model & Cost Selection](#28-model--cost-selection)
29. [Advanced Test Patterns](#29-advanced-test-patterns)
30. [App Phase State Machine](#30-app-phase-state-machine)
31. [Data Lifecycle & Re-runs](#31-data-lifecycle--re-runs)
32. [Error Tier Philosophy](#32-error-tier-philosophy)
33. [Dify Parallel Output Routing — The CATEGORY_ID Trick](#33-dify-parallel-output-routing--the-category_id-trick)
34. [Streaming Chat UX Pattern](#34-streaming-chat-ux-pattern)
35. [`import.meta.env` vs `process.env`](#35-importmetaenv-vs-processenv)
36. [Full-Stack Debugging Guide](#36-full-stack-debugging-guide)
37. [Supabase Migrations Workflow](#37-supabase-migrations-workflow)
38. [Seed & Test Data Scripts](#38-seed--test-data-scripts)
39. [Dify Studio Development Loop](#39-dify-studio-development-loop)
40. [`app_config` Table Pattern](#40-app_config-table-pattern)
41. [The Knowledge Context Endpoint](#41-the-knowledge-context-endpoint)
42. [Supabase Query Gotchas](#42-supabase-query-gotchas)
43. [Per-Topic Conversation State Pattern](#43-per-topic-conversation-state-pattern)
44. [React Performance in Streaming UIs](#44-react-performance-in-streaming-uis)
45. [Dify Env Vars vs START Node Inputs](#45-dify-env-vars-vs-start-node-inputs)
46. [Calling Postgres Functions — `supabase.rpc()`](#46-calling-postgres-functions--supabaserpc)
47. [Supabase Storage — File Buckets, Signed URLs, RLS](#47-supabase-storage--file-buckets-signed-urls-rls)
48. [Workflow Phase Persistence](#48-workflow-phase-persistence)
49. [Minimal Markdown Rendering in Chat](#49-minimal-markdown-rendering-in-chat)
50. [Local Serverless Testing with `vercel dev`](#50-local-serverless-testing-with-vercel-dev)

---

## 1. Stack Overview & Rationale

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React 18 + Vite | Fast dev server, no bundler config overhead |
| **Hosting** | Vercel | Auto-detects Vite + `/api` serverless functions, great free tier |
| **Auth** | Supabase Auth (email OTP) | Built-in `signInWithOtp()`, 50K MAU free tier, JWT integrates with RLS |
| **Database** | Supabase Postgres + RLS | Standard Postgres, auto-generated REST API, RLS = automatic multi-tenancy |
| **Vector DB** | Supabase pgvector | Same database, same RLS policies, adequate for MVP scale |
| **File Storage** | Supabase Storage | S3-compatible, RLS on buckets, integrated with same auth JWT |
| **AI Workflows** | Dify | Visual workflow builder, supports Chat + Workflow app types, SSE streaming |
| **LLM** | Via Dify (any model) + direct OpenAI for lightweight tasks | Dify for complex multi-step; OpenAI direct for simple classification |
| **Embeddings** | OpenAI text-embedding-3-small (1536 dims) | High quality, cost effective, widely supported |

### Key Architecture Principle: Dify Never Touches Supabase Directly

Dify stores secrets in plain text in its database and exposes them in workflow logs. The `service_role` key must **never** be stored in Dify. All Supabase writes from Dify-triggered actions go through Vercel serverless proxy endpoints authenticated with a shared `DIFY_WEBHOOK_SECRET`.

```
React App ──> supabase-js (user JWT, RLS enforced) ──> Supabase Postgres
React App ──> Vercel Serverless (JWT-validated)     ──> Supabase Postgres (service_role)
Dify      ──> Vercel Serverless (webhook-secret)    ──> Supabase Postgres (service_role)
```

---

## 2. Project Structure

```
src/
  main.jsx                  # Entry point — imports CSS, renders App
  App.jsx                   # Orchestrator — all state, render dispatch
  styles/app.css            # All CSS (extracted from inline styles)
  data/mockData.js          # Mock data constants
  api/
    supabaseClient.js       # Supabase client init (VITE_ vars)
    dataAccess.js           # Data access layer — all auth + DB reads/writes
    difyApi.js              # Dify API client (blocking, streaming, mock modes)
    workflowApi.js          # Streaming workflow client (SSE → progressive UI)
  utils/
    extractSummary.js       # LLM response parser — extracts structured JSON from markers
    colors.js               # Shared color constants and status/priority color helpers
    actionItems.js          # Pure functions for action item add/remove
    fileUpload.js           # File upload helpers
  components/
    LoginScreen.jsx         # Auth gate — email + OTP via Supabase Auth
    ChatPanel.jsx           # Reusable chat UI (messages + typing indicator + input)
    RadarChart.jsx          # SVG radar/spider chart (React.memo)
    ProgressRing.jsx        # SVG circular progress indicator (React.memo)
    ErrorBoundary.jsx       # Error boundary wrapper (per-window crash isolation)

supabase/
  migrations/
    001_initial_schema.sql  # Full DB schema

api/
  _auth.js                  # JWT validation middleware (Supabase JWKS via jose)
  _shared.js                # resolveApiKey(workflow) + getDifyBaseUrl()
  _supabase.js              # Supabase admin client (service_role, cached)
  _webhookAuth.js           # Webhook secret validation (Dify → Vercel auth)
  _chunking.js              # Text chunking (conversations, summaries, files)
  chat.js                   # POST /api/chat → Dify /chat-messages
  upload.js                 # POST /api/upload → Dify /files/upload
  chat/
    stop.js                 # POST /api/chat/stop
  knowledge/
    _knowledgeBase.js       # KB abstraction (internal pgvector)
    _embeddings.js          # OpenAI embedding client
    context.js              # GET/POST /api/knowledge/context
    embed.js                # POST /api/knowledge/embed
  summary.js                # POST /api/summary — upsert summary + embed
  workflow/
    generate.js             # POST /api/workflow/generate (SSE, Edge Runtime)
    save.js                 # POST /api/workflow/save
    _categoryContext.js     # Per-category context assembly
    _difyWorkflow.js        # Dify Workflow API + SSE stream transformation
  results/
    embed.js                # POST /api/results/embed
    refresh.js              # POST /api/results/refresh
    _analyze.js             # GPT-4o-mini classification helper
  account/
    delete.js               # POST /api/account/delete
```

### Critical: Vercel Hobby Plan = 12 Serverless Functions Max

Every non-`_`-prefixed `.js` file under `api/` becomes a Vercel function. Helpers and utilities **must** be `_`-prefixed. Count carefully before adding new endpoints. Upgrade to Pro if you need more than 12.

---

## 3. Environment Variables

### `.env` / `.env.local` (development)

```bash
# Dify
DIFY_BASE_URL=https://api.dify.ai/v1
DIFY_WORKFLOW_A_API_KEY=app-...   # primary conversational workflow
DIFY_WORKFLOW_B_API_KEY=app-...   # secondary per-topic workflow
DIFY_WORKFLOW_C_API_KEY=app-...   # analysis/generation workflow
DIFY_WORKFLOW_D_API_KEY=app-...   # optional fourth workflow
DIFY_WEBHOOK_SECRET=your-shared-secret
# NOTE: Rename these to match your actual workflow names (e.g., DIFY_ONBOARDING_API_KEY, DIFY_ANALYSIS_API_KEY).
# The key pattern is one env var per distinct Dify workflow.

# Supabase (client — bundled into build)
VITE_SUPABASE_URL=https://xyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Supabase (server — serverless functions only, NEVER expose to client)
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI (server only)
OPENAI_API_KEY=sk-...

# Feature flags (client — bundled into build)
VITE_DIFY_MOCK=false          # true = use mock responses, never hits Dify
VITE_DIFY_STREAMING=true      # true = SSE streaming mode

# KB selection
ACTIVE_KNOWLEDGE_BASE=internal  # 'internal' = Supabase pgvector
```

### Rules
- `VITE_`-prefixed vars are bundled into the client build — safe for public values (Supabase anon key, public URLs)
- `SUPABASE_SERVICE_ROLE_KEY` **only** in Vercel env vars, never in Dify, never in client
- `DIFY_WEBHOOK_SECRET` in both Vercel env vars and Dify workflow env vars

### `.env.example`

Always maintain `.env.example` with all keys listed but no real values. Commit it. Never commit `.env`.

---

## 4. Supabase Setup

### Step 1: Dashboard Configuration

Before writing code:

1. **Auth > Providers > Email**: Enable OTP, set expiry to `600` seconds
2. **Auth > SMTP Settings**: Use Resend SMTP (`smtp.resend.com:465`, username: `resend`, password: Resend API key). The default Supabase SMTP has a **2 emails/hour rate limit** — unusable for any real testing.
3. **Auth > Bot and Abuse Protection**: Enable hCaptcha or Cloudflare Turnstile
4. **Auth > Sessions**: Set JWT expiry to `900`–`1800` seconds (15–30 min)
5. **Auth > URL Configuration**: Add your production URL + `http://localhost:5173` as redirect URLs
6. **Database > Extensions**: Enable `pgvector`

### Step 2: Supabase CLI

```bash
npm install -D supabase
npx supabase init
npx supabase link --project-ref YOUR_PROJECT_REF
```

All schema changes go in `supabase/migrations/`. Push with:

```bash
npx supabase db push
```

### Step 3: Full Schema

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;
SET search_path TO public, extensions;

-- User profiles (created on first login)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,  -- rename to fit your domain (e.g., company_name, username)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conversations (one per workflow per user, or one per topic for secondary workflows)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow TEXT NOT NULL CHECK (workflow IN ('workflow_a', 'workflow_b')),  -- replace with your actual workflow names
  dify_conversation_id TEXT,
  category_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_conversations_user_workflow_category UNIQUE (user_id, workflow, category_id),
  CONSTRAINT chk_secondary_has_category CHECK (workflow != 'workflow_b' OR category_id IS NOT NULL)
);

-- Messages (append-only)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Workflow summaries (one per user, upserted)
-- One row per user. Stores the latest structured output of your primary workflow.
CREATE TABLE workflow_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_data JSONB NOT NULL,
  current_phase TEXT DEFAULT 'step_1',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_workflow_summaries_user UNIQUE (user_id)
);

-- Workflow results (one per user, upserted)
-- Stores structured LLM output per user. Shape is app-specific — use JSONB columns for flexibility.
CREATE TABLE workflow_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage_data JSONB,
  result_data JSONB,
  metrics_data JSONB,
  extended_data JSONB,  -- optional: store additional structured output inline
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_workflow_results_user UNIQUE (user_id)
);

-- Action items (user-managed, UUID primary key, append-only from AI)
CREATE TABLE action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_key TEXT,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed')),
  source_type TEXT NOT NULL,  -- use your own source type values (e.g., 'workflow_a', 'source_b')
  source_id TEXT,
  source_category TEXT,       -- category or topic the item belongs to
  file_ids TEXT[],
  custom_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add domain-specific tables for your app's entity relationships.
-- Examples: user selections, entity recommendations, user preferences, etc.
-- Pattern for a user-managed selection table:
-- CREATE TABLE user_selections (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--   entity_type TEXT NOT NULL,
--   selected BOOLEAN DEFAULT true,
--   created_at TIMESTAMPTZ DEFAULT now(),
--   CONSTRAINT uq_user_selections_user_type UNIQUE (user_id, entity_type)
-- );

-- File metadata
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

-- App configuration (global, read-only for clients)
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Deletion audit (admin only)
CREATE TABLE deletion_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_user_id UUID NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  deleted_by TEXT NOT NULL  -- 'user_request', 'admin'
);

-- Vector store (service_role only — no public access)
CREATE TABLE document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('conversation', 'file', 'summary')),  -- rename 'summary' to match your artifact type
  source_id UUID,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_document_embeddings_source_chunk UNIQUE (source_type, source_id, chunk_index)
);

-- ── INDEXES ──────────────────────────────────────────────────────────────────
-- Critical for RLS performance — every user_id FK column needs an index

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_user_created ON conversations(user_id, created_at DESC);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX idx_workflow_summaries_user_id ON workflow_summaries(user_id);
CREATE INDEX idx_workflow_results_user_id ON workflow_results(user_id);
CREATE INDEX idx_action_items_user_id ON action_items(user_id);
CREATE INDEX idx_action_items_user_status ON action_items(user_id, status);
CREATE INDEX idx_file_metadata_user_id ON file_metadata(user_id);
CREATE INDEX idx_document_embeddings_user_id ON document_embeddings(user_id);
CREATE INDEX idx_document_embeddings_source ON document_embeddings(source_type, source_id);

-- HNSW index for fast approximate nearest neighbor search (cosine distance)
CREATE INDEX idx_document_embeddings_vector
  ON document_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ── RLS POLICIES ─────────────────────────────────────────────────────────────

-- Full CRUD (user manages directly via supabase-js)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON user_profiles FOR ALL USING (auth.uid() = id);

ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own action items" ON action_items FOR ALL USING (auth.uid() = user_id);

-- Enable RLS on any domain-specific tables you add (see entity table pattern above)

-- Append-only (client can INSERT + SELECT; server manages UPDATE via service_role)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own conversations" ON conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own messages" ON messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own messages" ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Read-only for clients (server writes via service_role)
ALTER TABLE workflow_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own summary" ON workflow_summaries FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE workflow_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own results" ON workflow_results FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own files" ON file_metadata FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upload own files" ON file_metadata FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Global config: read-only for all, write via service_role only
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read config" ON app_config FOR SELECT USING (true);

-- Deletion audit + embeddings: service_role only (no public access)
ALTER TABLE deletion_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

-- ── TRIGGER: Enforce message ownership ───────────────────────────────────────

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

-- ── FUNCTION: Vector similarity search ───────────────────────────────────────

CREATE OR REPLACE FUNCTION search_embeddings(
  p_user_id UUID,
  p_embedding vector(1536),
  p_top_k INTEGER DEFAULT 5,
  p_similarity_threshold FLOAT DEFAULT 0.7,
  p_source_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  content TEXT, source_type TEXT, source_id UUID,
  chunk_index INTEGER, similarity FLOAT, metadata JSONB
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT de.content, de.source_type, de.source_id, de.chunk_index,
    (1 - (de.embedding <=> p_embedding))::FLOAT AS similarity, de.metadata
  FROM document_embeddings de
  WHERE de.user_id = p_user_id
    AND (p_source_types IS NULL OR de.source_type = ANY(p_source_types))
    AND (1 - (de.embedding <=> p_embedding)) >= p_similarity_threshold
  ORDER BY de.embedding <=> p_embedding
  LIMIT p_top_k;
END;
$$;
```

### Supabase Client (client-side)

```js
// src/api/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### Supabase Admin Client (server-side)

```js
// api/_supabase.js
import { createClient } from '@supabase/supabase-js';

let supabaseAdmin;

export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    supabaseAdmin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseAdmin;
}
```

---

## 5. Vercel Serverless Functions

### JWT Auth Middleware

Every endpoint that touches user data must call `verifyAuth(req)` first.

```js
// api/_auth.js
import { createRemoteJWKSet, jwtVerify } from 'jose';

const supabaseUrl = process.env.SUPABASE_URL;
let jwks;
function getJWKS() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  return jwks;
}

export async function verifyAuth(req) {
  if (!supabaseUrl) return { error: 'SUPABASE_URL not configured', status: 500 };

  const authHeader = typeof req.headers.get === 'function'
    ? req.headers.get('authorization')
    : req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { error: 'Missing authorization token', status: 401 };

  try {
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: `${supabaseUrl}/auth/v1`,
      audience: 'authenticated',
    });
    return { user: payload };
  } catch (err) {
    const message = err.code === 'ERR_JWT_EXPIRED' ? 'Token expired' : 'Invalid token';
    return { error: message, status: 401 };
  }
}
```

### Webhook Auth (Dify → Vercel)

```js
// api/_webhookAuth.js
import { timingSafeEqual } from 'crypto';

export function verifyWebhookSecret(req) {
  const secret = process.env.DIFY_WEBHOOK_SECRET;
  if (!secret) return { error: 'DIFY_WEBHOOK_SECRET not configured', status: 500 };
  const provided = req.headers['x-webhook-secret'] || req.headers.authorization?.replace('Bearer ', '');
  if (!provided) return { error: 'Missing webhook secret', status: 401 };
  try {
    const a = Buffer.from(secret), b = Buffer.from(provided);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { error: 'Invalid webhook secret', status: 401 };
    return { ok: true };
  } catch { return { error: 'Invalid webhook secret', status: 401 }; }
}
```

### API Key Routing

```js
// api/_shared.js
// Map workflow names to their env var keys — rename to match your actual workflow names.
const WORKFLOW_KEYS = {
  workflow_a: () => process.env.DIFY_WORKFLOW_A_API_KEY,  // primary workflow
  workflow_b: () => process.env.DIFY_WORKFLOW_B_API_KEY,  // secondary workflow
  workflow_c: () => process.env.DIFY_WORKFLOW_C_API_KEY,  // analysis/generation workflow
  workflow_d: () => process.env.DIFY_WORKFLOW_D_API_KEY,  // optional fourth workflow
};

export function resolveApiKey(workflow) {
  const getter = WORKFLOW_KEYS[workflow];
  const requestedKey = getter ? getter() : undefined;
  const fallbackKey = WORKFLOW_KEYS.workflow_a();  // primary workflow is the fallback
  return {
    apiKey: requestedKey || fallbackKey,
    usingFallback: !requestedKey && workflow !== 'workflow_a',
  };
}

export function getDifyBaseUrl() {
  return process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';
}
```

### Standard Endpoint Pattern (Node.js Runtime)

```js
// api/example.js
import { verifyAuth } from './_auth.js';
import { getSupabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyAuth(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const userId = auth.user.sub;  // Supabase user UUID
  const { someField } = req.body;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('my_table').select('*').eq('user_id', userId);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ data });
}
```

### SSE Streaming Endpoint (Edge Runtime)

Use Edge Runtime for SSE endpoints — it supports streaming responses. Node.js runtime does not stream properly.

```js
// api/streaming-example.js
import { verifyAuth } from './_auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  const auth = await verifyAuth(req);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status, headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = auth.user.sub;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        sendEvent({ type: 'status', message: 'Starting...' });
        // ... do work, call sendEvent for each progress update ...
        sendEvent({ type: 'complete', result: {} });
      } catch (err) {
        sendEvent({ type: 'error', message: err.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

### `vercel.json`

```json
{
  "functions": {
    "api/chat.js": { "maxDuration": 60 },
    "api/workflow/generate.js": { "maxDuration": 60 }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

Set `maxDuration: 60` on any endpoint that proxies to Dify with long workflows.

---

## 6. Authentication Pattern

### Two-Step OTP Flow

```jsx
// src/components/LoginScreen.jsx (abbreviated)
import { signInWithOtp, verifyOtp } from '../api/dataAccess';

function LoginScreen({ onLogin }) {
  const [step, setStep] = useState('email');  // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithOtp(email);
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  async function handleOtpSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await verifyOtp(email, otp);
      onLogin(data.session);
    } catch (err) {
      setError('Invalid or expired code. Please try again.');
    } finally { setLoading(false); }
  }

  // render email form or OTP form based on step
}
```

### Session Listener in App.jsx

```js
// In App.jsx useEffect
useEffect(() => {
  // Restore existing session on page load
  getSession().then(session => {
    if (session) {
      setUser(session.user);
      loadUserData(session.user.id);
    }
    setAuthLoading(false);
  });

  // Listen for auth state changes (login, logout, token refresh)
  const unsubscribe = onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      setUser(session.user);
      loadUserData(session.user.id);
    } else if (event === 'SIGNED_OUT') {
      setUser(null);
      clearAllState();
    } else if (event === 'TOKEN_REFRESHED' && session) {
      setUser(session.user);  // keep user updated
    }
  });

  return unsubscribe;
}, []);
```

### Getting Auth Headers for API Calls

```js
// In difyApi.js or any client-side API call
async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

---

## 7. Dify Integration Patterns

### Dify App Types

| Type | Use When | API Endpoint |
|------|----------|-------------|
| **Chat** | Conversational, multi-turn, context persists | `POST /chat-messages` |
| **Workflow** | Single-shot, structured I/O, one call returns result | `POST /workflows/run` |

### Chat Proxy (`api/chat.js`)

The chat endpoint routes to the correct Dify API key based on the `workflow` field in the request body. It handles both blocking and streaming modes.

Key patterns:
- `workflow` field in request body → `resolveApiKey(workflow)` → correct API key
- `response_mode: 'streaming'` → pipe SSE stream directly to client
- `response_mode: 'blocking'` → wait for full response, return JSON
- File text is extracted from `node_finished` SSE events and embedded into vector store during the stream

### Chat Request Format

```js
// POST /api/chat
{
  workflow: 'workflow_a' | 'workflow_b' | 'workflow_c',  // your workflow names
  query: 'user message',
  conversation_id: 'existing-dify-id or empty string',
  response_mode: 'streaming' | 'blocking',
  user: 'supabase-user-uuid',
  files: [
    { type: 'document', transfer_method: 'local_file', upload_file_id: 'dify-file-id' }
  ],
  inputs: {}  // workflow-specific inputs (e.g., topic_id for per-topic secondary workflows)
}
```

### Workflow Request Format

```js
// POST /api/workflow/generate (example)
// Body:
{
  userId: 'supabase-user-uuid',
  workflowSummary: { /* structured output from primary workflow */ }
}
// Returns: SSE stream
```

### SSE Event Parsing (Client Side)

```js
// src/utils/extractSummary.js — parseSSELine
export function parseSSELine(line) {
  if (!line.startsWith('data:')) return null;
  const raw = line.slice(5).trim();
  if (!raw || raw === '[DONE]') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
```

### Structured Output with Markers

For any LLM that needs to return structured data embedded in conversation text, use delimiter markers:

```
[SUMMARY_START]
{ "json": "goes here" }
[/SUMMARY_END]
```

The client parser:
1. Finds the delimiters
2. Strips markdown code fences (LLMs sometimes wrap JSON in ` ```json ``` `)
3. Fixes trailing commas
4. `JSON.parse()`
5. Validates all required fields
6. Normalizes and fills defaults

This approach is more robust than asking the LLM to return pure JSON — it survives conversational text before/after the JSON block.

---

## 8. Dify Workflow Building — Hard-Won Rules

**Read `DifyTactics.md` before building any workflow.** Key lessons:

### Rule 1: Type Coercion — LLM text → Code Node

When an LLM node outputs valid JSON as its `text` variable (String type), Dify sometimes auto-parses it into a Python dict before passing it downstream. Your Code node then receives a dict, not a string, and Dify's framework calls `.replace()` on it, crashing with:

```
'dict' object has no attribute 'replace'
```

**Fix:** Parse LLM JSON output in your JavaScript SSE handler (`_difyWorkflow.js`), not in a downstream Code node.

```js
// In _difyWorkflow.js node_finished handler
if (outputs.text) {
  try {
    let text = outputs.text.trim();
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();
    const parsed = JSON.parse(text);
    if (parsed.my_expected_key) {
      return { type: 'my_event', data: parsed };
    }
  } catch (_e) {}
}
```

### Rule 2: `json.dumps()` Output → Declare as String, Not Object

If your Python Code node returns `json.dumps(some_dict)`, declare the output type as **String** in Dify. If you declare it Object or Array, Dify coerces it and passes `1` or `KeyError: 1` downstream.

| Python return | Dify output type |
|---|---|
| `json.dumps(obj)` | **String** |
| `obj` (raw dict) | Object |
| `list_val` (raw list) | Array |

### Rule 3: Downstream Code Receiving JSON Strings — Handle Both Forms

A Code node receiving a `json.dumps` string may get it already parsed (Dify is inconsistent). Always normalize:

```python
if isinstance(category_scores, dict):
    scores = category_scores
else:
    scores = json.loads(category_scores)
```

### Rule 4: Variable Aggregator — Normalize All Three Input Forms

The Variable Aggregator can deliver in three different forms depending on configuration and test context:

```python
if isinstance(aggregated_data, str):
    aggregated_data = json.loads(aggregated_data)
if isinstance(aggregated_data, dict):
    aggregated_data = list(aggregated_data.values())
# Filter out non-dict scalar values (e.g., user_id string leaking in)
aggregated_data = [item for item in aggregated_data if isinstance(item, dict)]
```

### Rule 5: Node Title Case is Case-Sensitive in SSE Events

Dify emits node titles in SSE events exactly as they are named in the UI. JavaScript comparison is case-sensitive.

**Always normalize:**
```js
const nodeTitle = (event.data?.title || '').toLowerCase();
```

**Name all nodes in lowercase in Dify Studio** to prevent silent failures.

### Rule 6: Variable Binding — Verify Both Node and Output Variable

After building any new workflow, open each Code node and verify:
- The bound input points to the **correct upstream node** (not just a node with a similar name)
- The bound input points to the **correct output variable** on that node (e.g., `category_scores` not `category_details`)
- Types match (Number → Number, String → String)

Symptom of wrong binding: `KeyError: 1` or `KeyError: 320` in dict lookups.

### Rule 7: Dify Studio Test Panel vs Run Panel

| Panel | Behavior |
|-------|---------|
| **Test panel** (single node) | Passes all input as a **JSON string**, even Object inputs. Paste the full object as text. |
| **Run panel** (full workflow) | Shows each START variable as a separate field. Paste **only the value** — not `"key": value` pairs. For Object variables: `{"field": "value"}`. For Strings: `my-user-id`. |

Common mistake: Pasting `"variable_name": {"field": "value"}` into the Run panel. Dify will reject it.

### Rule 8: Vercel 60s Idle Timeout — Add Keepalive Nodes

Vercel drops SSE connections that are idle (no bytes) for 60 seconds. Silent workflow phases (parallel KB queries, parallel LLM nodes) can exceed this.

**Fix:** Add lightweight Code nodes at silent points — they complete in <1s and emit a `node_finished` event, resetting the idle timer. Name them `workflow_kickstart`, `workflow_evaluating`, etc.

Split very long workflows into multiple API calls (e.g., Phase 1 → Phase 2 separate endpoint).

### Rule 9: Detect by Output Shape, Not Node Title

For complex workflows, detect result events by checking for specific output keys on any `node_finished` event:

```js
// Check for a key that uniquely identifies this result type
if (outputs.phase_two_result) {
  return { type: 'phase_two_complete', data: outputs };
}
```

This is more robust than title matching because the title can change without breaking detection.

### Rule 10: Always Strip Markdown Code Fences

LLMs sometimes wrap JSON in ` ```json ... ``` ` even when instructed not to. Always strip:

```js
const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
if (fenceMatch) text = fenceMatch[1].trim();
```

### Rule 11: Why Retrieval Belongs in Your API, Not Dify

Dify's Knowledge Base (KB) node cannot swap dynamically between backends. By doing retrieval in your Vercel endpoint (parallel semantic searches) and passing pre-assembled context strings as Dify START node inputs, you:
- Can swap the KB backend without changing any Dify workflow
- Can test context quality independently
- Can run all 10 parallel searches before Dify even starts

### Rule 12: Budget for Dify Processing Overhead

Add 5–10 seconds of buffer when estimating workflow duration for timeout planning. A workflow that looks like it should complete in 40 seconds will often take 50+.

---

## 9. SSE Streaming Pattern

### Streaming Workflow Events (Client Side)

```js
// src/api/workflowApi.js
export async function streamWorkflow(payload, { onEvent, onError }) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  let response;
  try {
    response = await fetch('/api/workflow/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    onError(err.message);
    return;
  }

  if (!response.ok) {
    onError(`Server error: ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        try {
          const event = JSON.parse(line.slice(5).trim());
          onEvent(event);
        } catch (_) {}
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

### Key SSE Patterns

- Always maintain a `buffer` and split on `\n` — chunks can arrive mid-event
- `buffer = lines.pop()` — the last element may be a partial line; carry it to the next chunk
- Flush remaining `buffer` after stream ends (last event may lack trailing newline)
- The client should always handle an `error` event type gracefully (show error, don't crash)

---

## 10. Knowledge Base & Vector Search Pipeline

### Architecture

Retrieval happens in your API, not in Dify. This allows KB backend swapping without modifying Dify workflows.

```
User Request
  → Vercel Endpoint
    → Embed query (OpenAI text-embedding-3-small)
    → search_embeddings() Postgres function (cosine similarity, topK=5, threshold=0.5)
    → Assemble context strings
    → Call Dify workflow with context as START node inputs
```

### Embedding Generation

```js
// api/knowledge/_embeddings.js
const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings';
const MODEL = 'text-embedding-3-small';

export async function generateEmbeddings(texts) {
  // texts: string[] — batch all at once for efficiency
  const response = await fetch(OPENAI_EMBED_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });
  if (!response.ok) throw new Error(`OpenAI embeddings failed: ${response.status}`);
  const data = await response.json();
  return data.data.map(item => item.embedding);  // float[][]
}
```

### Chunking Strategy

```
Conversations  → message-pair windows with 1-pair overlap
Summaries      → one chunk per category (fine-grained retrieval)
Files          → ~2000 char windows with 400 char overlap
```

### Semantic Search Call

```js
const supabase = getSupabaseAdmin();
const [queryEmbedding] = await generateEmbeddings([query]);

const { data: results } = await supabase.rpc('search_embeddings', {
  p_user_id: userId,
  p_embedding: JSON.stringify(queryEmbedding),
  p_top_k: 5,
  p_similarity_threshold: 0.5,
  p_source_types: ['conversation', 'summary'],  // null = all types
});

const context = results?.map(r => r.content).join('\n\n') || '';
```

### Upsert Embeddings

```js
const rows = chunks.map((chunk, i) => ({
  user_id: userId,
  source_type: 'conversation',  // 'conversation' | 'file' | 'summary'
  source_id: conversationId,    // UUID of the source record
  chunk_index: i,
  content: chunk.content,
  embedding: JSON.stringify(embeddings[i]),
  metadata: { workflow: 'workflow_a', topic_id: chunk.topicId },
}));

await supabase
  .from('document_embeddings')
  .upsert(rows, { onConflict: 'source_type,source_id,chunk_index' });
```

### Delete Stale Chunks Before Re-Embedding

When re-embedding a document/conversation that may have changed, delete old chunks first:

```js
await supabase
  .from('document_embeddings')
  .delete()
  .eq('user_id', userId)
  .eq('source_type', 'conversation')
  .eq('source_id', conversationId);
// Then upsert fresh chunks
```

---

## 11. Client-Side API Layer

### `dataAccess.js` Pattern

All Supabase client calls go through `dataAccess.js`. This thin adapter means if you swap providers, only this file changes.

```js
// src/api/dataAccess.js — key functions

// Auth
export async function signInWithOtp(email) { /* supabase.auth.signInWithOtp() */ }
export async function verifyOtp(email, token) { /* supabase.auth.verifyOtp() */ }
export async function signOut() { /* supabase.auth.signOut() */ }
export async function getSession() { /* supabase.auth.getSession() */ }
export function onAuthStateChange(callback) { /* returns unsubscribe fn */ }

// Data reads (RLS enforced — user only sees own data)
export async function loadWorkflowSummary() { /* .from('workflow_summaries').maybeSingle() */ }
export async function loadWorkflowResults() { /* .from('workflow_results').maybeSingle() */ }
export async function loadActionItems() { /* .from('action_items').select('*') */ }
// Add domain-specific load functions as needed (e.g., loadUserSelections)

// Data writes
export async function saveActionItem(item, userId) { /* .upsert({...}, { onConflict: 'id' }) */ }
export async function updateActionItemStatus(itemId, status) { /* .update({ status }) */ }

// Conversations
export async function createConversation(workflow, topicId) { /* .insert({...}).select('id').single() */ }
export async function updateConversationDifyId(dbId, difyId) { /* .update({ dify_conversation_id: difyId }) */ }
export async function saveMessages(conversationDbId, userId, pairs) { /* .insert(rows) */ }
export async function loadMessages(conversationDbId) { /* .select('role, content').order('created_at') */ }
```

### `difyApi.js` Pattern

The Dify API client handles three modes:
1. `VITE_DIFY_MOCK=true` → mock responses (no network calls)
2. `VITE_DIFY_STREAMING=true` → SSE streaming mode
3. Default → blocking mode

```js
const DifyAPI = {
  get useStreaming() { return import.meta.env.VITE_DIFY_STREAMING === 'true'; },
  get isMock() { return import.meta.env.VITE_DIFY_MOCK === 'true'; },

  async sendMessage(message, conversationId, files, user, workflow, inputs) {
    if (this.isMock) return this.sendMessageMock(message, conversationId);
    const authHeaders = await getAuthHeaders();
    // POST /api/chat with workflow + query + conversation_id + files + inputs
  },

  async sendMessageStreaming(message, conversationId, files, user, onChunk, workflow, onProgress, inputs) {
    // Stream SSE, call onChunk with accumulated text on each 'message' event
  },

  async uploadFile(file, user, workflow) {
    // POST /api/upload?workflow=... with FormData
  },
};
```

---

## 12. Mock Mode Pattern

**Three-layer fallback** — always implement in this order:

1. `VITE_DIFY_MOCK=true` → client-side mock (never hits server, works offline)
2. Server endpoint returns 404 in dev (proxy doesn't exist) → client auto-falls back to mock
3. Server has no API key configured → server-side mock derived from available data

```js
// Example: workflowApi.js with 404 fallback
async function startWorkflow(payload, handlers) {
  // Layer 1: explicit mock flag
  if (import.meta.env.VITE_DIFY_MOCK === 'true') {
    return streamMockWorkflow(handlers);
  }

  try {
    const response = await fetch('/api/workflow/generate', { /* ... */ });

    // Layer 2: 404 in dev = endpoint doesn't exist, fall back to mock
    if (response.status === 404) {
      console.warn('[workflowApi] /api/workflow/generate not found — using mock mode');
      return streamMockWorkflow(handlers);
    }

    // Real mode: stream SSE
    await streamResponse(response, handlers);
  } catch (err) {
    handlers.onError(err.message);
  }
}
```

Mock functions should:
- Use `setTimeout` delays (300–800ms) to simulate real network/processing time
- Exercise the same code paths as real mode (same event types, same state updates)
- Be easy to trigger (keywords like "summary" / "finish" in the chat for testing)

---

## 13. File Upload Pipeline

### Upload to Dify (current pattern)

```js
// api/upload.js
export const config = { api: { bodyParser: false } };  // Required for multipart

export default async function handler(req, res) {
  const { apiKey } = resolveApiKey(req.query.workflow || 'workflow_a');
  // Forward multipart/form-data directly to Dify /files/upload
  // Return { id, name } from Dify response
}
```

### Client-Side Upload

```js
// src/utils/fileUpload.js
export async function uploadFiles(files, user, workflow = 'workflow_a') {
  const results = await Promise.allSettled(
    files.map(file => DifyAPI.uploadFile(file, user, workflow))
  );
  return results.map((r, i) => ({
    file: files[i],
    success: r.status === 'fulfilled',
    fileId: r.value?.fileId,
    error: r.reason?.message,
  }));
}

export function buildUploadMessages(uploadResults) {
  // Returns user-visible messages for each upload (success/failure)
  return uploadResults.map(r => ({
    role: 'user',
    content: r.success ? `[File: ${r.file.name}]` : `[Upload failed: ${r.file.name}]`,
    isFile: true,
    isError: !r.success,
  }));
}
```

### File Text Extraction (Dify-side)

Add a File Extractor node in Dify (between file input and LLM), then a Code node that relays the extracted text:

```python
# Code node: "File Text Relay"
def main(file_text: str) -> dict:
    return {"file_text": file_text}
```

In `api/chat.js`, detect this `node_finished` event and embed the text:

```js
if (event.data?.title === 'File Text Relay') {
  capturedFileText = event.data?.outputs?.file_text;
}
```

---

## 14. React App Architecture

### State Management Philosophy

No state management library needed for MVP-scale apps. Use `useState` + `useRef` + `useEffect` in a single orchestrator component (`App.jsx`). Extract to separate files/components only when there's genuine reuse or the component becomes independently testable.

### When to Stay in App.jsx vs Extract

| Stay in App.jsx | Extract to component/module |
|---|---|
| State shared across 2+ views | Pure UI with props |
| Event handlers that update shared state | Reusable UI pattern (ChatPanel, ProgressRing) |
| Conditional render dispatch | Pure functions (color helpers, parsers) |
| | API clients (difyApi.js, dataAccess.js) |

### Key Patterns

**Action item IDs:** Use `crypto.randomUUID()`. These serve as Supabase primary keys directly — no conversion needed.

**Error boundary per view:**
```jsx
<ErrorBoundary name="Results">
  {renderResultsWindow()}
</ErrorBoundary>
```

**`replaceLastMessage` helper:**
```js
const replaceLastMessage = (messages, newMsg) => [...messages.slice(0, -1), newMsg];
```

**Streaming message dual-update pattern:**
```js
// During stream: show partial text with isStreaming flag
setMessages(prev => replaceLastMessage(prev, { role: 'assistant', content: partial, isStreaming: true }));
// On completion: replace with final message (no isStreaming flag)
setMessages(prev => replaceLastMessage(prev, { role: 'assistant', content: final }));
```

**Centralize all colors:**
```js
// src/utils/colors.js
export const COLORS = {
  success: '#10b981', warning: '#f59e0b', danger: '#ef4444',
  primary: '#6366f1', muted: '#6b7280',
};
export function getPriorityColor(priority) { /* ... */ }
export function getStatusColor(status) { /* ... */ }
```

### Styling

- All CSS in a single `src/styles/app.css` file (imported in `main.jsx`)
- No CSS-in-JS, no CSS Modules — fine for MVP
- Load fonts via `<link>` tags in `index.html` with `preconnect` hints (not in CSS `@import`)
- Dark theme defaults well; glassmorphism with `backdrop-filter: blur()` looks great on dark backgrounds

---

## 15. Testing Setup

### Installation

```bash
npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

### `vite.config.js`

```js
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
});
```

### Test Setup File

```js
// src/test/setup.js
import '@testing-library/jest-dom';
```

### `package.json` Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

### What to Test

| Priority | What | Why |
|---|---|---|
| **High** | LLM response parsers (`extractSummary`, `extractResults`) | Edge cases in LLM output are the #1 failure mode |
| **High** | Color helpers and status derivation | Logic bugs are invisible in UI testing |
| **High** | Action item add/remove utils | Pure functions, easy to test, critical for correctness |
| **High** | Data access layer (`dataAccess.js`) | Mock Supabase, test all paths including error paths |
| **Medium** | Auth flow (`LoginScreen.jsx`) | Test OTP flow, error states, back navigation |
| **Medium** | SSE parsing (`parseSSELine`, `_difyWorkflow.js`) | Streaming bugs are hard to reproduce manually |
| **Medium** | Chunking utilities | Off-by-one errors in chunking windows |
| **Low** | Pure presentational components | Vitest + RTL can test, but low bug density |

### Mocking Pattern

```js
// Mock supabase-js in tests
vi.mock('../api/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }),
  },
}));
```

---

## 16. Linting & Formatting

### Installation

```bash
npm install -D eslint @eslint/js eslint-plugin-react eslint-plugin-react-hooks \
  eslint-plugin-react-refresh eslint-config-prettier eslint-plugin-prettier \
  prettier globals
```

### `eslint.config.js`

```js
import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      prettier: prettierPlugin,
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'prettier/prettier': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react/react-in-jsx-scope': 'off',
    },
  },
  prettierConfig,
  { ignores: ['dist/', 'node_modules/', 'coverage/'] },
];
```

### `.prettierrc`

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 120,
  "semi": true
}
```

### `package.json` Scripts

```json
{
  "scripts": {
    "lint": "eslint src api",
    "lint:fix": "eslint src api --fix",
    "format": "prettier --write src api"
  }
}
```

---

## 17. Dev vs Production Routing

### Problem

Vercel serverless functions don't run locally in `npm run dev`. The Vite dev server needs proxy rules to forward API calls somewhere.

### Solution

```js
// vite.config.js
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Proxy /api/chat directly to Dify (always uses primary workflow key in dev)
        '/api/chat': {
          target: env.DIFY_BASE_URL || 'https://api.dify.ai/v1',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api\/chat/, '/chat-messages'),
          configure: proxy => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${env.DIFY_WORKFLOW_A_API_KEY}`);
            });
          },
        },
        '/api/upload': {
          target: env.DIFY_BASE_URL || 'https://api.dify.ai/v1',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api\/upload.*/, '/files/upload'),
          configure: proxy => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const url = new URL(req.url, 'http://localhost');
              const workflow = url.searchParams.get('workflow') || 'workflow_a';
              const key = env[`DIFY_${workflow.toUpperCase()}_API_KEY`] || env.DIFY_WORKFLOW_A_API_KEY;
              proxyReq.setHeader('Authorization', `Bearer ${key}`);
            });
          },
        },
        // NOTE: /api/workflow/generate has NO proxy — 404 in dev triggers mock fallback
      },
    },
  };
});
```

### Routing Table

| Endpoint | Dev | Production |
|---|---|---|
| `/api/chat` | Vite proxy → Dify directly (primary workflow key only) | Vercel fn → `api/chat.js` → Dify (correct key per workflow) |
| `/api/upload` | Vite proxy → Dify directly | Vercel fn → `api/upload.js` → Dify |
| `/api/workflow/generate` | 404 → client mock fallback | Vercel fn → `api/workflow/generate.js` |
| `/api/summary` | 404 (no proxy) → no-op or mock | Vercel fn |

**Secondary workflow routing (workflow_b, workflow_c) only works fully in production.** Mock mode (`VITE_DIFY_MOCK=true`) is the recommended dev workflow.

---

## 18. Security Checklist

### Before Any Public Testing (Beta Blockers)

- [ ] Supabase custom SMTP configured (Resend — default 2 emails/hr limit kills testing)
- [ ] JWT validation on all serverless endpoints (`verifyAuth`)
- [ ] `service_role` key only in Vercel env vars — never in Dify, never in client code
- [ ] All `user_id` FK columns have indexes (critical for RLS policy performance)
- [ ] All FK references to `auth.users` have `ON DELETE CASCADE`
- [ ] All tables have RLS enabled
- [ ] `UNIQUE` constraints on all "one per user" tables

### Strongly Recommended (Pre-Launch)

- [ ] OTP expiry set to 600 seconds (10 min) in Supabase dashboard
- [ ] hCaptcha or Cloudflare Turnstile on OTP endpoint
- [ ] Security headers in `vercel.json` (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- [ ] `onAuthStateChange` redirects to login on session expiry
- [ ] JWT expiry set to 900–1800 seconds in Supabase dashboard
- [ ] `DIFY_WEBHOOK_SECRET` uses timing-safe comparison (`timingSafeEqual` from `crypto`)

### NEVER Do

- Store `service_role` key anywhere Dify can read it
- Store any secret in `VITE_`-prefixed env vars (they're bundled into the client build)
- Use `--no-verify` on git hooks
- Skip auth on endpoints that read/write user data

---

## 19. Vercel Deployment

### Initial Setup

1. Push to GitHub
2. Import project in Vercel dashboard
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. Add all environment variables in Vercel project settings
7. Deploy

### Custom Domain

1. Add domain in Vercel project settings
2. Add the CNAME record at your DNS provider
3. Add `https://yourdomain.com` to Supabase Auth URL Configuration

### Function Duration

Set in `vercel.json`:
```json
{
  "functions": {
    "api/chat.js": { "maxDuration": 60 },
    "api/workflow/generate.js": { "maxDuration": 60 }
  }
}
```

Default is 10s on Hobby plan. Max is 60s on Hobby, 300s on Pro.

### Hobby Plan Limits

- **12 serverless functions** — `_`-prefix all helpers
- **60s max function duration** — split long workflows into multiple calls
- **No Edge Function duration limit** — but Edge Runtime doesn't support Node.js APIs

---

## 20. Common Failure Modes & Fixes

### "No API keys configured" in production

Env vars in Vercel project settings are not automatically available — they must be added before deployment. Re-deploy after adding.

### SSE stream works in dev but times out in production

Vercel drops idle connections after 60s. Add keepalive Code nodes in Dify. Split long workflows.

### `'dict' object has no attribute 'replace'` in Dify Code node

LLM JSON output being auto-parsed by Dify before reaching the Code node. Parse in `_difyWorkflow.js` instead.

### `KeyError: 1` in Dify Code node

Variable binding is pointing to the wrong output variable or the wrong upstream node. Verify all bindings manually.

### Downstream workflow events silently not firing

Node title case mismatch. Always `.toLowerCase()` before comparing node titles.

### Supabase OTP emails not arriving

Rate limit hit (2/hr on default SMTP). Configure Resend custom SMTP immediately.

### `SUPABASE_URL not configured` from `_auth.js`

The `SUPABASE_URL` (no `VITE_` prefix) env var is missing from Vercel. Both `VITE_SUPABASE_URL` (client) and `SUPABASE_URL` (server) must be set separately.

### RLS blocking all reads after deploy

Missing `CREATE POLICY` or wrong `auth.uid()` reference. Also check: indexes on `user_id` — missing indexes cause RLS policies to do full table scans and time out.

### File upload fails in dev

The Vite proxy for `/api/upload` rewrites the path but the `bodyParser: false` config only applies in Vercel. In dev, the proxy forwards the raw multipart directly to Dify — this usually works fine.

### `crypto.randomUUID()` not available

Only available in HTTPS or localhost contexts. Will fail on `http://` non-localhost. Vercel deploys are always HTTPS. For local dev, use `http://localhost:5173` (not `http://192.168.x.x:5173`).

---

## Appendix: Package Dependencies

```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@supabase/supabase-js": "^2.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "jsdom": "^24.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "eslint": "^9.0.0",
    "@eslint/js": "^9.0.0",
    "eslint-plugin-react": "^7.0.0",
    "eslint-plugin-react-hooks": "^4.0.0",
    "eslint-plugin-react-refresh": "^0.4.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-prettier": "^5.0.0",
    "prettier": "^3.0.0",
    "globals": "^15.0.0"
  },
  "serverDependencies": {
    "jose": "^5.0.0"
  }
}
```

`jose` is only used in serverless functions (JWT verification). Install in the project root — Vercel bundles it automatically.

---

## 21. Start Here: What to Do From Day 1

These are the things most commonly deferred in AI app MVPs and painful to retrofit later. Do all of them before writing any feature code.

### Infrastructure (non-negotiable)

**1. Supabase auth from day 1 — not a password gate.**
A hardcoded `VITE_APP_PASSWORD` in an env var feels like a fast start. It isn't. You'll replace it entirely once real users need accounts, losing all the early test data that was stored under a fake user. Supabase OTP takes 2 hours to set up and the session/auth-state-change pattern touches every part of the app. Do it first.

**2. Custom SMTP from day 1.**
Supabase's built-in SMTP sends 2 emails per hour. You will hit this limit on your second test session. Set up Resend (`smtp.resend.com`, port 465, username `resend`, password = Resend API key) before you test auth with anyone outside your machine.

**3. UUID primary keys for any entity that will be persisted.**
`Date.now() + Math.random()` IDs look fine in state. They break the moment you try to use them as Supabase primary keys. Use `crypto.randomUUID()` from the very first action item, message, or entity you create. It works in any HTTPS or localhost context. Zero migration cost later.

**4. `_`-prefix convention for API helpers from day 1.**
You will hit the Vercel Hobby 12-function limit. When you do, you'll have to rename files mid-project and update 10 import paths. Establish the rule immediately: any `.js` file under `api/` that is not a public endpoint must start with `_`.

**5. Environment variables split correctly from day 1.**
- `VITE_`-prefixed → client bundle (safe for public values only)
- No prefix → server only (never bundled)
- Document both in `.env.example` from commit 1

**6. `vercel.json` with security headers from day 1.**
Takes 5 minutes, affects every response, and is required before any real user data passes through.

### Code Quality (prevents expensive refactors)

**7. Extract CSS to a static file from day 1.**
Inline CSS in a `<style>` tag inside JSX generates a 1000-line template literal that React diffs on every render. It also can't be linted, formatted, or cached. One `src/styles/app.css` file eliminates all of this.

**8. Centralize color constants from day 1.**
Every time you hardcode `#10b981` somewhere, you create a future find-replace session. One `src/utils/colors.js` with `COLORS.success`, `COLORS.warning`, etc. from the start.

**9. Set up Vitest + RTL from day 1.**
Starting without tests means your first refactor is done blind. You will break things and not know until a user reports it. The setup takes 20 minutes. LLM response parsers especially — they are the highest-density source of subtle bugs and the cheapest things to test.

**10. ESLint + Prettier from day 1.**
Catching `no-unused-vars` and React hook dependency issues at save time costs nothing. Cleaning up hundreds of lint errors after the fact takes hours and pollutes the diff.

### Dify Workflow Design

**11. Design per-branch env vars from day 1, not a single monolithic env var.**
If your workflow has N parallel branches, each branch needs its own context and instructions. A single `WORKFLOW_FRAMEWORK` env var shared across all N LLM nodes becomes an unmaintainable wall of text. Use one Dify env var per branch. This is how Dify Studio is designed to be used.

**12. Add `user_id` as an explicit START node input variable.**
`sys.user_id` in Dify Studio is Dify's own internal user ID — it is not your application's user UUID. If your workflow needs to query your database with the user's real ID, pass it explicitly as a START node input. Otherwise, testing in Dify Studio is impossible (you can't inject `sys.user_id`).

**13. Name all Dify nodes in lowercase from day 1.**
SSE events expose node titles exactly as they appear in the UI. JavaScript comparison is case-sensitive. One uppercase letter causes silent failures that look like the event never fired. Lowercase everything from the start.

**14. Scope your LLM output from day 1 — don't let it grow unbounded.**
Without explicit limits, an LLM generating recommendations will produce 30–50 per topic × N topics = hundreds of items. This is unusable. Design output constraints before writing the prompt: max N items per topic, consolidated. Far harder to fix after the fact because users accumulate the old outputs.

### Data Design

**15. Design the Supabase schema against `datastructure.md` equivalents before writing migrations.**
Every data shape the LLM outputs, every field the client displays, every thing that persists needs to be written down and agreed on before the first `CREATE TABLE`. Migrations are cheap to write but expensive to coordinate once production data exists.

**16. Put `UNIQUE` constraints on all "one per user" tables immediately.**
`workflow_summaries`, `workflow_results` — all upserted. Without the constraint, every re-run creates a new row. Retrofitting `UNIQUE` constraints after data exists means deduplication migrations.

**17. Plan the RLS policy types before writing tables.**
Three patterns cover everything:
- **Full CRUD** (user manages directly): action items, user selections, preferences
- **Append-only** (client inserts, server updates): conversations, messages
- **Read-only for client** (server writes via service_role): workflow summaries, results, embeddings

Don't discover this distinction mid-build; it determines whether you need a serverless endpoint or can write from the client directly.

---

## 22. Architectural Decisions — What Worked and What Didn't

### What Worked

**Retrieval in your API, not in Dify.**
Dify's Knowledge Base node is statically configured — it can't swap backends dynamically. By running KB searches in `/api/workflow/generate` and passing pre-assembled context strings as Dify START node inputs, the entire KB layer is invisible to Dify. This paid off immediately: it allowed switching from fake embeddings to real ones, tuning similarity thresholds, and adjusting `topK` without touching any Dify workflow. Verdict: do this from day 1.

**Three-layer mock fallback.**
`VITE_DIFY_MOCK=true` → client mock, 404 in dev → auto-fallback, no API key → server mock. This meant the full app was testable locally without any external service configured, and every code path ran (same state updates, same event types). No test data leakage to production, no "it works in mock but fails in real." Verdict: copy this pattern exactly.

**`useRef` for conversation DB IDs inside streaming callbacks.**
Streaming callbacks close over state at the time they're created. If you store a freshly-created conversation UUID in `useState`, the callback that fires 3 seconds later sees the stale `null` value, creates a second row, and you have duplicates. Storing the UUID in a `useRef` — which is a mutable box that survives re-renders — eliminates this class of bug entirely. Verdict: any ID that is created inside a streaming handler and used later in a fire-and-forget write must live in a ref.

**Fire-and-forget persistence.**
`persistSummary()`, `persistResults()` are called immediately after state is set, but the UI never awaits them. The user sees the result instantly; the DB write races in the background. Failures are logged but never surface to the user. This is the right tradeoff for an MVP: persistence failures are recoverable (re-run the workflow), but perceived latency is not. Verdict: correct.

**`ErrorBoundary` per view.**
A crash in the secondary workflow window doesn't take down the results window. This turned a full white screen into a recoverable per-panel error state. Cost: 30 minutes. Saved: hours of confused users and support questions. Verdict: always do this.

**Single `dataAccess.js` adapter for all Supabase calls.**
All client-side DB interaction funneled through one file. When Supabase's API shape changed, or when we needed to add auth headers, one file changed. Tests mock one module, not scattered `supabase.from()` calls across 6 files. Verdict: essential.

**Markers for structured LLM output (`[STRUCTURED_OUTPUT]...[/STRUCTURED_OUTPUT]`).**
Asking an LLM to output only raw JSON is fragile — it often adds preamble, apologies, or code fences. Markers let the LLM include natural-language text before and after the JSON block. The parser finds the markers, extracts only the JSON between them, strips code fences, and parses. This pattern never broke across hundreds of real executions. Verdict: always use delimiters for structured LLM output, never rely on "just output JSON."

**`summary save = embed trigger` (one call, two effects).**
The endpoint `POST /api/summary` both upserts the workflow summary AND chunks and embeds it into `document_embeddings`. This eliminated a common failure: the summary exists but the KB is empty, producing generic AI results. The root cause was that the embedding step was deferred to a separate trigger that often didn't fire. Coupling them in one idempotent call made the pipeline reliable. Verdict: always embed at the same time as you persist.

**Parsing LLM JSON in the JavaScript SSE handler, not in a downstream Dify Code node.**
Dify auto-parses JSON-shaped LLM output before passing it to downstream Code nodes. Your Code node then receives a dict when it expected a string, and Dify's framework crashes before `main()` even runs. Parsing the JSON in `_difyWorkflow.js` when the `node_finished` event arrives is completely reliable. Verdict: never use a Code node solely to parse an LLM's text output.

---

### What Didn't Work (and What to Do Instead)

**One monolithic env var for workflow instructions → per-branch env vars.**
Started with a single Dify env var containing instructions for all N parallel branches. Updating one branch required replacing the entire thing, diffs were impossible to read, and the LLM prompt became one giant unmanageable block. The fix was to create one Dify env var per LLM node. Each node references only its own instructions. This should have been the design from day 1.

**Hardcoded recommendation lists → LLM-generated recommendations per user context.**
A static mapping of category → recommendations made sense at prototype stage. It broke the moment the LLM was tasked with personalizing output: the recommendations were still generic. Replacing them with `next_steps[]` from the LLM output gave personalized, user-specific actions. The lesson: any data the LLM should generate is not a good candidate for a static constant.

**Coupling selection state to task creation → decouple: selection tracks intent, tasks generated separately.**
Early implementation had a toggle UI also add/remove a fixed set of tasks. This conflated two concerns: "what is the user tracking?" and "what actions should they take?" When the LLM started generating personalized tasks, the toggle logic became wrong (adding stale hardcoded tasks, then LLM adding real ones, causing duplicates). Fix: toggle only writes selection state. Tasks come from the LLM. Never co-locate "UI selection state" and "AI-generated content" in the same handler.

**Hardcoded entity IDs in client code → breaking change when IDs change.**
IDs used to reference domain entities (e.g., recommendation types, categories, tiers) were hardcoded client-side. A second iteration gave them new ID strings. Any DB rows with old IDs became orphans. Fix: design your canonical ID lists before training the LLM on them. Treat them like a database enum — changing them is a migration that requires both a prompt update and a data migration.

**Module-level singleton as pseudo-state management → `useState` defaults.**
Using a module-level singleton as the "source of truth" with `useState` reading from it created two sources of truth that could silently diverge. The fix was to inline initial data directly as `useState` defaults. Rule: React state is the source of truth. Don't shadow it with a module-level object.

**CSS in a template literal inside JSX → static CSS file.**
~1000 lines of CSS inside a tagged template literal inside the JSX. React diffs the string on every render. The editor can't lint or format it. It can't be cached by the browser separately. Extracting it to `src/styles/app.css` and importing it in `main.jsx` eliminated all of this. Takes 15 minutes and should be done at the very start.

**`Date.now() + Math.random()` for entity IDs → `crypto.randomUUID()`.**
Non-deterministic, non-UUID, can't be used as a Supabase PK without a conversion step. Switching to `crypto.randomUUID()` mid-project required updating every place IDs were generated, every test that asserted on an ID, and every place that passed an ID to Supabase. Zero reason not to start with UUIDs.

**Starting without a test suite → technical debt that made refactoring risky.**
The v1 refactor (extracting 10 modules from a monolith) was done without tests. Any of the extractions could have broken the behavior silently. Tests were added post-refactor, which means they validated the refactored behavior rather than guarding against regression during the refactor. Do the opposite: write tests for your most critical logic (parsers, state transitions) before you refactor.

**UNIQUE constraint missing on conversations table → duplicate rows from NULL.**
Postgres `UNIQUE (user_id, workflow, category_id)` does not prevent multiple rows where `category_id IS NULL`. `NULL != NULL` in Postgres. For primary intake conversations (`category_id = NULL`), two rapid navigations could create duplicate rows. Fix: `conversationDbIdRef` is populated on auth-restore so the lazy-create path is never reached twice. Lesson: when designing UNIQUE constraints involving nullable columns, explicitly prevent duplicates at the application layer with a ref or similar guard, because the DB constraint won't protect you.

---

## 23. Real Bugs Encountered & Their Root Causes

Each bug is documented with: what the symptom was, what the actual cause was, and what the correct guard is.

---

### Bug 1: Deselecting an item didn't remove its associated generated tasks

**Symptom:** Toggling a selection off left orphan tasks in the list with no way to dismiss them.

**Root cause:** The toggle handler only flipped a boolean in `selectedItems`. The task cleanup logic was never added to the deselect branch.

**Fix:** Extract task add/remove to pure functions. Call `removeTasksBySource(tasks, sourceId)` on deselect. Test both branches.

**Guard:** Any toggle that creates data must also delete that data when toggled off. Write the test for deselect at the same time as the test for select.

---

### Bug 2: `saveActionItem` silently wiped user's `customData`

**Symptom:** Action item refresh results (stored in `custom_data.refresh`) disappeared after the next persistence cycle.

**Root cause:** `saveActionItem` hardcoded `custom_data: {}` in the upsert payload, overwriting whatever was in `item.customData`.

```js
// Wrong
custom_data: {},

// Right
custom_data: item.customData || {},
```

**Fix:** Flow the item's own `customData` through. Add a round-trip test: save item with customData, load it back, assert customData is intact.

**Guard:** Any `upsert` that doesn't include a field will overwrite it with the default. Audit every field in every upsert payload and verify it's reading from the source object, not a hardcoded default.

---

### Bug 3: Streaming callbacks used stale state via closure

**Symptom:** After the first message exchange, a second exchange would create a duplicate `conversations` row in Supabase instead of reusing the existing one.

**Root cause:** The streaming callback closed over `conversationDbId` (a `useState` value) at the time the component rendered. By the time the callback fired (mid-stream), the state had updated but the closure still held `null`.

**Fix:** Store the conversation DB UUID in a `useRef`, not `useState`. Refs are mutable boxes — the callback reads the current value at call time, not the value at closure creation time.

```js
const conversationDbIdRef = useRef(null);

// In streaming callback (fires later):
if (!conversationDbIdRef.current) {
  const id = await createConversation('workflow_a');
  conversationDbIdRef.current = id;  // always current, no stale closure
}
```

**Guard:** Any ID, flag, or reference that is both created inside a streaming/async callback AND read by a later streaming callback must live in a `useRef`. Never put it in `useState` if you need it to be fresh inside a long-lived closure.

---

### Bug 4: Dify Code node bound to full array instead of `Iteration / item`

**Symptom:** The iteration's inner Code node received a list of 10 dicts instead of a single dict, and its `main()` logic failed trying to call `.get()` on a list.

**Root cause:** In Dify Studio, the Code node inside the Iteration was bound to the source array (the Iteration's input), not to `Iteration / item` (the single element being iterated).

**Fix:** Open the Code node → input variable bindings → change from `[source_array]` to `Iteration / item`.

**Guard:** After setting up any Iteration node, immediately open the first node inside the iteration and verify its inputs are bound to `Iteration / item`, not the array that feeds the iteration. Test with a single-item run first.

---

### Bug 5: Dify Code node variable name mismatch after rename

**Symptom:** `NameError: name 'context' is not defined` inside a Code node that was previously working.

**Root cause:** The input variable was renamed in the Dify Studio UI (from `context` to `http_body`) but the Python `main()` function still referenced the old name.

**Fix:** After renaming a variable in the Dify Studio UI, update the variable name in the Python function signature and body to match.

**Guard:** Dify's UI and the Python code are not linked — renaming one does not rename the other. After any variable rename in the UI, immediately check the `main(...)` signature.

---

### Bug 6: Code 3 missing `json.loads()` — HTTP response body treated as string

**Symptom:** `AttributeError: 'str' object has no attribute 'get'` when trying to extract the `context` field from the HTTP response.

**Root cause:** The Dify HTTP Request node returns the response body as a raw JSON string. The Code node received a string, not a dict.

**Fix:**
```python
import json
body = json.loads(http_body)
context = body.get("context", "")
```

**Guard:** Dify HTTP Request node output is always a string. Always `json.loads()` before accessing fields. Handle the case where it's already parsed (wrap in `isinstance(body, dict)` check).

---

### Bug 7: Code 3 missing `CATEGORY_ID:` prefix

**Symptom:** The downstream routing Code node (`route_to_llms`) received all inputs, but its output was an empty dict `{}`. All 10 `context_*` output variables were empty strings.

**Root cause:** `route_to_llms` looked for a `CATEGORY_ID: <id>` prefix at the start of each context string to know which `context_*` variable to populate. Code 3 wasn't adding this prefix, so the routing logic found nothing to route.

**Fix:** Add the prefix in Code 3:
```python
return {"eval_context": f"CATEGORY_ID: {category_id}\n{context_text}"}
```

**Guard:** When any routing logic depends on a value embedded in a string, verify the producing node is actually adding that value. Test routing nodes in isolation with crafted input strings before running the full workflow.

---

### Bug 8: `sys.user_id` in Dify Studio ≠ Supabase UUID

**Symptom:** Workflow ran successfully in Dify Studio but returned empty context for all categories. KB searches returned 0 results.

**Root cause:** The HTTP Request node passed `sys.user_id` as the user ID for KB lookup. `sys.user_id` is Dify's own internal ID for the user who triggered the workflow in Dify Studio — it is not the application's Supabase UUID. No embeddings existed for that Dify-internal ID.

**Fix:** Add `user_id` as an explicit String input variable on the START node. Reference `user_id` (not `sys.user_id`) in the HTTP Request body. In production, pass the real Supabase UUID when calling `/workflows/run`. In Dify Studio's Run panel, paste the real UUID to test with actual data.

**Guard:** Never use `sys.user_id` to query your own database. It is not a value you control. Always pass the application user ID explicitly via the inputs object.

---

### Bug 9: LLM output includes `eval_` prefix in `topic_id` field

**Symptom:** Results for some topics weren't rendering. Console showed `WORKFLOW_TOPICS.find()` returning `undefined` for `"eval_topic_a"`.

**Root cause:** The Dify LLM node was named `eval_topic_a`, and the LLM's system prompt instructed it to output a `topic_id` field. The LLM faithfully echoed the node name — including the `eval_` prefix — as the `topic_id` value.

**Fix:** In `_difyWorkflow.js`, always override `topicData.topic_id` with the ID derived from the node title (with the `eval_` prefix stripped), regardless of what the LLM outputs:

```js
const topicId = extractTopicFromNodeTitle(nodeTitle); // strips eval_ prefix
topicData.topic_id = topicId; // override LLM output
```

**Guard:** Never trust the LLM to output an ID that matches your application's canonical ID list. Derive it from the node title (which you control) and override whatever the LLM said.

---

### Bug 10: Frontend silently dropped LLM output fields

**Symptom:** Rich LLM output fields (`highlights`, `gaps`, `keyMetrics`, `followUpPrompt`) were present in Dify logs but never appeared in the frontend UI.

**Root cause:** The `onTopicComplete` callback in App.jsx only forwarded three fields (`topic_id`, `score`, `summary`) to state. All other fields were discarded silently during the spread.

**Fix:** Spread the full `topicData` object into state, then add the three derived fields on top:

```js
onTopicComplete: (topicData) => {
  const result = {
    ...topicData,             // preserve ALL LLM output fields
    id: topicData.topic_id,  // add derived fields
    computedScore: ...,
  };
  setResultData(prev => ({ ...prev, topics: [...prev.topics, result] }));
}
```

**Guard:** When a callback receives structured data from an LLM response, default to spreading the full object into state. Only filter fields you have a specific reason to exclude. Filtering by inclusion (listing every field you want) silently discards anything you haven't thought of yet.

---

### Bug 11: Generic AI results for all real users (empty knowledge base)

**Symptom:** The analysis workflow ran successfully but produced the same generic output regardless of what the user had shared. KB searches returned 0 results for all real users.

**Root cause:** The embedding step was a separate operation that wasn't being triggered. Summaries were saved to `workflow_summaries`, but nothing was embedding them into `document_embeddings`. The KB was empty for every real user; only the seeded test user had embeddings.

**Fix:** Couple the summary save and the embedding into a single idempotent API call (`POST /api/summary`). The endpoint upserts the summary AND chunks and embeds it into `document_embeddings` in the same request. One call, two effects.

**Guard:** If your analysis pipeline depends on KB retrieval, verify that the KB is being populated as part of the same operation that creates the source data. Never leave embedding as a separate optional step — it will be skipped.

---

### Bug 12: Duplicate conversation rows despite UNIQUE constraint

**Symptom:** Each login created a new `conversations` row instead of reusing the existing one. Over time, a single user accumulated 10+ rows.

**Root cause:** The `UNIQUE (user_id, workflow, category_id)` constraint does not prevent multiple rows where `category_id IS NULL` — in Postgres, `NULL != NULL`. Any conversation with `category_id = NULL` can have duplicate rows.

**Fix:** On auth restore, load the existing conversation UUID into `conversationDbIdRef`. The lazy-create logic checks the ref first:
```js
if (!conversationDbIdRef.current) {
  const id = await createConversation('workflow_a');
  conversationDbIdRef.current = id;
}
```
Because the ref is populated on restore, the create path is never reached a second time.

**Guard:** UNIQUE constraints with nullable columns don't behave as you expect. Apply an application-layer guard (ref, state flag, or explicit SELECT-before-INSERT) for any "create once" resource.

---

### Bug 13: Variable Aggregator leaking scalar inputs into aggregated list

**Symptom:** `AttributeError: 'str' object has no attribute 'get'` in a downstream Python node that was iterating over aggregated LLM results.

**Root cause:** The Variable Aggregator collected N LLM node outputs and also included `user_id` (a String). Iterating over the aggregated values yielded N dicts and 1 string. Calling `.get()` on the string failed.

**Fix:**
```python
# Always filter out non-dict scalars from aggregated data
aggregated = [item for item in aggregated_data if isinstance(item, dict)]
```

**Guard:** Any Code node receiving Variable Aggregator output must filter for `isinstance(item, dict)` before processing. The aggregator does not guarantee homogeneous types.

---

### Bug 14: Downstream event silently not firing (node title case mismatch)

**Symptom:** A specific `node_finished` event was never received by the frontend. The SSE stream completed, `workflow_finished` fired, but the expected custom event type was never emitted. The UI section dependent on that event stayed empty.

**Root cause:** The Dify node was named `CALCULATE_MATURITY` (uppercase). `_difyWorkflow.js` compared `nodeTitle === 'calculate_maturity'`. The comparison always failed silently.

**Fix:**
```js
const nodeTitle = (event.data?.title || '').toLowerCase();
```

**Guard:** Always `.toLowerCase()` every Dify node title before comparison. Name all nodes in lowercase in Dify Studio to prevent this class of bug entirely.

---

### Bug 15: Vercel function count exceeded mid-project

**Symptom:** Vercel deployment failed with "You have exceeded the limit of 12 Serverless Functions."

**Root cause:** `api/knowledge/embeddings.js`, `api/knowledge/knowledgeBase.js`, and `api/knowledge/search.js` were all non-prefixed helper files that Vercel counted as function endpoints.

**Fix:** Rename helpers to `_embeddings.js`, `_knowledgeBase.js`, `_search.js`. Update all import paths. Re-deploy.

**Guard:** Establish the `_`-prefix convention for all non-endpoint files in `api/` from day 1. Count your functions before each new endpoint: `ls api/**/*.js | grep -v '/_'`.

---

### Bug 16: File text not embedded when using blocking mode

**Symptom:** Files uploaded in chat sessions appeared to go through successfully, but KB searches during the analysis workflow never returned file content.

**Root cause:** File text extraction from Dify requires reading `node_finished` SSE events (specifically the `File Text Relay` node output). This only works in streaming mode. Blocking mode returns a single JSON response with no node events — file text is invisible to the server.

**Fix:** Ensure `VITE_DIFY_STREAMING=true` is set in Vercel env vars. Add a `console.warn` in `api/chat.js` when files are sent in blocking mode so this is detectable in production logs.

**Guard:** File embedding via SSE is a streaming-only feature. Document this constraint. If you need file content to be searchable, streaming must be enabled.

---

### Bug 17: Analysis produced 300+ action items per run

**Symptom:** After the first real analysis run, the action items list contained hundreds of items. Users couldn't make sense of them. Many were irrelevant to the user's current stage.

**Root cause:** The LLM prompt asked for gaps across all evidence items per topic × N topics with no scoping or limits. An honest LLM found gaps everywhere.

**Fix:** Stage-aware gap scoping:
- Only surface gaps at the user's current maturity gate (table_stakes) and the next gate up (stretch)
- Items 2+ levels above current stage are excluded
- Maximum N gaps per topic, consolidated

The prompt change also introduced a gap object format `{ action, type, evidence_items }` instead of flat strings, enabling priority derivation from type.

**Guard:** Always define output cardinality constraints in the prompt before writing the first real analysis workflow. "Max N items, scoped to stage X" is not a late optimization — it's a product decision that needs to be made at prompt design time.

---

## 24. LLM Output Design Lessons

These are prompt design and output parsing lessons from building and iterating conversational intake and AI analysis workflows.

### Never ask for "pure JSON" — use delimiter markers

Asking an LLM to output only JSON is unreliable. LLMs add preamble text, apologies, code fences, or trailing commentary. The parser breaks.

Delimiter markers survive all of these:
```
[STRUCTURED_OUTPUT]
{ "json": "here" }
[/STRUCTURED_OUTPUT]
```

The parser finds the markers, ignores everything outside them, and handles code fences and trailing commas inside.

### Always strip markdown code fences before parsing

LLMs frequently wrap JSON in ` ```json ... ``` ` even when explicitly told not to. This is non-negotiable:

```js
let text = raw.trim();
const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
if (fenceMatch) text = fenceMatch[1].trim();
const parsed = JSON.parse(text);
```

### Always re-derive derived fields — never trust the LLM's math

If your output has a field like `status` that must match a score range:

```
score >= 75 → "high"
score >= 50 → "medium"
score <  50 → "low"
```

The LLM will occasionally output an inconsistent combination (e.g., score=82, status="medium"). Always re-derive `status` from the score on the client side. Same for any label derived from a numeric value. Never display the LLM's label without verifying it against the underlying number.

### Always override `topic_id` / `category_id` with a value you control

When N parallel LLM nodes each output an ID field, they will sometimes include their own node-name prefix (e.g., `eval_business_model` instead of `business_model`). Your lookup will fail silently.

Fix: derive the topic/category ID from the node title (which you control), strip any prefix, and override whatever the LLM output. Never use `data.topic_id` directly for lookups — always use the node-title-derived ID.

### Fill defaults for all missing categories, don't fail

If the LLM returns 9 categories instead of 10 (one failed, timed out, or was skipped), the parser should fill in a placeholder for the missing one rather than throwing. Silent data gaps are better than parse errors that block the entire result from rendering.

```js
// In extractSummary.js pattern
const found = categories.filter(c => VALID_IDS.has(c.id));
const missing = VALID_IDS_ARRAY.filter(id => !found.find(c => c.id === id));
const placeholders = missing.map(id => ({ id, completeness: 0, status: 'incomplete', ... }));
return [...found, ...placeholders].sort(byCanonicalOrder);
```

### Write semantic search queries in the user's language, not the analyst's

The biggest quality improvement to AI results comes from using natural-language search queries that match how users actually describe their situation, not the jargon an expert analyst uses when looking for evidence.

Original query (analyst language):
```
"compliance status audit complete verified"
```
Better query (user language — how someone who has solved this describes it):
```
"passed our audit last year zero findings clean report no violations"
```

**Rule:** Write queries in the language someone uses when they *have* this evidence — concrete outcomes, tool names, numbers, natural speech. Ask: "how would a user who has done this describe it in conversation?" not "what would an expert look for?"

### Use maturity/stage inference to avoid penalizing obvious facts

If a user is demonstrably at Stage 4, it would be absurd to mark them as failing Stage 1 criteria. But an LLM scoring only literal evidence will do exactly this.

Stage inference rule: if a PROVEN item exists at a higher stage gate, auto-promote the lower-gate item:
- 2+ stages above → promote UNPROVEN to **PROVEN**
- 1 stage above → promote UNPROVEN to **PARTIAL**

Add this as an explicit reasoning step in the prompt, and exclude inferred items from gap recommendations — no point surfacing gaps the user has clearly already cleared.

### Design output cardinality at prompt design time

"How many items does this LLM output?" is not a parsing detail — it's a product decision. Decide upfront:
- Maximum recommendations per topic (5 is a good default)
- Maximum highlights per result (3)
- Maximum gaps per category (5, scoped to current stage)

Without these constraints, LLMs maximize — they fill all available space. Users see 300 action items instead of 15. Define the shape before writing the prompt, not after observing the first output.

### Validate and normalize client-side — don't trust the LLM shape

The LLM will occasionally:
- Output an array of 9 items when you asked for 10
- Use a slightly different status string than you defined
- Include an extra field you didn't ask for
- Omit a field and not tell you

Treat every LLM response as untrusted external input. Your parser should:
1. Find the delimiters
2. Strip code fences
3. Fix trailing commas (`text.replace(/,(\s*[}\]])/g, '$1')`)
4. `JSON.parse()` with a try/catch
5. Validate required fields are present and within expected ranges
6. Fill defaults for missing or out-of-range values
7. Re-derive all derived/calculated fields
8. Sort to a canonical order

Never let a malformed LLM response crash the UI. Return a graceful default with an error flag that the UI can display.

### Use `onTopicComplete` progressive rendering for multi-branch workflows

When N LLM nodes run in parallel, don't wait for all N to finish before rendering. Add an `onTopicComplete` callback to the SSE handler. As each `node_finished` event arrives, call the callback with that topic's result and update state immediately. Users see results filling in progressively rather than waiting for the slowest branch.

```js
// _difyWorkflow.js
if (VALID_TOPIC_IDS.has(topicId)) {
  handlers.onTopicComplete(topicData);  // fire immediately per topic
}

// App.jsx
onTopicComplete: (topicData) => {
  setResultData(prev => ({
    ...prev,
    topics: [...(prev.topics || []), { ...topicData, id: topicData.topic_id }]
  }));
}
```

This also makes failures obvious: if 9 categories render and 1 never arrives, you know exactly which branch failed.

---

## 25. Dify Chatflow Design Guide

Chatflows and Workflows are fundamentally different Dify app types. The template covers Workflow apps in detail; this section covers Chatflow-specific patterns.

### Chatflow vs Workflow — When to Use Each

| | Chatflow | Workflow |
|---|---|---|
| **Use for** | Multi-turn conversation, context persists | Single-shot, structured I/O |
| **API endpoint** | `POST /chat-messages` | `POST /workflows/run` |
| **State persistence** | Dify manages conversation history via `conversation_id` | Stateless per call |
| **Response mode** | `blocking` or `streaming` | `streaming` only for SSE |
| **SSE terminal event** | `message_end` | `workflow_finished` |
| **Node types available** | All + Answer node (required) | All (no Answer node) |

### SSE Event Differences

Both app types emit `node_started`, `node_finished`. The terminal events differ:

```js
// Chatflow terminal events
if (event.event === 'message') { /* streaming text chunk */ }
if (event.event === 'message_end') { /* conversation done, has conversation_id */ }

// Workflow terminal events
if (event.event === 'workflow_finished') { /* workflow done, has workflow_run_id */ }

// api/chat.js handles both:
} else if (event.event === 'message_end' || event.event === 'workflow_finished') {
  capturedMessageId = event.message_id || event.id || null;
}
```

**Both types emit `node_finished`** — this is the main event for custom data extraction and SSE-driven side effects.

### Chatflow Node Architecture Pattern

This is a reference architecture for multi-turn AI conversation with structured output:

```
START
  └─ APPEND CONTEXT             (Code node: prepends accumulated per-topic context variables)
       └─ RESPONSE PROCESSOR LLM (LLM: parses latest user message, extracts structured evidence)
            └─ CONTEXT ASSEMBLER  (Code: joins per-topic vars into a consolidated context string)
                 └─ NEXT QUESTION LLM  (LLM: decides what to ask next based on context)
                      └─ IF/ELSE: question_count > N?
                           ├─ YES → OUTPUT GENERATOR (LLM: emits structured JSON output)
                           └─ NO  → Answer node (returns NEXT QUESTION response)
```

Key insight: **the workflow rebuilds its full understanding every turn** by re-concatenating all prior context from the START node inputs. There is no incremental state update — each turn is a full re-derivation.

### Passing State Between Turns via `inputs`

Dify chatflows persist conversation history automatically. But for structured per-topic state that you want the LLM to operate on independently, pass it via `inputs` on each message:

```js
// Client-side: pass per-topic context in inputs
await DifyAPI.sendMessage(message, conversationId, files, user, 'workflow_b', {
  topic_id: 'topic_a',
  // The chatflow START node has topic_id as an input variable
  // It uses this to personalize every response in the conversation
});
```

This pattern stores and accumulates structured per-topic data by passing it all back in via `inputs` on each turn. The chatflow's first node receives the N topic variables and uses them to guide the next question and extraction.

### File Extractor → Relay Node Pattern

This is the exact pattern needed to make uploaded file content embeddable and searchable. It requires three Dify nodes working together:

```
File Upload (user message) → File Extractor node → "File Text Relay" Code node → Answer node
                                                           ↓
                                              node_finished event with outputs.file_text
                                                           ↓
                                              api/chat.js captures and embeds
```

**Step 1: File Extractor node**
- Place after the chat input in your flow
- Outputs: `text` (Array of strings, one per uploaded file)

**Step 2: "File Text Relay" Code node** (exact name matters — server looks for this title)
```python
# Input: file_text (type: Array[String]) — from File Extractor's text output
def main(file_text: list) -> dict:
    joined = "\n\n---\n\n".join(str(t) for t in file_text)
    return {"file_text": joined}
```

Critical details:
- Input variable type **must be `Array[String]`**, not plain `String`
- The node title **must be exactly** `"File Text Relay"` (or whatever constant you define in `api/chat.js` as `FILE_TEXT_RELAY_NODE`)
- The `join` converts the list to a single string so it's embeddable
- This only works in **streaming mode** (`response_mode: 'streaming'`) — the server reads `node_finished` SSE events, and blocking mode has no node events

**Step 3: Server captures the event**
```js
// api/chat.js — inside the SSE parse loop
if (event.data?.title === FILE_TEXT_RELAY_NODE) {
  capturedFileText = event.data?.outputs?.file_text || null;
}
```

After the stream closes, the server chunks → embeds → upserts to `document_embeddings`. Non-fatal: stream always closes normally even if embedding fails.

### Chatflow Streaming Must Be Enabled in Dify Studio

For Workflow-type chatflows (as opposed to basic chatflows), streaming must be explicitly enabled:
- Dify Studio → your chatflow → Settings → Response mode: **Streaming**
- Without this, `node_finished` events do not appear in the SSE stream, and file text extraction silently fails

### `conversation_id` Persistence

Dify returns a `conversation_id` on the first message. You must store it and send it back on every subsequent message to preserve context:

```js
// First message: send empty string
body: { conversation_id: '', query: message, ... }

// Dify returns: { conversation_id: 'abc-123', ... }
// Store it in state (and in DB via updateConversationDifyId)

// Subsequent messages: send the stored ID
body: { conversation_id: 'abc-123', query: message, ... }
```

If you don't send the `conversation_id`, Dify starts a new conversation on every message — your chatflow loses all accumulated context.

---

## 26. Action Item Lifecycle Pattern

Action items are the most complex entity in this stack: they're created by LLMs, persisted to Supabase, embedded for KB searchability, refreshed via a second LLM pass, and display status badges. Here's the full lifecycle.

### Phase 1: Creation (from LLM output)

Action items can come from multiple sources. The pattern is the same regardless of origin — each item needs an ID, source metadata, and a deterministic `actionKey` for deduplication:

```js
// Source 1: LLM analysis gaps → action items
gaps.forEach(gap => {
  const item = {
    id: crypto.randomUUID(),         // UUID = Supabase PK directly
    title: gap.action,
    description: gap.description || null,
    priority: gap.priority || 'medium',
    status: 'pending',
    sourceType: 'workflow_c',        // use your actual source type name
    sourceId: null,
    sourceCategory: topicId,         // which topic this item belongs to
    actionKey: slugify(gap.action),  // unique kebab-case key for dedup
    customData: {},
  };
  newItems.push(item);
});

// Source 2: LLM next_steps → action items (secondary workflow source)
nextSteps.forEach(step => {
  const item = {
    id: crypto.randomUUID(),
    title: step.action,
    description: step.expected_outcome,
    priority: mapPriority(step.priority),
    status: 'pending',
    sourceType: 'workflow_b',        // different source type for different origin
    sourceId: 'workflow_b_result',   // fixed source ID for this workflow's items
    sourceCategory: null,
    actionKey: slugify(step.action),
    customData: {},
  };
  newItems.push(item);
});
```

### Phase 2: Persistence

Action items write directly via `supabase-js` (full CRUD RLS). The `id` (UUID) is both the React state key and the Supabase primary key:

```js
// saveActionItem in dataAccess.js
await supabase.from('action_items').upsert(
  {
    id: item.id,             // UUID — used as PK
    user_id: userId,
    title: item.title,
    description: item.description || null,
    priority: item.priority || null,
    status: item.status || 'pending',
    source_type: item.sourceType || null,
    source_id: item.sourceId || null,
    source_category: item.sourceCategory || null,
    action_key: item.actionKey || null,
    custom_data: item.customData || {},  // CRITICAL: don't hardcode {}
  },
  { onConflict: 'id' }
);
```

### Phase 3: Embedding (for KB searchability)

When a user chats about an action item in its ChatPanel, the exchange gets embedded so the refresh search can find it:

```js
// POST /api/action-items/embed (fire-and-forget from client)
{
  actionItemId: 'uuid',
  messages: [{ role: 'user', content: '...' }, { role: 'assistant', content: '...' }]
}

// Server: chunk the exchange, embed, upsert to document_embeddings
// source_type: 'conversation', metadata: { actionItemId }
```

These embeddings are then discoverable by the refresh search in Phase 4.

### Phase 4: Refresh (GPT-4o-mini classification)

The "Refresh Status" button triggers a batch pipeline:

```js
// POST /api/action-items/refresh
// 1. Batch embed all action item queries in one OpenAI call (efficient)
const queries = items.map(item => `${item.title}: ${item.description}`);
const embeddings = await generateEmbeddings(queries);  // one API call for all

// 2. Parallel KB searches (one per item)
const searchResults = await Promise.allSettled(
  items.map((item, i) =>
    supabase.rpc('search_embeddings', {
      p_user_id: userId,
      p_embedding: JSON.stringify(embeddings[i]),
      p_top_k: 5,
      p_similarity_threshold: 0.5,
    })
  )
);

// 3. Parallel LLM analysis — with concurrency limit
const CONCURRENCY_LIMIT = 10;
const results = [];
for (let i = 0; i < items.length; i += CONCURRENCY_LIMIT) {
  const batch = items.slice(i, i + CONCURRENCY_LIMIT);
  const batchResults = await Promise.allSettled(
    batch.map((item, j) => analyzeActionItem(item, searchResults[i + j]))
  );
  results.push(...batchResults);
}

// 4. Persist results to custom_data.refresh JSONB
// No schema migration needed — column already exists
await supabase.from('action_items').update({
  custom_data: { ...item.customData, refresh: {
    status: 'addressed',          // addressed | partially_addressed | not_addressed | insufficient_evidence
    confidence: 0.85,
    summary: 'User has completed...',
    evidence_count: 3,
    refreshed_at: new Date().toISOString(),
  }}
}).eq('id', item.id);
```

### The `customData` JSONB Pattern

`custom_data` is a JSONB column that acts as an escape hatch for extensible metadata without migrations. Any new feature that needs to attach data to an action item can use it:

```js
// Adding refresh results (Phase 4)
item.customData.refresh = { status, confidence, summary, evidence_count, refreshed_at }

// Future: adding notes, attachments, linked issues, etc.
item.customData.notes = 'Added by user'
item.customData.linkedIssue = 'LIN-123'
```

**Rule:** Never hardcode `custom_data: {}` in an upsert. Always flow `item.customData || {}`. Otherwise you silently wipe whatever was previously stored there.

### Append-Only Philosophy + `action_key` Deduplication

Action items are **append-only from the AI's perspective**. Only users can mark items complete or delete them. On re-run, the merge logic uses `action_key` as the idempotency key:

```js
// On re-run:
const existingKeys = new Set(currentActionItems.map(i => i.actionKey));
const newItems = newResultItems.filter(item => !existingKeys.has(item.actionKey));
// Only insert items with new actionKeys — preserves all user modifications on existing items
```

This means:
- A user who marks an item as in-progress won't have it reset on re-run
- If the LLM stops recommending an item, the item stays (user can close it)
- If the LLM adds a new item with a new `actionKey`, it appears in the list

**`actionKey` should be deterministic** — slugify the action title. Don't use UUID here or every re-run creates duplicates.

### The `sourceType` / `sourceId` / `sourceCategory` Metadata Pattern

These three fields enable filtering and bulk deletion without separate junction tables:

```js
// Delete all actions from a specific source (e.g., when user removes a selection)
await supabase.from('action_items').delete().eq('source_id', sourceId);

// Delete all actions for a specific topic on re-run
await supabase.from('action_items').delete()
  .eq('source_category', topicId)
  .eq('source_type', 'workflow_c');

// Load only items from one workflow for display in the relevant section
const workflowCItems = actionItems.filter(i => i.sourceType === 'workflow_c');
```

Design this metadata from day 1. Retrofitting it requires a migration and a data backfill.

---

## 27. Direct OpenAI as Dify-Compatible Backend

The action item chat feature uses GPT-4o-mini directly (not Dify), but emits SSE events in Dify's exact format. This means the client-side parser (`difyApi.js`) requires **zero changes** — it reads the same `message`, `message_end` event types it already handles.

### The Pattern

```js
// api/chat.js — action_item workflow branch
async function handleActionItemChat(req, res, { query, inputs, response_mode, userId }) {
  // Build OpenAI messages from history
  const messages = [
    { role: 'system', content: systemPrompt },
    ...priorHistory,       // passed in via inputs.history
    { role: 'user', content: query },
  ];

  const fakeConvId = `action-oai-${userId}`;   // deterministic, not a real Dify ID
  const fakeMessageId = `msg-${Date.now()}`;

  if (response_mode === 'streaming') {
    // Open SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const openaiStream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.4, stream: true }),
    });

    const emitDify = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
    const reader = openaiStream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (raw === '[DONE]') continue;
        const chunk = JSON.parse(raw);
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          // Emit as Dify 'message' event — client parser handles this natively
          emitDify({ event: 'message', answer: delta, conversation_id: fakeConvId, message_id: fakeMessageId });
        }
      }
    }

    // Emit Dify terminal event — client parser waits for this
    emitDify({ event: 'message_end', conversation_id: fakeConvId, message_id: fakeMessageId });
    res.end();
  } else {
    // Blocking mode
    const data = await openaiRes.json();
    const answer = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ answer, conversation_id: fakeConvId, message_id: fakeMessageId });
  }
}
```

### Why This Works

The client's `difyApi.js` only cares about three event types:
- `message` → accumulate `event.answer` into `fullMessage`
- `message_end` → capture `conversation_id` and `message_id`
- `node_finished` → optional progress updates

Since OpenAI streaming delivers the same token-by-token structure, you can translate OpenAI's `delta.content` events into Dify `message` events perfectly. The client is none the wiser.

### When to Use This Pattern

Use it when:
- The task is simple enough for direct OpenAI (classification, Q&A, single-turn analysis)
- You want to avoid the overhead of creating a new Dify chatflow app
- You need tight control over the system prompt per-request (Dify chatflow system prompts are static per app)
- You're hitting Dify rate limits on light tasks

Use a real Dify chatflow when:
- The task is multi-step or requires Dify's node orchestration
- You need the Dify conversation history management
- You need file extraction via the File Extractor node

### Conversation History Management

Since you're not using Dify's conversation storage, you must manage history yourself. Pass it in `inputs.history` on each request:

```js
// Client-side: accumulate messages in state
const [chatHistory, setChatHistory] = useState([systemWelcomeMessage]);

// On each send:
const response = await DifyAPI.sendMessage(
  userMessage,
  null,               // no Dify conversation_id
  [],                 // no files
  user,
  'action_item',      // workflow type routes to handleActionItemChat
  {
    action_title: item.title,
    action_description: item.description,
    gap_type: item.gapType,
    history: chatHistory.map(m => ({ role: m.role, content: m.content })),
  }
);

// On response: append to history for next turn
setChatHistory(prev => [...prev, { role: 'user', content: userMessage }, { role: 'assistant', content: response.message }]);
```

The server receives `history` in `inputs`, slices off the static welcome message (`history.slice(1)`), and prepends the system prompt. Each turn sends the full accumulated history — stateless server, stateful client.

---

## 28. Model & Cost Selection

### Decision Framework

| Task type | Model | Why |
|---|---|---|
| Complex multi-step reasoning (structured analysis, scoring, matching) | GPT-4o or Claude Sonnet via Dify | Needs strong reasoning; cost justified by quality |
| Structured extraction from conversation (summary/intake generation) | GPT-4o-mini or GPT-4o | Quality matters; output is the core product data |
| Simple classification (refresh: addressed/not addressed) | GPT-4o-mini | Binary-ish output; speed and cost matter; low error cost |
| Conversational chat (intake Q&A, per-topic follow-up, task chat) | GPT-4o-mini | Latency matters; errors are recoverable in next turn |
| Embeddings | text-embedding-3-small (1536 dims) | Adequate quality for semantic search; ~10× cheaper than text-embedding-3-large |

### Cost Landmarks (approximate, verify current pricing)

| Operation | Approximate cost |
|---|---|
| Embed one workflow summary (10 chunks × ~300 tokens) | ~$0.0001 |
| Embed one uploaded document (28 chunks × ~500 tokens) | ~$0.0003 |
| Batch embed 50 action item queries for refresh | ~$0.0002 |
| GPT-4o-mini analysis of one action item (refresh) | ~$0.0005 |
| GPT-4o analysis of one topic (scoring 20 items) | ~$0.01–$0.03 |
| Full analysis run (N topics × GPT-4o) | ~$0.10–$0.30 per N=10 |

### Practical Rules

**Use GPT-4o-mini by default for chat.** Intake and follow-up conversations are cheap enough at gpt-4o-mini quality. Users don't notice the quality difference in conversational turns; they notice latency. GPT-4o-mini is 15× cheaper and faster.

**Use GPT-4o (or Claude Sonnet) only where the output is the product.** Structured analysis and matching results are what users act on. Quality errors here have real consequences. Pay for the better model.

**Batch embeddings whenever possible.** OpenAI's embedding API accepts an array. Send all queries in one call, not one-per-query in a loop. The difference for 50 items is 50 API calls vs 1 API call — same total cost, dramatically less latency and rate-limit risk.

```js
// Wrong: one call per item
for (const item of items) {
  const embedding = await generateEmbedding(item.query);
}

// Right: batch all in one call
const embeddings = await generateEmbeddings(items.map(i => i.query));
```

**Cap concurrency for parallel LLM calls.** 10 simultaneous GPT-4o-mini calls is fine. 50 simultaneous calls risks rate limits and timeout cascades. Use a concurrency limit:

```js
const CONCURRENCY = 10;
const results = [];
for (let i = 0; i < items.length; i += CONCURRENCY) {
  const batch = items.slice(i, i + CONCURRENCY);
  const batchResults = await Promise.allSettled(batch.map(item => analyze(item)));
  results.push(...batchResults);
}
```

**Set temperature deliberately.** Use `0.2–0.4` for structured output (classification, JSON generation) — lower temperature = more consistent formatting. Use `0.6–0.8` for conversational chat — higher temperature = more natural-sounding responses.

**Add `max_tokens` to prevent runaway outputs.** LLMs will fill the context window if you let them. For classification tasks, set `max_tokens: 500`. For structured JSON output, set a limit that's 2× your expected output size.

### Direct OpenAI for Simple Tasks, Dify for Complex Ones

Use OpenAI directly (not via Dify) for:
- Single-prompt classification (action item refresh analysis)
- Conversational chat with no multi-step orchestration
- Any task where the full prompt is assembled server-side per-request

Use Dify for:
- Multi-node workflows with branching logic
- Parallel execution of the same task across multiple categories
- Workflows that need Dify's file extraction, KB retrieval, or variable aggregation

A third direct OpenAI call site should trigger extracting a shared `_openai.js` utility (currently only two: `_embeddings.js` and `_analyze.js`).

---

## 29. Advanced Test Patterns

### The `vi.hoisted()` Problem and Fix

Vitest processes ESM imports in a way that `vi.mock()` calls at the top of a test file are hoisted above imports — but variables referenced inside `vi.mock()` factories are not hoisted. This causes `ReferenceError: Cannot access 'mockFn' before initialization`.

**Symptom:**
```js
const mockGetUser = vi.fn();  // defined here
vi.mock('../api/supabaseClient', () => ({  // factory runs BEFORE this line
  supabase: { auth: { getUser: mockGetUser } }  // ReferenceError
}));
```

**Fix: use `vi.hoisted()`** to define mocks that are safe to reference inside factory functions:

```js
// dataAccess.test.js — correct pattern
const { mockFrom, mockSelect, mockUpsert, mockSingle } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle, single: mockSingle });
  const mockUpsert = vi.fn().mockResolvedValue({ error: null });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect, upsert: mockUpsert });
  return { mockFrom, mockSelect, mockUpsert, mockSingle, mockMaybeSingle };
});

vi.mock('../api/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }) },
  },
}));
```

### Testing LLM Parsers (Most Important)

Parsers are the highest-density source of bugs and the cheapest things to test. Cover:

```js
// extractSummary.test.js patterns to replicate

// 1. Happy path — valid full output
test('parses valid summary with all 10 categories', () => { ... });

// 2. Missing markers — no [STRUCTURED_OUTPUT] found
test('returns null when no markers present', () => { ... });

// 3. Markdown code fences — LLM wrapped JSON in ```json
test('strips code fences before parsing', () => { ... });

// 4. Trailing commas — LLM output has trailing comma before }
test('handles trailing commas in JSON', () => { ... });

// 5. Partial output — only 7 categories returned, must fill 3 placeholders
test('fills missing categories with placeholder', () => { ... });

// 6. Invalid IDs — LLM used unknown dimension ID
test('filters out invalid category IDs', () => { ... });

// 7. Completeness out of range — LLM returned 150
test('clamps completeness to 0-100', () => { ... });

// 8. Derived fields — status must match completeness
test('derives status from completeness score', () => { ... });

// 9. Recalculates overall completeness from categories (don't trust LLM math)
test('recalculates overallCompleteness from category average', () => { ... });

// 10. JSON inside conversational text (real LLM output format)
test('extracts JSON embedded in conversational response text', () => { ... });
```

### Testing Fire-and-Forget Async Functions

Functions like `persistSummary()` are called without `await`. Testing them requires waiting for the promises to settle:

```js
test('persistSummary calls the summary API', async () => {
  const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  global.fetch = mockFetch;

  // Call the fire-and-forget function
  persistSummary(summaryData);

  // Must flush the promise queue before asserting
  await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());
  // Or use: await new Promise(resolve => setTimeout(resolve, 0));
});
```

### Testing State Transitions (React components)

For components with complex state flows (like LoginScreen's two-step OTP), test the full user journey not just individual renders:

```js
test('full login flow: email → OTP → success', async () => {
  const onLogin = vi.fn();
  const { getByPlaceholderText, getByText } = render(<LoginScreen onLogin={onLogin} />);

  // Step 1: email
  await userEvent.type(getByPlaceholderText('Email address'), 'test@example.com');
  await userEvent.click(getByText('Send Code'));

  // Step 2: OTP input appears
  expect(getByPlaceholderText('Enter code')).toBeInTheDocument();
  await userEvent.type(getByPlaceholderText('Enter code'), '12345678');
  await userEvent.click(getByText('Verify'));

  // Result
  expect(onLogin).toHaveBeenCalledWith(expect.objectContaining({ user: expect.any(Object) }));
});
```

### Testing Pure Utility Functions (Highest ROI)

Pure functions — `addResultActions`, `removeResultActions`, color helpers, chunking — are the cheapest to test and have the highest bug density. Test them exhaustively:

```js
// actionItems.test.js patterns
test('addResultActions preserves existing items', () => { ... });
test('addResultActions adds sourceType and sourceId metadata', () => { ... });
test('addResultActions with duplicate IDs does not add', () => { ... });
test('removeResultActions removes only matching sourceId', () => { ... });
test('removeResultActions is immutable (does not mutate input)', () => { ... });
test('removeResultActions with empty list returns empty', () => { ... });
```

### Mock Structure for Supabase Chained Calls

Supabase's fluent API chains `.from().select().eq().maybeSingle()`. Mock the chain correctly:

```js
const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect, upsert: mockUpsert });

// In test: assert on the right link in the chain
expect(mockFrom).toHaveBeenCalledWith('action_items');
expect(mockSelect).toHaveBeenCalledWith('*');
expect(mockMaybeSingle).toHaveBeenCalled();
```

---

## 30. App Phase State Machine

### The Problem with Routing Libraries

Adding `react-router-dom` when your app has 3–5 views feels like the right move. It isn't. Routing libraries:
- Add a new concept (URL as state) that must stay in sync with React state
- Require protecting routes, handling redirects, and persisting state through navigations
- Create two sources of truth: URL and React state

For a single-page app where all views share state (analysis results, action items, auth session), URL routing adds more complexity than it solves.

### Phase State Machine Pattern

Instead, use a single `useState` that acts as a state machine. Each value is a named phase:

```js
// App.jsx
const [workflowPhase, setWorkflowPhase] = useState('intake');
// Phases: 'intake' | 'intake-readonly' | 'results' | 'detail'
// Active view rendered by: switch(workflowPhase) { ... }
// Use phase names that reflect your app's actual workflow steps
```

**Why this works:**
- All state is React state — no sync between URL and useState
- Transitions are explicit function calls (`setWorkflowPhase('results')`)
- No back/forward browser navigation to handle
- All views share the same state refs directly

### Designing Your Phase Map

Before writing any UI code, draw the state machine:

```
'intake'
  ├─ user completes workflow → 'results'
  └─ (none)

'results'
  ├─ user clicks "View conversation" → 'intake-readonly'
  └─ user clicks topic card → 'detail' (with selected topic)

'intake-readonly'
  └─ user clicks "Back to results" → 'results'

'detail'
  └─ user clicks "Back" → 'results'
```

Also maintain a second phase for top-level views:

```js
const [activeView, setActiveView] = useState('intake');
// Views: 'intake' | 'results' | 'secondary'  — use names that match your app's sections
// Rendered by: if/else or switch in App.jsx
```

### When to Add Routing

Add a routing library only when you need:
- Deep-linkable URLs (users share links to specific views)
- Browser back/forward navigation as a first-class feature
- More than ~6 distinct views where `switch()` becomes unwieldy

For MVPs, none of these are typically true. Add routing in v2 if demand proves it's needed.

### Avoiding Phase Coupling

Each phase render function should be isolated enough to handle its own loading/error state:

```js
function renderIntakeChat() {
  // Own loading state, error handling, no assumptions about other phases
}

function renderResults() {
  if (!workflowSummary) return <LoadingPlaceholder />;
  // Render results
}
```

Don't let phase A directly mutate phase B's display state. Transitions happen at the phase level (`setWorkflowPhase`); each phase function reads from shared state independently.

---

## 31. Data Lifecycle & Re-runs

### The Upsert vs Append-Only Decision

Not all data should behave the same way when re-generated.

| Data | On re-run | Why |
|---|---|---|
| `workflow_summaries` | **Upsert (replace)** | Summary reflects current knowledge — old version is superseded |
| `workflow_results` | **Upsert (replace)** | Results reflect current state — old version is superseded |
| `action_items` | **Append-only** | User has modified status, notes — must not be reset |
| `document_embeddings` (on re-embed) | **Upsert by source+chunk_index** | Same chunk at same index should update, not duplicate |
| `conversations` / `messages` | **Append-only** | History is permanent record |

### Action Item Merge Logic on Re-Run

```js
// api/workflow/save.js
async function mergeActionItems(userId, newItems, sourceType, supabase) {
  // Fetch existing action_keys for this user and source type
  const { data: existing } = await supabase
    .from('action_items')
    .select('action_key')
    .eq('user_id', userId)
    .eq('source_type', sourceType);

  const existingKeys = new Set(existing?.map(r => r.action_key).filter(Boolean));

  // Only insert items whose action_key doesn't already exist
  const toInsert = newItems.filter(item => item.actionKey && !existingKeys.has(item.actionKey));

  if (toInsert.length === 0) return 0;

  const rows = toInsert.map(item => ({
    id: item.id,
    user_id: userId,
    title: item.title,
    // ... all fields
  }));

  const { error } = await supabase.from('action_items').insert(rows);
  if (error) throw error;
  return toInsert.length;
}
```

**Important:** Use `insert`, not `upsert`, for new items. Upsert would silently overwrite user modifications on existing items if the UUID ever collided (which UUIDs shouldn't, but the intent is clearer with insert).

### Account Reset Pattern

The account reset endpoint deletes all application data for a user while preserving their auth account. This is useful for testing and user-requested data deletion.

**Deletion order matters** — respect foreign key constraints:

```js
// api/account/delete.js
async function deleteUserData(userId, supabase) {
  // Delete in FK-safe order: leaf tables first, then parent tables
  await supabase.from('messages').delete().eq('user_id', userId);
  await supabase.from('conversations').delete().eq('user_id', userId);
  await supabase.from('action_items').delete().eq('user_id', userId);
  await supabase.from('workflow_summaries').delete().eq('user_id', userId);
  await supabase.from('workflow_results').delete().eq('user_id', userId);
  // add your domain-specific tables here (in FK-safe order)
  await supabase.from('document_embeddings').delete().eq('user_id', userId);
  await supabase.from('file_metadata').delete().eq('user_id', userId);
  // user_profiles last (other tables may reference it)
  await supabase.from('user_profiles').delete().eq('id', userId);

  // Log deletion (for compliance audit trail)
  await supabase.from('deletion_audit').insert({
    deleted_user_id: userId,
    deleted_by: 'user_request',
  });
  // Do NOT delete from auth.users — this preserves the account
}
```

Keep a `deletion_audit` table from day 1 — GDPR requires proof of deletion.

### Stale Embedding Cleanup

When re-embedding a source (e.g., after intake summary updates), delete old chunks before inserting new ones. Relying solely on upsert `onConflict` can leave stale chunks if the new version has fewer chunks than the old:

```js
// Delete all chunks for this source before re-embedding
await supabase.from('document_embeddings').delete()
  .eq('user_id', userId)
  .eq('source_type', 'summary')
  .eq('source_id', summaryId);

// Then insert fresh chunks
await supabase.from('document_embeddings').insert(newChunks);
```

### Handling Partial Failures in Multi-Step Pipelines

For pipelines with multiple sequential writes (summary → embed → evaluate → save), use a try/catch at each step with appropriate fallback behavior:

```js
// Fire-and-forget pattern — each step is independent
async function persistSummaryAndEmbed(summary, session) {
  try {
    await fetch('/api/summary', { /* upsert summary + embed */ });
  } catch (err) {
    console.error('[persist] Summary save failed (non-fatal):', err.message);
    // App continues — user still sees the summary in state
    // On next run, summary will be saved again
  }
}
```

The principle: a persistence failure should never block the user's current session. Data is eventually consistent, not immediately consistent. Users can always re-run the workflow to re-trigger persistence.

---

## 32. Error Tier Philosophy

Not all errors are equal. Three tiers, three UI patterns:

### Tier 1: Fatal — Block the UI

The operation cannot continue and the user must take action.

**When:** Auth failure, completely missing required data, API returning 4xx on a required call.

**UI pattern:** Full-screen error state, clear message, one action (retry or go back).

```js
// Example: analysis workflow failed to start
if (workflowError && !resultData) {
  return (
    <div className="error-state">
      <p>Analysis failed: {workflowError}</p>
      <button onClick={handleRunWorkflow}>Retry</button>
    </div>
  );
}
```

### Tier 2: Warning — Yellow Banner, Non-Blocking

Something degraded the experience but the user can still proceed.

**When:** KB search failed but analysis ran on intake data only, mock mode is active, partial data was returned.

**UI pattern:** Yellow banner at the top of the relevant section. User can dismiss or ignore. The main content still renders.

```js
// workflowWarning state (string or null)
{workflowWarning && (
  <div className="warning-banner">
    ⚠️ {workflowWarning}
    <button onClick={() => setWorkflowWarning(null)}>×</button>
  </div>
)}
```

**Examples of warning text:**
- "Knowledge base unavailable — analysis based on intake data only"
- "Running in demo mode — results are simulated"
- "Some topics timed out — refresh to retry"

### Tier 3: Non-Fatal — Log and Continue

Background operations that the user doesn't need to know about.

**When:** Persistence failed, embedding failed, a fire-and-forget call errored.

**UI pattern:** None. Console.error only. The user's current session is unaffected.

```js
try {
  await supabase.from('document_embeddings').upsert(rows);
} catch (err) {
  console.error('[embed] Non-fatal: embedding failed:', err.message);
  // No setError, no UI update — user is unaware
}
```

### Mapping to Implementation

| Scenario | Tier | Implementation |
|---|---|---|
| Auth token expired mid-session | Fatal | Redirect to login |
| Dify API call fails entirely | Fatal (for that operation) | Error state in that section |
| OpenAI quota exceeded during KB retrieval | Warning | Yellow banner, continue with fallback context |
| VITE_DIFY_MOCK=true | Warning | Banner: "Demo mode" |
| Summary DB write fails | Non-fatal | `console.error`, continue |
| Embedding write fails | Non-fatal | `console.error`, continue |
| One of N topics times out | Warning | Show N-1 results, banner for the missing one |
| All N topics time out | Fatal | Error state in results section |

**Rule:** When in doubt, downgrade the tier. A non-fatal background failure that surfaces as a fatal UI error is worse than a fatal failure that's silently swallowed. The right order of badness (best to worst): non-fatal → warning → fatal.

---

## 33. Dify Parallel Output Routing — The CATEGORY_ID Trick

This is the most non-obvious pattern in the entire stack. It solves a specific Dify problem: how do you route N outputs from a parallel iteration into N named variables that N downstream LLM nodes can each consume independently?

### The Problem

Dify's Iteration node runs a loop and collects all outputs into a single array (`iteration_output`). A downstream Code node receives this array and must somehow distribute each item to the right LLM node. But LLM nodes can't receive array elements by index — they need named input variables.

### The Solution: Embed Routing Information in the Data Itself

**Step 1: The iteration inner chain produces strings with a `CATEGORY_ID:` prefix**

```python
# Code 3 (format_context) — runs inside the iteration per category
def main(http_body: str, category_id: str) -> dict:
    body = json.loads(http_body) if isinstance(http_body, str) else http_body
    context = body.get("context", "No context available")
    # Prefix the output with the category ID so downstream routing can identify it
    return {"eval_context": f"CATEGORY_ID: {category_id}\n{context}"}
```

**Step 2: The iteration collects all prefixed strings into `iteration_output Array[String]`**

**Step 3: A routing Code node (`route_to_llms`) parses the prefixes and builds named outputs**

```python
# Code 4 (route_to_llms)
import json

def main(iteration_output) -> dict:
    # Normalize: iteration_output may be string, list, or dict
    if isinstance(iteration_output, str):
        iteration_output = json.loads(iteration_output)
    if isinstance(iteration_output, dict):
        iteration_output = list(iteration_output.values())

    result = {}
    for item in iteration_output:
        if not isinstance(item, str):
            continue
        if item.startswith("CATEGORY_ID: "):
            lines = item.split("\n", 1)
            cat_id = lines[0].replace("CATEGORY_ID: ", "").strip()
            context = lines[1] if len(lines) > 1 else ""
            result[f"context_{cat_id}"] = context

    return result
    # Returns: context_topic_a, context_topic_b, ... (N named variables)
```

**Step 4: Declare all N outputs in Dify Studio**

In the Code node's output variable declarations, add each named output explicitly:
- `context_topic_a` (String)
- `context_topic_b` (String)
- ... all N

**Step 5: Each LLM node binds to its own named output**

`eval_topic_a` LLM node → binds its context input to `route_to_llms / context_topic_a`

### Why This Works

The Code node's Python `main()` function can return any dict. Dify uses the declared output variable names as the schema. As long as your dict keys match the declared output names, each downstream node can bind to its specific key.

The `CATEGORY_ID:` prefix is the trick: it embeds the routing information inside the string data that's passing through the iteration, so the routing node can extract it even though the iteration has already collapsed everything into a flat array.

### Full Naming Contract

| Layer | Convention | Example |
|---|---|---|
| App-level / DB | bare ID | `topic_a` |
| Dify node title | `eval_` prefix | `eval_topic_a` |
| Dify context input to workflow | `context_` prefix | `context_topic_a` |
| CATEGORY_ID: label in strings | bare ID | `topic_a` |
| `_difyWorkflow.js` VALID_TOPIC_IDS | bare IDs | `new Set(['topic_a', ...])` |

The `eval_` prefix is stripped in `_difyWorkflow.js` when deriving the topic ID from the node title. The `context_` prefix is internal to Dify and never surfaces to the client.

### Common Mistakes

**Mistake:** Declaring outputs as `context_business_model` but Code node returns `context_businessModel` (camelCase). Dify won't match them — returns empty string.

**Mistake:** Iteration `iteration_output` passes through a Variable Aggregator before `route_to_llms`. The aggregator may re-key the items as integers (`{0: "...", 1: "..."}`). Always normalize: `if isinstance(x, dict): x = list(x.values())`.

**Mistake:** Forgetting to handle the case where a category's HTTP request failed. The iteration still outputs a string, but it may be an empty string or an error JSON. `route_to_llms` should tolerate missing `CATEGORY_ID:` prefix — if it doesn't find the prefix, skip the item silently.

---

## 34. Streaming Chat UX Pattern

This section covers the exact implementation of smooth streaming text in a chat UI — one of the most non-obvious parts of building with SSE. Getting it wrong produces jarring flicker or incorrect final state.

### The Dual-Update Pattern

There are two distinct moments during a streaming response:
1. **During stream**: tokens arrive; show partial text with a visual indicator
2. **On completion**: replace the partial message with the final clean message

Never merge these. Using a single state update for both causes one of two bugs: the streaming indicator stays visible permanently, or the final message doesn't land correctly.

```js
// replaceLastMessage helper — replaces the last message in the array immutably
const replaceLastMessage = (messages, newMsg) => [...messages.slice(0, -1), newMsg];

// Phase 1: Before stream starts — add a placeholder
setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

// Phase 2: During stream — update placeholder with accumulating text
// Called on every 'message' SSE event (each token chunk)
function onChunk(accumulatedText) {
  setMessages(prev => replaceLastMessage(prev, {
    role: 'assistant',
    content: accumulatedText,
    isStreaming: true,           // keep flag until done
  }));
}

// Phase 3: On stream completion — replace with final message (no flag)
setMessages(prev => replaceLastMessage(prev, {
  role: 'assistant',
  content: finalMessage,         // isStreaming omitted — message is done
}));
```

**Why `replaceLastMessage` instead of index-based update:**
```js
// Fragile — depends on knowing the index
const updated = [...messages];
updated[updated.length - 1] = newMsg;

// Better — works regardless of array length, single place to update
const replaceLastMessage = (msgs, newMsg) => [...msgs.slice(0, -1), newMsg];
```

### Message Flags

Each message object carries optional flags that the renderer checks:

```js
{
  role: 'user' | 'assistant',
  content: string,
  isStreaming: boolean,   // true while tokens still arriving; omit when done
  isFile: boolean,        // user uploaded a file (renders file icon)
  isError: boolean,       // server error (renders red styling)
  isMock: boolean,        // mock mode response (renders badge in dev)
}
```

The renderer checks these:
```js
function renderMessageContent(msg) {
  if (msg.isFile) return <FileMessage name={msg.content} />;
  if (msg.isError) return <ErrorMessage text={msg.content} />;
  return (
    <div className={msg.isStreaming ? 'message streaming' : 'message'}>
      {renderMarkdown(msg.content)}
      {msg.isStreaming && <span className="typing-cursor">▊</span>}
    </div>
  );
}
```

### Typing Indicator

Show a typing indicator (three animated dots) **before** the first token arrives, then replace it with the streaming text. Without this, there's a silent gap between "user sends" and "first token arrives" (can be 1–3 seconds) where the UI looks frozen.

```js
// Add typing indicator immediately on send
setMessages(prev => [...prev,
  { role: 'user', content: userMessage },
  { role: 'assistant', content: '', isTyping: true },  // typing indicator
]);
setIsTyping(true);

// On first chunk: replace typing indicator with streaming text
// (the onChunk callback fires for every token; replaceLastMessage handles it)
onChunk(firstToken);
setIsTyping(false);
```

In the ChatPanel component, the typing indicator is separate from the messages array — it's a visual state overlaid on the chat, not a message:

```jsx
// ChatPanel.jsx
{isTyping && (
  <div className="message assistant typing-indicator">
    <span /><span /><span />  {/* three animated dots via CSS */}
  </div>
)}
```

### ChatPanel Component Architecture

The `ChatPanel` component is reusable across intake chat, per-topic follow-up chat, and the read-only conversation view. Its props:

```jsx
<ChatPanel
  messages={messages}           // { role, content, isStreaming, isFile, isError }[]
  isTyping={isTyping}           // show typing indicator
  onSend={handleSend}           // called with (message, files[])
  onFileUpload={handleUpload}   // called with File[]
  readOnly={false}              // when true: hides input area entirely
  placeholder="Ask anything..."
  disabled={isLoading}          // disables input while request in flight
/>
```

**`readOnly` prop:** When `true`, the entire input area (`chat-input-area` div) is not rendered. Used for the "View conversation" read-only history view. Prevents the user from accidentally sending messages into a completed conversation.

**Input disabled state:** The send button and textarea are disabled while `disabled={true}` — prevents double-submission during streaming. Re-enable only when the stream completes (i.e., when `isTyping` goes false and `isStreaming` flag is cleared from the last message).

### Scrolling Behaviour

Auto-scroll to bottom on every new message or token. Use a ref on the message container bottom:

```js
const messagesEndRef = useRef(null);

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages, isTyping]);

// In JSX: <div ref={messagesEndRef} />  (empty div at the bottom of message list)
```

**Caveat:** Don't scroll if the user has manually scrolled up to read history. Detect this by checking `scrollTop + clientHeight < scrollHeight - threshold` before scrolling. Only auto-scroll if they're already near the bottom.

---

## 35. `import.meta.env` vs `process.env`

This is the single most common silent failure when first building this stack. Using the wrong one causes the value to be `undefined` with no error.

### The Rule

| Context | Use | Why |
|---|---|---|
| Client-side code (`src/`) | `import.meta.env.VITE_*` | Vite inlines at build time |
| Serverless functions (`api/`) | `process.env.*` | Node.js runtime, read at execution time |
| `vite.config.js` | Both (`loadEnv` + `process.env`) | Vite config runs in Node |

### What Happens If You Mix Them

```js
// api/chat.js — WRONG: import.meta.env doesn't exist in Node.js runtime
const apiKey = import.meta.env.DIFY_WORKFLOW_A_API_KEY;  // undefined

// api/chat.js — CORRECT
const apiKey = process.env.DIFY_WORKFLOW_A_API_KEY;  // reads from Vercel env

// src/api/supabaseClient.js — WRONG: process.env not available in browser bundle
const url = process.env.VITE_SUPABASE_URL;  // undefined in browser

// src/api/supabaseClient.js — CORRECT
const url = import.meta.env.VITE_SUPABASE_URL;  // inlined by Vite at build time
```

### The Build-Time vs Runtime Distinction

`VITE_`-prefixed variables are **inlined at build time** by Vite:
```js
// What you write:
const url = import.meta.env.VITE_SUPABASE_URL;

// What Vite compiles to in the bundle:
const url = "https://xyz.supabase.co";  // literal string
```

This means:
- Changing `VITE_SUPABASE_URL` in Vercel requires a **redeploy** to take effect
- The value is visible in your JavaScript bundle (never use for secrets)
- In Vercel preview deployments, `VITE_*` vars must be set before the deploy, not after

Non-`VITE_` variables are read at runtime by Node.js in Vercel serverless functions — changes in Vercel dashboard take effect on the next function invocation (no redeploy needed).

### `vite.config.js` — Access Both

The Vite config runs in Node but also needs to load `.env` file variables for the proxy:

```js
// vite.config.js
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // loadEnv loads both VITE_ and non-VITE_ vars from .env file
  // (pass '' as prefix to load all)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      proxy: {
        '/api/chat': {
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // env.DIFY_WORKFLOW_A_API_KEY — non-VITE_ var, accessible via loadEnv
              proxyReq.setHeader('Authorization', `Bearer ${env.DIFY_WORKFLOW_A_API_KEY}`);
            });
          },
        },
      },
    },
  };
});
```

### Checklist

- [ ] All client env var accesses use `import.meta.env.VITE_*`
- [ ] All serverless function env var accesses use `process.env.*`
- [ ] No secret values in `VITE_*` vars (they're in the bundle)
- [ ] `VITE_SUPABASE_URL` and `SUPABASE_URL` are both set (same value, different names, different contexts)
- [ ] After adding a new `VITE_*` var to Vercel, trigger a redeploy

---

## 36. Full-Stack Debugging Guide

When something fails silently in this stack, there are four places to look. Here's the order and what each reveals.

### 1. Browser DevTools Network Tab

First stop. Check:
- Did the request go out? If not, the issue is client-side (state, auth headers, fetch call)
- What status did it return? `401` → JWT missing or expired. `500` → server error (check Vercel logs). `404` → wrong URL or function not deployed.
- For SSE streams: the request should show as pending with incremental response. If it closes immediately, the stream errored on the server.

```
Network → filter by "api/" → click the request → Preview tab (for JSON) or Response tab (for SSE raw)
```

### 2. Vercel Function Logs

Second stop. Shows `console.log` output from your serverless functions.

```
Vercel Dashboard → project → Functions tab → click the function → Real-time logs
```

**What to log at each pipeline stage:**
```js
// api/chat.js — request entry
console.log(`[chat] REQUEST workflow=${workflow} mode=${response_mode} files=${files?.length ?? 0}`);

// SSE stream events
console.log(`[chat] node_finished title="${event.data?.title}"`);
console.log(`[chat] message_end message_id=${capturedMessageId}`);

// Dify error responses
console.error(`[chat] Dify rejected (${difyResponse.status}):`, errorText.substring(0, 500));

// Post-stream side effects
console.log(`[chat] Embedded ${rows.length} file chunks for message ${capturedMessageId}`);
```

**Key log patterns to recognize:**
- `Dify rejected (401)` → wrong API key in env vars
- `Dify rejected (400)` → malformed request body (check `inputs` shape)
- `[embed] Non-fatal: embedding failed: Request failed with status 429` → OpenAI quota exceeded
- No logs at all → function not receiving the request (check Vite proxy / URL)
- Log appears but stream closes → error thrown inside the SSE handler (check the stack trace)

### 3. Dify Workflow Run History

Third stop for Dify-specific failures. Shows per-node inputs, outputs, and errors.

```
Dify Studio → your app → Logs & Ann. tab (or "Monitoring" in newer versions)
→ click a run → expand each node to see inputs/outputs
```

**What to look for:**
- A node shows `Error` status → click it, read the Python traceback
- A node shows correct inputs but wrong outputs → the Python logic is the bug
- An LLM node shows correct prompt but wrong output → prompt engineering issue
- HTTP Request node shows `status: 200` but empty `context` → KB is empty for this user
- The run stops at a node with no error → likely a timeout or silent exception

**Testing with real Supabase data in Studio:**
1. Go to your app → Run panel (not Test panel)
2. In the `user_id` field, paste a real Supabase UUID (from auth.users in Supabase dashboard)
3. Run — the HTTP retrieval node will now query your actual KB data

### 4. Supabase Dashboard Logs

Fourth stop for DB-level issues.

```
Supabase Dashboard → project → Logs → Postgres logs (for query errors, RLS violations)
                                      → API logs (for REST API calls)
                                      → Auth logs (for auth events)
```

**Common findings:**
- `ERROR: permission denied for table document_embeddings` → RLS policy blocking the query; check `auth.uid()` in the policy matches how the query is authenticated
- `ERROR: duplicate key value violates unique constraint` → upsert conflict not handled; add `{ onConflict: 'column_name' }`
- `ERROR: new row violates row-level security policy` → client is trying to write to a server-managed table; route through a serverless function with service_role key
- Auth logs showing expired tokens → JWT expiry too short; increase in Supabase Auth settings

### 5. Client Console

For client-side state issues:

```js
// Temporary debug logging (remove before shipping)
useEffect(() => {
  console.log('[debug] resultData:', resultData);
  console.log('[debug] actionItems:', actionItems.length);
  console.log('[debug] workflowPhase:', workflowPhase);
}, [resultData, actionItems, workflowPhase]);
```

### Silent Failure Checklist

When something produces no output and no error:

1. `VITE_DIFY_MOCK=true` is set but you forgot → app is running mock mode, not hitting Dify
2. JWT expired → `verifyAuth` returns 401, client silently handles it (check Network tab)
3. Wrong workflow key → `resolveApiKey` falling back to primary key (check for `X-Dify-Fallback: true` response header)
4. Node title case mismatch → SSE event fired but not matched (check Vercel logs for `node_finished title="MY_NODE_NAME"`)
5. KB empty for user → workflow ran but used zero context (check Vercel logs for `[context] 0 chunks found for topic=...`)
6. `VITE_DIFY_STREAMING` not set in Vercel → file text not embedded (check for warn log in Vercel)
7. `SUPABASE_URL` not set in Vercel → auth middleware fails silently → all requests return 500

---

## 37. Supabase Migrations Workflow

### Initial Setup

```bash
npm install -D supabase
npx supabase init                                    # creates supabase/ dir
npx supabase link --project-ref YOUR_PROJECT_REF    # link to your Supabase project
npx supabase db push                                 # apply all migrations to remote
```

### Adding a New Migration

Never edit existing migration files after they've been pushed to production. Always create a new file:

```
supabase/migrations/
  001_initial_schema.sql    # never edit this after push
  002_add_extended_data.sql # new changes go here
  003_fix_action_items.sql
```

Name files with a zero-padded number prefix so they sort in application order.

### Safe Column Addition Pattern

Adding a column to a table with existing rows:

```sql
-- 002_add_extended_data.sql

-- Safe: new nullable column — existing rows get NULL
ALTER TABLE workflow_results ADD COLUMN IF NOT EXISTS extended_data JSONB;

-- Safe: new column with default — existing rows get the default
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS action_key TEXT;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}';

-- Safe: widen a CHECK constraint (add 'critical' to priority values)
ALTER TABLE action_items DROP CONSTRAINT IF EXISTS action_items_priority_check;
ALTER TABLE action_items ADD CONSTRAINT action_items_priority_check
  CHECK (priority IN ('critical', 'high', 'medium', 'low'));
```

### Unsafe Operations (Never Do on Live Tables)

```sql
-- UNSAFE: drops all data
DROP TABLE action_items;
DROP COLUMN important_column;

-- UNSAFE: changes column type (can fail if existing data doesn't cast)
ALTER TABLE action_items ALTER COLUMN priority TYPE INTEGER;

-- UNSAFE: adds NOT NULL without a default (blocks insert for existing NULLs)
ALTER TABLE conversations ADD COLUMN category_id TEXT NOT NULL;
-- SAFE version:
ALTER TABLE conversations ADD COLUMN category_id TEXT;  -- nullable first
-- then backfill nulls, then add NOT NULL constraint
```

### Checking Migration Status

```bash
npx supabase db diff          # see what's changed locally vs remote
npx supabase migration list   # list all migrations and their status
npx supabase db push          # apply pending migrations to remote
```

### When `db push` Fails

If a migration fails halfway, the migration is partially applied. **Do not edit the migration file and re-push** — that will try to re-apply already-run statements.

Fix by:
1. Identifying which statement failed (check the error output)
2. Create a new migration file with only the fix/remediation
3. Push the new file

### The `supabase db diff` Trick

If you've been making changes directly in the Supabase dashboard (not ideal, but it happens), `supabase db diff` generates a migration file from the diff:

```bash
npx supabase db diff --use-migra -f 004_schema_catch_up
# Creates supabase/migrations/004_schema_catch_up.sql from dashboard changes
```

This brings your local migration files back in sync with the actual remote schema.

### Index and RLS Policy Additions

New indexes and RLS policies can be added safely at any time without data loss:

```sql
-- 003_add_missing_index.sql
CREATE INDEX IF NOT EXISTS idx_action_items_action_key
  ON action_items(user_id, action_key);

-- Add a new RLS policy without dropping existing ones
CREATE POLICY "Users delete own action items"
  ON action_items FOR DELETE USING (auth.uid() = user_id);
```

Always use `IF NOT EXISTS` / `IF EXISTS` guards in migrations — safe to run twice if something goes wrong.

---

## 38. Seed & Test Data Scripts

### Why Seeding Is Essential

Embedding-dependent features (KB retrieval, analysis quality, action item refresh) are **silent failures without seeded data**. The workflow runs, finds 0 KB results, and produces generic output. You won't know why until you check the logs.

The sequence:
1. User completes intake → summary saved → summary embedded (`POST /api/summary`)
2. User runs analysis → KB searches per topic → analysis uses context

Step 2 only works if Step 1 has run. For a brand-new test user (or a user you've just cleared), you need to seed the DB first.

### Seed Script Pattern

```js
// scripts/seed-test-data.js
const { createClient } = require('@supabase/supabase-js');

const MODE = process.argv.includes('--real') ? 'real' : 'fake';

async function seed() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY  // service_role to bypass RLS
  );

  const userId = process.env.SEED_USER_ID;  // UUID from auth.users

  // 1. Upsert workflow summary
  await supabase.from('workflow_summaries').upsert({
    user_id: userId,
    summary_data: MOCK_SUMMARY,
    current_phase: 'results',
  }, { onConflict: 'user_id' });

  // 2. Generate and upsert embeddings
  const chunks = buildSummaryChunks(MOCK_SUMMARY);  // N chunks, one per topic
  const embeddings = MODE === 'real'
    ? await generateRealEmbeddings(chunks)           // OpenAI API call
    : chunks.map(() => new Array(1536).fill(0.1));  // fake 1536-dim vectors

  await supabase.from('document_embeddings').upsert(
    chunks.map((chunk, i) => ({
      user_id: userId,
      source_type: 'summary',
      source_id: null,
      chunk_index: i,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[i]),
      metadata: { topic_id: chunk.topicId },
    })),
    { onConflict: 'source_type,source_id,chunk_index' }
  );

  console.log(`Seeded ${chunks.length} chunks (${MODE} embeddings) for user ${userId}`);
}
```

### Fake vs Real Embeddings

| Mode | When to use | Limitation |
|---|---|---|
| `--fake` | Fast iteration, no OpenAI cost | Semantic search returns random/useless results |
| `--real` | Testing actual retrieval quality | Costs ~$0.001, takes ~2s, requires `OPENAI_API_KEY` |

Fake embeddings are useful to verify the pipeline plumbing (does the workflow call go through? does it parse?). Real embeddings are required to verify retrieval quality (does the right context get pulled for each topic?).

### Clear Script Pattern

```js
// scripts/clear-user-data.js
// Usage: node scripts/clear-user-data.js --email user@example.com

async function clearUser(identifier) {
  // 1. Resolve email → UUID if needed
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === identifier || u.id === identifier);
  const userId = user.id;

  // 2. Delete in FK-safe order
  const tables = ['messages', 'conversations', 'action_items',
    'workflow_summaries', 'workflow_results', 'document_embeddings', 'file_metadata'];
    // add your domain-specific tables here

  for (const table of tables) {
    const col = table === 'user_profiles' ? 'id' : 'user_id';
    const { error } = await supabase.from(table).delete().eq(col, userId);
    if (error) console.error(`[clear] ${table}: ${error.message}`);
    else console.log(`[clear] Cleared ${table}`);
  }
  // Preserves auth.users row — user can still log in
}
```

### Script Environment Setup

Scripts run in Node, not Vite — they use `process.env`, not `import.meta.env`. Load with `dotenv`:

```js
// Top of every script
require('dotenv').config({ path: '.env.local' });
// Or for ESM: import 'dotenv/config'
```

```json
// package.json
{
  "scripts": {
    "seed": "node scripts/seed-test-data.js --fake",
    "seed:real": "node scripts/seed-test-data.js --real",
    "clear-user": "node scripts/clear-user-data.js"
  }
}
```

---

## 39. Dify Studio Development Loop

The right iterative order minimizes wasted debugging cycles. Each step catches a different class of bug.

### Step 1: Single-Node Test Panel

Test each Code node in isolation before running the full workflow. Catches Python syntax errors, type errors, and logic bugs without waiting for the full workflow to run.

```
Dify Studio → click a Code node → "Test" tab (bottom panel)
→ paste input as JSON string → Run
```

Remember: the test panel always passes inputs as a JSON string, even for Object types. Your `main()` function receives a string — this is expected in test mode only.

### Step 2: Run Panel (Full Workflow)

Once each node passes individually, test the full workflow. Catches variable binding errors, routing bugs, and node interaction issues.

```
Dify Studio → "Run" button (top right) → fills each START variable in a separate field
→ paste raw values (not key:value pairs)
```

For user-specific workflows: paste a real Supabase UUID in the `user_id` field to test with actual KB data.

**What to check after each run:**
- Click the run in the log → expand each node → verify inputs look correct → verify outputs look correct
- Check HTTP Request node: status 200? context non-empty?
- Check LLM nodes: prompt assembled correctly? Output matches expected schema?

### Step 3: API Key in Local `.env`

Once the workflow runs correctly in Studio, wire it to the client:

```bash
DIFY_WORKFLOW_C_API_KEY=app-abc123  # from Dify Studio → API Access → API Key
```

In dev, the Vite proxy doesn't handle `/api/workflow/generate` — the client auto-falls back to mock mode. To test the real pipeline locally, you need to either:
- Use `vercel dev` (runs the full serverless function stack locally)
- Or deploy to a Vercel preview branch and test there

### Step 4: Deploy to Vercel Preview

```bash
git push origin feature/workflow-wiring
# Vercel auto-deploys a preview URL
# Set env vars in Vercel for the preview deployment
# Test via the preview URL
```

Vercel preview deployments share env vars configured at the project level but you can override per-deployment. This is where you catch integration bugs that only appear in the real serverless environment.

### Step 5: Production Validation

After merging to main:
- Trigger the workflow with a real user account
- Check Vercel function logs for the expected log sequence
- Check Supabase for the persisted data (did rows appear in `workflow_results`? `document_embeddings`?)
- Verify the UI renders the result correctly

### Iterating on Prompts

Prompt changes don't require redeployment — they're in Dify Studio:

1. Edit the prompt in the LLM node
2. Test in the Run panel
3. If the output shape changed, update the client-side parser
4. Publish the Dify workflow (click Publish in Studio — the API endpoint picks up the new version immediately)

**Dify versioning:** Dify keeps the last published version live. Changes to a workflow are drafts until you publish. You can publish, test, and roll back to a previous version from the Logs panel if needed.

### Common Studio Workflow Mistakes

**Mistake:** Making prompt changes and testing via the client API without publishing in Studio first. The API always uses the last published version — your changes are in draft.

**Mistake:** Testing the full workflow in Studio but with `sys.user_id` (which gives empty KB results). Always use the Run panel with a real UUID for KB-dependent tests.

**Mistake:** Changing a Code node's output variable name in the UI but not updating the downstream nodes that bind to it. The old binding silently produces an empty string.

**Mistake:** Increasing `top_k` in the HTTP Request body without lowering `threshold`. More results with low similarity scores add noise and dilute the LLM's context. Tune both together.

---

## 40. `app_config` Table Pattern

### What It's For

Runtime configuration that you want to change without a code redeploy. Stored in Supabase, readable by clients (SELECT policy allows all), writable only via `service_role`.

```sql
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Read-only for all authenticated and anonymous users
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read config" ON app_config FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE policy — only service_role can write
```

### Seed It With Initial Values

```sql
-- In your migration file
INSERT INTO app_config (key, value) VALUES
  ('embedding_model', '{"model": "text-embedding-3-small", "dimensions": 1536}'),
  ('kb_search_defaults', '{"top_k": 5, "threshold": 0.5}'),
  ('workflow_max_items_per_topic', '5'),
  ('feature_flags', '{"refresh_enabled": true, "secondary_workflow_enabled": true}')
ON CONFLICT (key) DO NOTHING;
```

### When to Use `app_config` vs Env Vars

| Config type | Use |
|---|---|
| Changes require redeploy anyway (API keys, URLs) | Env var |
| Credentials / secrets | Env var (never DB) |
| Tunable thresholds (search `top_k`, `threshold`) | `app_config` |
| Feature flags (enable/disable features without deploy) | `app_config` |
| Model selection (swap embedding model or LLM) | `app_config` |
| Per-tenant configuration (future multi-tenancy) | `app_config` or tenant table |

### Reading From Client

```js
// One-time fetch on app load
const { data } = await supabase.from('app_config').select('key, value');
const config = Object.fromEntries(data.map(r => [r.key, r.value]));
// config.embedding_model.model === 'text-embedding-3-small'
```

### Reading From Serverless Functions

```js
// api/_config.js — cached config reader
let cachedConfig = null;

export async function getAppConfig(supabase) {
  if (cachedConfig) return cachedConfig;
  const { data } = await supabase.from('app_config').select('key, value');
  cachedConfig = Object.fromEntries(data.map(r => [r.key, r.value]));
  return cachedConfig;
}
```

**Caveat:** Serverless functions are stateless — the cache lives only for the lifetime of the function instance (typically one request). For high-traffic apps, cache in an external store (Redis, Upstash). For MVP traffic, fetching `app_config` per-request is fine (it's a tiny table with a full-table-scan that takes <5ms).

### The Structured List Anti-Pattern

Don't store your topic/category list in env vars. Env vars are flat strings; structured lists have shape (ID, title, icon, order). If your list changes, a code deploy shouldn't be required.

```sql
-- Better: store in app_config
INSERT INTO app_config (key, value) VALUES (
  'workflow_topics',
  '[
    {"id": "topic_a", "title": "Topic A", "icon": "🔧"},
    {"id": "topic_b", "title": "Topic B", "icon": "📈"}
  ]'::jsonb
);
```

The client reads this on load and uses it as the canonical list. Adding a new topic is a SQL UPDATE, not a code deploy.

---

## 41. The Knowledge Context Endpoint

This endpoint is the bridge between Dify and your Supabase knowledge base. It's called by Dify's HTTP Request node inside the workflow iteration — not by the React client. Its authentication pattern is different from every other endpoint.

### Why It Exists

Dify's built-in Knowledge Base node is statically configured — you can't swap the KB backend per-request. The pattern instead:

1. Dify starts the workflow → hits `/api/knowledge/context` once per topic via HTTP Request node
2. Your endpoint receives topic ID + user ID + query
3. It embeds the query, searches pgvector, and returns pre-assembled context
4. Dify's Code node formats the context and passes it to the LLM node

The LLM node never touches Supabase directly. All retrieval is in your code.

### The Full Endpoint

```js
// api/knowledge/context.js
import { verifyWebhookSecret } from '../_webhookAuth.js';
import { getSupabaseAdmin } from '../_supabase.js';
import { generateEmbeddings } from './_embeddings.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Webhook auth — NOT JWT auth. Dify can't send a user JWT.
  const auth = verifyWebhookSecret(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { user_id, category_id, query, top_k = 5, threshold = 0.5 } = req.body;

  if (!user_id || !category_id || !query) {
    return res.status(400).json({ error: 'user_id, category_id, and query are required' });
  }

  const supabase = getSupabaseAdmin();
  let context = '';

  try {
    // 1. Embed the query
    const [embedding] = await generateEmbeddings([query]);

    // 2. Search the user's KB
    const { data: results, error } = await supabase.rpc('search_embeddings', {
      p_user_id: user_id,
      p_embedding: JSON.stringify(embedding),
      p_top_k: top_k,
      p_similarity_threshold: threshold,
    });

    if (error) throw error;

    // 3. Assemble context string
    if (results?.length > 0) {
      context = results.map(r => r.content).join('\n\n---\n\n');
      console.log(`[context] ${results.length} chunks found for topic=${category_id} user=${user_id}`);
    } else {
      console.log(`[context] 0 chunks found for topic=${category_id} user=${user_id}`);
    }
  } catch (err) {
    // Non-fatal: return empty context if KB fails
    // Dify workflow continues with no context — LLM uses only intake summary data
    console.error(`[context] KB retrieval failed (non-fatal): ${err.message}`);
  }

  return res.status(200).json({ context });
}
```

### Authentication: Webhook Secret, Not JWT

This endpoint is called by Dify, not by the React app. Dify cannot attach a user JWT (it doesn't have access to the user's session). Instead, authenticate with a shared secret:

```js
// How Dify calls it (HTTP Request node body):
{
  "user_id": "{{user_id}}",           // from START node input
  "category_id": "{{category_id}}",   // from iteration item (your topic/category ID)
  "query": "{{combined_query}}",      // assembled by Code 2
  "top_k": 10,
  "threshold": 0.3
}

// How Dify attaches the secret (HTTP Request node header):
// Header: x-webhook-secret = {{DIFY_WEBHOOK_SECRET}}
// Or: Authorization = Bearer {{DIFY_WEBHOOK_SECRET}}
```

In `_webhookAuth.js`, the secret is read from `process.env.DIFY_WEBHOOK_SECRET` and compared with `timingSafeEqual`.

### Context Fallback Behavior

The endpoint returns `{ context: '' }` (empty string) when:
- The user has no embeddings (new user, never completed intake)
- OpenAI embedding fails (quota exceeded)
- Postgres query fails

The Dify Code node should handle empty context gracefully — `format_context` still prepends the `CATEGORY_ID:` prefix, just with an empty body. The LLM node then analyzes based on intake summary alone, which is valid if lower quality.

### Dify HTTP Request Node Setup

In Dify Studio, the HTTP Request node inside the iteration:

```
Method: POST
URL: https://your-app.vercel.app/api/knowledge/context?secret={{DIFY_WEBHOOK_SECRET}}
  OR
URL: https://your-app.vercel.app/api/knowledge/context
Headers:
  Content-Type: application/json
  Authorization: Bearer {{DIFY_WEBHOOK_SECRET}}

Body (JSON):
{
  "user_id": "{{user_id}}",
  "category_id": "{{item.category_id}}",
  "query": "{{query}}",
  "top_k": 10,
  "threshold": 0.3
}
```

Where `{{item.category_id}}` and `{{query}}` are from Code 2 outputs (bound to the iteration item).

**Important:** Use your production Vercel URL here, not localhost. In dev, Dify can't reach localhost. If you need to test locally, use [ngrok](https://ngrok.com) or test via Vercel preview.

### Threshold and top_k Tuning

These are the most impactful tuning parameters for retrieval/analysis quality:

| Parameter | Effect | Start with |
|---|---|---|
| `threshold` | Minimum cosine similarity to include a result | `0.3`–`0.5` |
| `top_k` | Maximum results returned | `5`–`10` |

Lower `threshold` → more results, more noise. Higher `threshold` → fewer results, more precise. Start at `threshold=0.3`, `top_k=10` during development (maximizes recall). Tune up to `threshold=0.5` if results are noisy.

Store these as `app_config` values so you can tune without redeployment (see §40).

---

## 42. Supabase Query Gotchas

### `maybeSingle()` vs `single()` — The Most Common First-Time Bug

| Method | 0 rows | 1 row | Multiple rows |
|---|---|---|---|
| `.single()` | **Throws error** | Returns data | Throws error |
| `.maybeSingle()` | Returns `null` | Returns data | Returns first (silently) |

**Use `maybeSingle()` for all "load current user's X" queries.** First-time users have no rows — `.single()` will throw, crashing the app.

```js
// WRONG — crashes for new users
const { data } = await supabase
  .from('workflow_summaries')
  .select('summary_data')
  .single();   // throws: "JSON object requested, multiple (or no) rows returned"

// CORRECT
const { data } = await supabase
  .from('workflow_summaries')
  .select('summary_data')
  .maybeSingle();  // returns null for new users, data for returning users
```

**Use `.single()` only** when:
- You just inserted a row and want it back (`INSERT ... .select('id').single()`)
- A UNIQUE constraint guarantees exactly one row exists
- An error is the desired behavior if the row is missing

### `upsert` Requires `onConflict` on the Conflict Column

```js
// WRONG — Supabase doesn't know which column defines "conflict"
await supabase.from('workflow_summaries').upsert({ user_id: userId, summary_data: data });

// CORRECT — explicit conflict column
await supabase.from('workflow_summaries').upsert(
  { user_id: userId, summary_data: data },
  { onConflict: 'user_id' }
);
```

Without `onConflict`, Supabase uses the primary key column by default (`id`). If you're upserting by a different unique column (`user_id`), it will always INSERT (creating duplicates) instead of UPDATE.

### RLS Filtering Is Redundant But Explicit

When you make a query as an authenticated user, RLS already filters to `auth.uid() = user_id`. Adding `.eq('user_id', userId)` is redundant but you should do it anyway:

```js
// Both are equivalent (RLS handles the filter), but explicit is better:
const { data } = await supabase.from('action_items').select('*').eq('user_id', userId);
```

Why keep it explicit:
- Instant clarity — reader knows the query intent without checking the RLS policy
- Postgres can use the `user_id` index for the filter instead of relying on the RLS policy path
- If you ever call this code with `service_role` (which bypasses RLS), the filter still applies

### `service_role` Bypasses RLS Completely

The admin client (`getSupabaseAdmin()`) uses `service_role` key. **RLS policies are invisible to it.** Every query returns all rows across all users unless you explicitly filter by `user_id`.

```js
// Server-side: service_role client — MUST filter manually
const supabase = getSupabaseAdmin();
const { data } = await supabase
  .from('action_items')
  .select('*')
  .eq('user_id', userId);   // REQUIRED — no RLS protection here

// Client-side: anon client — RLS filters automatically
const { data } = await supabase.from('action_items').select('*'); // safe, only sees own rows
```

**Rule:** Every `getSupabaseAdmin()` query that touches user data must have `.eq('user_id', userId)`. Audit this before any security review.

### `select('*')` vs Explicit Columns

`select('*')` fetches all columns. Fine for development. For production, be explicit:
- Avoids shipping sensitive fields to the client
- Smaller payloads, faster queries
- Makes the code self-documenting about what it needs

```js
// Development: fine
const { data } = await supabase.from('action_items').select('*');

// Production: prefer explicit
const { data } = await supabase
  .from('action_items')
  .select('id, title, description, priority, status, source_type, dimension_id, action_key, custom_data');
```

### Error Handling Pattern

Supabase-js never throws by default — errors are returned as `{ data, error }`. Always check:

```js
const { data, error } = await supabase.from('action_items').select('*');
if (error) {
  console.error('[loadActionItems] failed:', error.message);
  return [];  // graceful fallback, not throw
}
return data;
```

In `dataAccess.js`, the convention is: load functions return empty/null on error, save functions log the error and continue. Only throw when the caller needs to know about failure.

### Ordering Matters for UX

Always specify explicit ordering for lists the user sees:

```js
// Action items: creation order (newest last for append-only lists)
.select('*').order('created_at', { ascending: true })

// Messages: chronological
.select('role, content').eq('conversation_id', convId).order('created_at')

// Results: most recent first
.select('*').order('updated_at', { descending: true }).limit(1)
```

Without `.order()`, Postgres returns rows in heap order — effectively random and changes between queries.

---

## 43. Per-Topic Conversation State Pattern

When your app has multiple parallel conversations (e.g., one per topic in a follow-up flow), a flat `messages` array won't work. You need a map keyed by topic ID.

### The `topicConversations` State Shape

```js
// App.jsx
const [topicConversations, setTopicConversations] = useState({});

// Shape:
{
  "topic_a": {
    conversationDbId: "uuid",         // Supabase conversations.id
    conversationId: "dify-conv-id",   // Dify conversation_id (for context persistence)
    messages: [
      { role: 'assistant', content: 'Let\'s explore this topic...' },
      { role: 'user', content: 'We have addressed this by...' },
      { role: 'assistant', content: 'Interesting! Tell me more...' },
    ],
  },
  "topic_b": {
    conversationDbId: "uuid-2",
    conversationId: null,    // null until first message sent
    messages: [],
  },
  // ... one entry per topic, lazily populated
}
```

### Initializing a Topic

Topics are lazily initialized — don't pre-populate all N on mount. Create the entry when the user first opens a topic:

```js
// When user opens a topic card
function handleOpenDetailView(topicId) {
  setActiveTopicId(topicId);

  // Create entry if it doesn't exist yet
  if (!topicConversations[topicId]) {
    const summary = workflowSummary.topics.find(t => t.id === topicId);
    setTopicConversations(prev => ({
      ...prev,
      [topicId]: {
        conversationDbId: null,
        conversationId: null,
        messages: [
          // Pre-populate with an opener from the summary
          { role: 'assistant', content: summary?.followUpPrompt || `Let's explore ${summary?.title}...` },
        ],
      },
    }));
  }
}
```

### Updating a Specific Topic's Messages

The update function must spread the old topic state to avoid overwriting `conversationId` or `conversationDbId`:

```js
// Append a user message to a specific topic
function appendUserMessage(topicId, content) {
  setTopicConversations(prev => ({
    ...prev,
    [topicId]: {
      ...prev[topicId],              // preserve conversationId, conversationDbId
      messages: [...prev[topicId].messages, { role: 'user', content }],
    },
  }));
}

// Update last message (streaming update)
function updateLastTopicMessage(topicId, content, isStreaming = false) {
  setTopicConversations(prev => {
    const topic = prev[topicId];
    if (!topic) return prev;
    return {
      ...prev,
      [topicId]: {
        ...topic,
        messages: replaceLastMessage(topic.messages, { role: 'assistant', content, isStreaming }),
      },
    };
  });
}
```

### Stale Closure Risk in Streaming Callbacks

The streaming callback closes over `topicId` (a string — safe, strings don't change). But it must NOT close over the messages array itself, or you'll see old messages being replaced:

```js
// WRONG — closes over messages at callback creation time
const messages = topicConversations[topicId]?.messages || [];
function onChunk(text) {
  setMessages([...messages, { role: 'assistant', content: text }]);  // stale messages!
}

// CORRECT — use functional setState to always get current state
function onChunk(text) {
  setTopicConversations(prev => ({
    ...prev,
    [topicId]: {
      ...prev[topicId],
      messages: replaceLastMessage(prev[topicId]?.messages || [], {
        role: 'assistant', content: text, isStreaming: true,
      }),
    },
  }));
}
```

### Persisting the Dify Conversation ID

The Dify `conversation_id` is needed for multi-turn context. Store it in both state and DB:

```js
// When first Dify response arrives with a conversation_id
function onFirstResponse(topicId, difyConversationId) {
  // Update state
  setTopicConversations(prev => ({
    ...prev,
    [topicId]: { ...prev[topicId], conversationId: difyConversationId },
  }));

  // Persist to DB (async, don't await)
  if (topicConversations[topicId]?.conversationDbId) {
    updateConversationDifyId(
      topicConversations[topicId].conversationDbId,
      difyConversationId
    );
  }
}
```

### Restoring on Login

On auth restore, load all detail-view conversations from Supabase:

```js
// In restoreUserData()
const detailViewData = await loadDetailConversations();
// Returns: { topic_a: { conversationDbId, conversationId, messages }, ... }

if (Object.keys(detailViewData).length > 0) {
  setTopicConversations(detailViewData);
}
```

`loadDetailConversations()` fetches all `workflow_b` conversations + their messages in parallel. Only topics with at least one saved message are returned — topics the user hasn't started yet remain absent from the map (lazy initialization still applies).

---

## 44. React Performance in Streaming UIs

Streaming mode is the main performance concern in this stack: every incoming token triggers a `setMessages()` call, which re-renders the entire component tree below the state owner.

### The Core Problem

```
App.jsx (owns messages state)
  └─ renders three windows
       └─ intake window
            └─ ChatPanel (renders message list)
                 └─ 50 messages × re-render on every token = lag
```

Every `setMessages` call re-renders App.jsx's entire subtree. During streaming, tokens arrive at ~20–50/second.

### Fix 1: `React.memo` on ChatPanel

Wrap `ChatPanel` in `React.memo`. It will only re-render when its props actually change:

```js
// src/components/ChatPanel.jsx
const ChatPanel = React.memo(function ChatPanel({ messages, isTyping, onSend, ... }) {
  // ...
});

export default ChatPanel;
```

**Important:** `React.memo` does a shallow comparison of props. If you pass a new object reference on every render (e.g., an inline `{}` or `[]`), memo is useless:

```jsx
// WRONG — new object reference every render defeats memo
<ChatPanel style={{ padding: 20 }} onSend={(msg) => handleSend(msg)} />

// CORRECT — stable references
<ChatPanel style={CHAT_STYLE} onSend={handleSend} />
// Where CHAT_STYLE is defined outside the component
// And handleSend is wrapped in useCallback
```

### Fix 2: `useCallback` for Handlers Passed to Memoized Children

```js
// WRONG — new function reference on every render
function renderIntakeChat() {
  return <ChatPanel onSend={(msg, files) => handleSend(msg, files)} />;
}

// CORRECT — stable reference
const handleIntakeSend = useCallback((msg, files) => {
  // handler body
}, [/* deps — only things the handler actually reads from outer scope */]);

function renderIntakeChat() {
  return <ChatPanel onSend={handleIntakeSend} />;
}
```

Only add `useCallback` where the function is passed to a `React.memo` component. Adding it everywhere is noise — it has its own cost and makes deps arrays harder to maintain.

### Fix 3: `React.memo` on RadarChart and Other Heavy SVG Components

The radar chart re-renders on every `resultData` state update. Since analysis results come in progressively (one topic at a time), and the radar chart is expensive (lots of SVG math), memoize it:

```js
const RadarChart = React.memo(function RadarChart({ dimensions }) {
  // expensive SVG rendering
}, (prevProps, nextProps) => {
  // Custom comparison — only re-render when dimensions array length changes
  // (don't re-render for intermediate streaming updates of the same category)
  return prevProps.dimensions.length === nextProps.dimensions.length;
});
```

### Fix 4: Separate State for Streaming Text

Instead of updating the main `messages` array on every token, keep a separate `streamingContent` state that only the streaming message reads:

```js
const [streamingContent, setStreamingContent] = useState('');
const [messages, setMessages] = useState([]);

// During stream: only update streamingContent (ChatPanel renders this separately)
onChunk: (text) => setStreamingContent(text),

// On completion: move to messages array, clear streaming state
onComplete: (finalText) => {
  setMessages(prev => [...prev, { role: 'assistant', content: finalText }]);
  setStreamingContent('');
}
```

This is a more advanced optimization — only worth doing if you have >100 messages in the list and streaming lag is measurable. For most MVPs, `React.memo` + `useCallback` is sufficient.

### Fix 5: CSS Animations Over JS for the Typing Indicator

The typing indicator (three bouncing dots) should use CSS animation, not JavaScript `setInterval`. JS timers cause renders; CSS animations do not:

```css
/* app.css */
.typing-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--color-muted);
  animation: typing-bounce 1.2s infinite ease-in-out;
}
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing-bounce {
  0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
  40%           { transform: scale(1.2); opacity: 1; }
}
```

---

## 45. Dify Env Vars vs START Node Inputs

These are two different mechanisms for getting data into a Dify workflow. Choosing the wrong one causes inflexible workflows or unnecessary data in every API call.

### Dify Environment Variables

Configured in: **Dify Studio → Settings (gear icon) → Environment Variables**

```
Type: String | Number | Secret
```

**Use for:** Static constants that are the same for every execution of the workflow. Changed rarely. Managed in Dify Studio, not your code.

**Examples:**
- Per-topic scorecards (the evidence/criteria lists for `eval_topic_a`)
- System prompts or persona descriptions that rarely change
- Feature flags specific to this workflow
- Threshold values (similarity cutoffs)

**How to reference in a node:**
```
{{eval_topic_a}}  (in LLM node system prompt or Code node input)
```

### START Node Inputs

Configured in: **Dify Studio → START node → click "+" to add variables**

```
Type: String | Number | Paragraph | Select | File | File List
```

**Use for:** Dynamic values that change per execution. Set by your API call's `inputs` object.

**Examples:**
- `user_id` — the Supabase UUID of the user triggering this workflow
- `intake_summary` — the full JSON string of the user's summary
- `topic_context` — pre-assembled KB retrieval results
- Any value computed server-side before calling Dify

**How to set from your API call:**
```js
// api/workflow/generate.js
const body = {
  inputs: {
    user_id: userId,                            // START node String variable
    intake_summary: JSON.stringify(summary),   // START node Paragraph variable
  },
  response_mode: 'streaming',
  user: userId,
};
await fetch(`${getDifyBaseUrl()}/workflows/run`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
```

### The Decision Rule

| Data characteristic | Use |
|---|---|
| Same every time this workflow runs | Dify env var |
| Specific to this particular user or session | START node input |
| Sensitive (API keys, secrets) — see warning below | Dify env var (Secret type) |
| Large (multi-KB JSON blobs) | START node input (Dify env vars have size limits) |
| Needs to be testable in Run panel | START node input |
| Changes require Dify Studio access | Dify env var |
| Changes require code deploy | Either (deploy sets the inputs in your API call) |

### Warning: Dify Env Vars Are Not Secret

Despite Dify having a "Secret" type for env vars, **treat all Dify env vars as potentially visible**. Dify stores workflow configurations in its database and exposes them in workflow logs. Never put `SUPABASE_SERVICE_ROLE_KEY` or `OPENAI_API_KEY` in a Dify env var. Use them in your Vercel serverless functions instead, and have Dify call your endpoint.

### Workflow Testing Implication

START node inputs are visible in the Run panel — you can paste real values and test with them. Dify env vars are not shown in the Run panel; they're silently injected. This means:

- If your workflow behaves differently in Studio vs production, and you can't figure out why, check whether a `{{variable}}` reference is resolving to a Dify env var (which you can't inspect at runtime) vs a START node input (which you can see in logs).
- Always keep per-execution data in START node inputs so it's visible in run history.

---

## 46. Calling Postgres Functions — `supabase.rpc()`

Postgres functions defined via `CREATE OR REPLACE FUNCTION` are callable from supabase-js using `.rpc()`. This is used for the vector similarity search and any other complex query that can't be expressed with supabase-js's query builder.

### Client-Side Call (anon key, RLS enforced)

```js
// src/ code — uses the anon client, RLS applies
const { data: results, error } = await supabase.rpc('search_embeddings', {
  p_user_id: userId,
  p_embedding: JSON.stringify(queryEmbedding),   // float[] must be JSON stringified
  p_top_k: 5,
  p_similarity_threshold: 0.5,
  p_source_types: ['conversation', 'summary'],   // null to search all types
});

if (error) {
  console.error('Search failed:', error.message);
  return [];
}
// results: [{ content, source_type, source_id, chunk_index, similarity, metadata }]
```

### Server-Side Call (service_role, no RLS)

```js
// api/ code — uses the admin client, must filter manually
const supabase = getSupabaseAdmin();
const { data: results, error } = await supabase.rpc('search_embeddings', {
  p_user_id: userId,           // REQUIRED — no RLS filtering, must be explicit
  p_embedding: JSON.stringify(queryEmbedding),
  p_top_k: 10,
  p_similarity_threshold: 0.3,
  p_source_types: null,        // null = all source types
});
```

### The `JSON.stringify` Requirement

The `embedding vector(1536)` Postgres column expects a JSON array string, not a native JavaScript array. Without stringifying:

```js
// WRONG — passes a JavaScript array, Postgres can't handle it
p_embedding: queryEmbedding,       // [0.123, -0.456, ...]

// CORRECT — JSON stringified float array
p_embedding: JSON.stringify(queryEmbedding),  // "[0.123, -0.456, ...]"
```

This is not obvious from the Supabase docs. The pgvector extension accepts the `vector` type from a JSON array string in this context.

### Granting Execute Permission

If you added the `search_embeddings` function after enabling RLS, verify the function has the right permissions:

```sql
-- In a migration or Supabase SQL editor
GRANT EXECUTE ON FUNCTION search_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION search_embeddings TO service_role;
```

Without this, `.rpc()` calls return a `permission denied` error even with a valid JWT.

### Handling No Results

`search_embeddings` returns an empty array (not null) when there are no matches. This is correct behavior for new users — their KB is empty:

```js
const results = data || [];
if (results.length === 0) {
  // KB is empty — either new user or embeddings not yet written
  // Return empty context string — Dify LLM will use intake summary only
  return '';
}
```

Never treat 0 results as an error. It's expected state for users who haven't completed intake or whose files/conversations haven't been embedded yet.

### Parallel RPC Calls for Multiple Topics

For multi-topic workflows, all topic searches run in parallel:

```js
// api/workflow/_topicContext.js
const searchPromises = topics.map(topic =>
  supabase.rpc('search_embeddings', {
    p_user_id: userId,
    p_embedding: JSON.stringify(embeddings[topic.id]),
    p_top_k: 10,
    p_similarity_threshold: 0.3,
  })
);

// Promise.allSettled — partial failures don't block other topics
const results = await Promise.allSettled(searchPromises);

const contexts = {};
results.forEach((result, i) => {
  const topicId = topics[i].id;
  if (result.status === 'fulfilled' && !result.value.error) {
    contexts[topicId] = result.value.data?.map(r => r.content).join('\n\n---\n\n') || '';
  } else {
    console.error(`[context] search failed for ${topicId}:`, result.reason?.message);
    contexts[topicId] = '';  // graceful fallback
  }
});
```

Use `Promise.allSettled` (not `Promise.all`) — a single topic search failure shouldn't cancel the others.

### Debugging RPC Calls

If `.rpc()` fails silently or returns no results:

1. **Check the Supabase SQL editor** — paste the function call directly and run it with a real user UUID and a fake embedding (`ARRAY[0.1, 0.1, ...]::vector(1536)`)
2. **Verify the embedding dimension** — `vector(1536)` columns reject arrays with != 1536 elements. OpenAI `text-embedding-3-small` returns exactly 1536 — but verify
3. **Check the threshold** — start at `0.1` in debugging to verify any results come back at all, then raise it
4. **Verify the user has embeddings** — `SELECT count(*) FROM document_embeddings WHERE user_id = 'uuid'`. If 0, the embedding pipeline never ran for this user

---

## 47. Supabase Storage — File Buckets, Signed URLs, RLS

Supabase Storage is S3-compatible and uses the same JWT/RLS model as Postgres. Files are referenced in the DB, not stored in it — the DB holds the path, Storage holds the bytes.

### Bucket Setup

Create buckets in **Supabase Dashboard → Storage → New bucket**.

```sql
-- In a migration — creates the bucket if it doesn't exist yet
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-uploads', 'user-uploads', false)
ON CONFLICT (id) DO NOTHING;
```

`public: false` means every access requires authentication. Never use `public: true` for user-specific files.

### RLS Policies on Storage

Storage RLS lives in `storage.objects`, not your app tables:

```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read their own files
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow delete of own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

The convention is to put the user's UUID as the top-level folder: `user-uploads/{userId}/{filename}`. `storage.foldername(name)[1]` extracts that first path segment.

### Uploading from the Client

```js
// src/api/dataAccess.js or a fileStorage.js utility
import { supabase } from './supabaseClient.js';

export async function uploadUserFile(userId, file) {
  const path = `${userId}/${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from('user-uploads')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,   // false = error on duplicate path, true = overwrite
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  return data.path;   // store this path in your DB row
}
```

### Generating Signed URLs (Short-Lived)

Never expose file paths directly. Generate signed URLs with a TTL:

```js
export async function getSignedUrl(path, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from('user-uploads')
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;   // valid for expiresInSeconds
}
```

Call this at render time, not at upload time — signed URLs expire. For a list of files, generate all signed URLs in parallel:

```js
const signedUrls = await Promise.all(
  files.map(f => getSignedUrl(f.storage_path))
);
```

### Reading Files in Serverless Functions (service_role)

In `api/` code, use the admin client — it bypasses RLS and can read any file:

```js
import { getSupabaseAdmin } from './_supabase.js';

async function downloadFileText(storagePath) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from('user-uploads')
    .download(storagePath);

  if (error) throw new Error(`Download failed: ${error.message}`);
  return await data.text();   // Blob → string
}
```

### Tracking Files in the DB

Store file metadata alongside the storage path so you can list, delete, and embed files without scanning the bucket:

```sql
CREATE TABLE user_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,          -- path in Supabase Storage bucket
  original_name TEXT NOT NULL,          -- user-visible filename
  mime_type     TEXT,
  file_size     BIGINT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own files" ON user_files
  FOR ALL TO authenticated
  USING (user_id = auth.uid());
```

### Deleting Files

Must delete from both Storage and DB:

```js
async function deleteUserFile(fileId, storagePath) {
  const supabase = getSupabaseAdmin();

  // Delete from Storage
  const { error: storageErr } = await supabase.storage
    .from('user-uploads')
    .remove([storagePath]);
  if (storageErr) console.error('Storage delete failed:', storageErr.message);

  // Delete DB row
  await supabase.from('user_files').delete().eq('id', fileId);
}
```

Order doesn't matter much since they're independent, but deleting from Storage first means if the DB delete fails you don't have orphaned files.

### Gotcha: Bucket Must Exist Before RLS Policies

The `INSERT INTO storage.buckets` must run before the `CREATE POLICY` statements that reference it. If you write migrations out of order, the policies will fail. Keep bucket creation in the earliest migration that touches Storage.

### Gotcha: `upsert: true` Uses the Full Path as Key

If you try to re-upload a file with the same path and `upsert: true`, the old file is replaced silently. This is usually what you want for profile pictures. For versioned files (documents, reports), generate unique paths using timestamps or UUIDs.

---

## 48. Workflow Phase Persistence

The intake UI has four phases (`intake`, `results`, `detail`, `intake-readonly`). Without persistence, a page refresh returns the user to `intake` and they lose their place.

### Pattern: Phase Stored in `workflow_summaries`

The `workflow_summaries` table has a `current_phase` column:

```sql
-- In 001_initial_schema.sql
CREATE TABLE workflow_summaries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_data  JSONB NOT NULL,
  current_phase TEXT DEFAULT 'intake',   -- ← phase persisted here
  ...
);
```

Phase is saved when the summary is persisted (the summary write and the phase write are combined):

```js
// App.jsx — fire-and-forget after summary extraction succeeds
const persistSummary = async (summary) => {
  await fetch('/api/summary', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflowSummary: summary,
      currentPhase: 'results',   // hardcoded to 'results' on first completion
    }),
  });
};
```

### Restoring Phase on Login

```js
// src/api/dataAccess.js
export async function loadWorkflowSummary() {
  const { data } = await supabase
    .from('workflow_summaries')
    .select('summary_data, current_phase')
    .maybeSingle();
  return data ? { summaryData: data.summary_data, phase: data.current_phase } : null;
}

// App.jsx — in the auth restore handler
const savedSummary = await loadWorkflowSummary();
if (savedSummary) {
  setWorkflowSummary(savedSummary.summaryData);
  setWorkflowPhase('results');   // always land on results if data exists
  // Note: we use 'results' not savedSummary.phase
  // 'detail' and 'intake-readonly' are transient navigation states
}
```

### Why Always Restore to 'results', Not the Saved Phase

`detail` and `intake-readonly` are navigation sub-states within the post-intake flow. Restoring directly to `detail` would require also restoring `activeTopicId`, scroll position, and which topic conversation was active. It's simpler and less surprising to always land on `results` and let the user navigate from there.

The only meaningful bifurcation on restore is:
- No summary in DB → `setWorkflowPhase('intake')` (default, user hasn't completed intake)
- Summary in DB → `setWorkflowPhase('results')` (user has completed intake, show results)

### Updating Phase Without Re-saving the Full Summary

If you need to persist a phase change independently (e.g., tracking that a user entered detail view), update only the `current_phase` column:

```js
// Direct Supabase call from client (anon key, RLS enforced to own row)
async function updateWorkflowPhase(newPhase) {
  const { error } = await supabase
    .from('workflow_summaries')
    .update({ current_phase: newPhase })
    .eq('user_id', (await supabase.auth.getUser()).data.user.id);

  if (error) console.error('[updatePhase]', error.message);
}
```

For MVP, only `'results'` is typically written on initial completion, and all sub-phases are ephemeral. Fine for MVP; revisit if you need precise analytics on where users abandon.

---

## 49. Minimal Markdown Rendering in Chat

LLMs emit markdown formatting (`**bold**`, `*italic*`, newlines). If you render this as raw text, users see asterisks. If you reach for a library (react-markdown, marked), you add ~50KB of bundle and an XSS surface.

The right tradeoff for an MVP is a manual inline renderer that handles the 5 most common patterns.

### The Pattern

```js
// In App.jsx (or ChatPanel.jsx)
const renderMessageContent = (msg) => {
  // Special message types handled first
  if (msg.isStreaming && !msg.content) {
    return <TypingIndicator />;
  }
  if (msg.isFile) {
    return <FileAttachmentBadge filename={msg.content} />;
  }
  if (msg.isError) {
    return <span style={{ color: '#ef4444' }}>{msg.content}</span>;
  }

  // Inline markdown: split on **bold**, *italic*, and newlines
  const parts = msg.content.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\n)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part === '\n') return <br key={i} />;
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*'))
          return <em key={i}>{part.slice(1, -1)}</em>;
        return part;   // plain text
      })}
    </>
  );
};
```

Pass it as a prop to `ChatPanel`:

```jsx
<ChatPanel
  messages={messages}
  renderMessageContent={renderMessageContent}
  // ...
/>
```

Inside `ChatPanel.jsx`, call it per message:

```jsx
// ChatPanel.jsx
function MessageBubble({ msg, renderMessageContent }) {
  return (
    <div className={`message ${msg.role}`}>
      {renderMessageContent ? renderMessageContent(msg) : msg.content}
    </div>
  );
}
```

### What This Handles

| Pattern | Output |
|---|---|
| `**bold text**` | `<strong>bold text</strong>` |
| `*italic text*` | `<em>italic text</em>` |
| `\n` (newline) | `<br>` |
| Plain text | Rendered as-is |

### What This Does NOT Handle (and That's OK for MVP)

- Headers (`# H1`, `## H2`)
- Lists (`- item` or `1. item`)
- Code blocks (`` `code` `` or ` ```block``` `)
- Links (`[text](url)`)
- Tables

LLMs will sometimes emit these in conversational replies, and they'll render as raw text. That's acceptable for chat. If you need full markdown (e.g., rendering reports or analysis results), add `react-markdown` with `rehype-sanitize` specifically for those non-chat output surfaces. Keep the chat renderer minimal.

### XSS Safety Note

This regex-split approach never uses `dangerouslySetInnerHTML`. It creates React elements (`<strong>`, `<em>`, `<br>`) directly, which React escapes automatically. Adding `dangerouslySetInnerHTML` to pass HTML strings to the DOM is the wrong approach here — it opens XSS even with sanitization libraries, which have their own vulnerabilities. React element creation is safe by construction.

### When to Reach for a Library

Add `react-markdown` + `rehype-sanitize` when:
- You're rendering user-generated or LLM-generated content that includes headers, lists, code blocks, or tables as a feature (not incidentally)
- You need to render content in a non-chat context (documentation, analysis reports, rich descriptions)

```bash
npm install react-markdown rehype-sanitize
```

```jsx
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

function ResultsMarkdown({ content }) {
  return (
    <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
      {content}
    </ReactMarkdown>
  );
}
```

---

## 50. Local Serverless Testing with `vercel dev`

The Vite dev server (`npm run dev`) proxies `/api/chat` directly to Dify. This works for intake chat but has two hard limitations:
1. The proxy can't inspect the request body, so it always uses the primary workflow API key — secondary workflow routing doesn't work
2. Endpoints that don't have a Vite proxy (e.g., `/api/workflow/generate`, `/api/summary`, `/api/knowledge/embed`) return 404 in Vite dev mode

`vercel dev` solves both problems by running the actual serverless functions locally.

### Setup

```bash
# Install Vercel CLI globally (once)
npm install -g vercel

# Link your project (once, interactive)
vercel link
# → Choose your Vercel team and project

# Start local dev with serverless functions
vercel dev
```

`vercel dev` starts on port 3000 by default (not 5173). It serves both the Vite frontend and the `/api` serverless functions as local Node.js processes.

### Environment Variables in `vercel dev`

`vercel dev` pulls env vars from your linked Vercel project's settings automatically. You can verify this with:

```bash
vercel env pull .env.local   # pulls all env vars to a local file
```

Alternatively, it reads from `.env.local` if present. Never commit `.env.local` — it contains your real secrets.

If a secret is missing in `vercel dev`, the function will log `undefined` for that var. Check the terminal output, not just the browser.

### When to Use `vercel dev` vs `npm run dev`

| Scenario | Use |
|---|---|
| Day-to-day intake chat development | `npm run dev` (faster HMR, direct Dify proxy) |
| Testing secondary workflow routing | `vercel dev` |
| Testing `/api/summary`, `/api/workflow/generate` | `vercel dev` |
| Testing JWT auth middleware (`_auth.js`) | `vercel dev` |
| Testing embedding pipeline end-to-end | `vercel dev` |
| Working without internet (Dify unavailable) | `npm run dev` with `VITE_DIFY_MOCK=true` |

### Key Differences from Production

| Behavior | `vercel dev` | Production |
|---|---|---|
| Cold start | No cold starts | ~250ms on first request |
| Function timeout | 30s default, `maxDuration` in vercel.json respected | Same |
| Edge Runtime | Falls back to Node.js | True Edge Runtime |
| Logs | Terminal stdout | Vercel dashboard logs |
| Concurrency | Sequential (single process) | Parallel instances |

### Gotcha: Edge Runtime Functions Don't Run Locally in Node.js Mode

If a serverless function uses `export const config = { runtime: 'edge' }`, `vercel dev` will attempt to run it in a simulated Edge environment. Some Node.js APIs (e.g., `process.env` access patterns, certain `crypto` calls) behave differently. If you see runtime errors locally that don't appear in production (or vice versa), the Edge vs Node runtime gap is the first thing to check.

For streaming workflows (`/api/workflow/generate`), Edge Runtime is used for the SSE response — test this endpoint end-to-end with `vercel dev` before shipping.

### Debugging Serverless Functions Locally

1. **Add `console.log` liberally** — output appears in the `vercel dev` terminal, not the browser console
2. **Check request body parsing** — `vercel dev` parses JSON bodies; if your function reads `req.body` and gets `undefined`, check `Content-Type: application/json` header from the client
3. **Check auth middleware** — `_auth.js` validates JWTs against the Supabase JWKS endpoint. In local mode, the JWKS fetch hits the real Supabase — ensure network is available
4. **Environment variable audit** — if a function returns 500, add `console.log(process.env.SOME_KEY ? 'SET' : 'MISSING')` at the top to rule out missing vars

### The Standard Dev Workflow

```bash
# Terminal 1: frontend
npm run dev     # port 5173, mock mode for Dify

# Terminal 2: backend (when testing serverless routes)
vercel dev      # port 3000, real serverless functions

# .env: VITE_DIFY_MOCK=true for terminal 1
# .env.local: all real secrets for terminal 2
```

The two dev servers run independently. When testing a full flow (intake → summary persist → embedding → analysis), always use `vercel dev` in terminal 2 and point the frontend at port 3000 (or just use `vercel dev` for everything at port 3000).
