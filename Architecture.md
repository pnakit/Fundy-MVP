# Architecture — Multi-Tenancy, Persistence & Auth

Reference document for the planned production architecture. The current app uses mock/ephemeral state — this describes the target.

**Status**: Planned (not yet implemented). Build evaluation and investments features first.

---

## Stack: Supabase (Unified)

Single platform covering auth, relational DB, vector DB, and file storage. `auth.uid()` enforces per-user data isolation via Row-Level Security (RLS).

| Category | Solution | Why |
|----------|----------|-----|
| **Auth** | Supabase Auth (email OTP) | Built-in `signInWithOtp()`, 50K MAU free tier, JWT integrates with RLS |
| **Structural DB** | Supabase Postgres + RLS | Standard Postgres, auto-generated REST API (PostgREST), RLS = automatic multi-tenancy |
| **Vector DB** | Supabase pgvector | Same database, same RLS policies, adequate for MVP scale |
| **File Storage** | Supabase Storage | S3-compatible, RLS on buckets, integrated with same auth JWT |
| **Upgrade paths** | Pinecone (vectors), Cloudflare R2 (files), Neon (database) | All swappable via adapter pattern |

### Key advantages
- **Single vendor** — one dashboard, one billing, one SDK
- **Auth-to-data seamless** — `auth.uid()` in RLS policies = zero application code for multi-tenancy
- **Standard Postgres** — `pg_dump` works, ORMs work, portable to any Postgres host
- **Free tier** — 500 MB DB + 1 GB files + 50K MAUs + pgvector included

### Alternatives considered
- **Clerk** (auth): Pre-built components, but 10K MAU limit, separate system from DB, low swappability
- **Neon** (database): Pure Postgres, but no built-in auth/storage/REST API — more glue code
- **Pinecone** (vector): Purpose-built, but separate vendor/billing/API — overkill at MVP scale
- **Cloudflare R2** (files): Zero egress fees, but no auth integration

---

## Architecture Overview

```
React App ──> supabase-js (user JWT, RLS enforced) ──> Supabase Postgres
React App ──> Vercel Serverless (JWT-validated)     ──> Supabase Postgres (service_role)
Dify      ──> Vercel Serverless (API-key-validated) ──> Supabase Postgres (service_role)
```

### CRITICAL: Dify never touches Supabase directly

Dify stores secrets in plain text in its database and exposes them in workflow logs (see [#25958](https://github.com/langgenius/dify/issues/25958), [#26457](https://github.com/langgenius/dify/issues/26457)). The `service_role` key must **never** be stored in Dify.

Instead, Dify HTTP Request nodes call **Vercel serverless proxy endpoints** (e.g., `POST /api/supabase/profile`), authenticated with a shared `DIFY_WEBHOOK_SECRET`. The Vercel function holds the `service_role` key securely and makes the actual Supabase call.

### Data Access Layer (`src/api/dataAccess.js`)

Thin adapter wrapping `supabase-js`. If providers change, only this module changes.

```
dataAccess.js
  ├── auth: signIn(email), verifyOtp(email, code), signOut(), getUser(), onAuthStateChange()
  ├── conversations: create(), list(), getMessages(), addMessage()
  ├── evaluations: save(), get(), update()
  ├── actionItems: create(), list(), update(), delete()
  ├── files: upload(), list(), getSignedUrl(), delete()
  └── vectors: upsert(), search(query, topK)
```

### Serverless Auth Middleware (`api/_auth.js`)

Every Vercel serverless function validates the caller's JWT using `jose` (JWKS verification — cached, no network call per request):

```javascript
import { createRemoteJWKSet, jwtVerify } from 'jose'
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
)
export async function verifyAuth(req) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return { error: 'Missing token', status: 401 }
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
    })
    return { user: payload }
  } catch (err) {
    return { error: err.code === 'ERR_JWT_EXPIRED' ? 'Token expired' : 'Invalid token', status: 401 }
  }
}
```

### Dify Proxy Endpoints (`api/supabase/*.js`)

Authenticated with a shared secret (`DIFY_WEBHOOK_SECRET`), these let Dify read/write user data:

```
api/supabase/
  profile.js    # GET/POST user profile
  evaluation.js # POST evaluation results from Dify workflow
  files.js      # GET signed URL for a user's file
```

Each validates the webhook secret and requires `user_id` in the request body. Dify passes the user ID via `inputs: { user_id: supabaseUserId }` in workflow variables.

---

## Database Schema

### Tables + Constraints + Indexes

```sql
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

CREATE TABLE action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed')),
  source TEXT,
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

CREATE TABLE file_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  dify_file_id TEXT,
  context TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Defer to Phase 5 — create with exact model dimension when embedding model is chosen
-- CREATE TABLE document_embeddings ( ... );

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
CREATE INDEX idx_file_metadata_user_id ON file_metadata(user_id);

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

ALTER TABLE onboarding_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own summary" ON onboarding_summaries FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own evaluations" ON evaluations FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own files" ON file_metadata FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upload own files" ON file_metadata FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Global config: read-only for all, write via service_role only
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read config" ON app_config FOR SELECT USING (true);

-- Deletion audit: no public access (service_role only)
ALTER TABLE deletion_audit ENABLE ROW LEVEL SECURITY;

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
```

---

## Production-Readiness Checklist

### Beta Blockers (must fix before public testing)

| # | Issue | Fix | Effort |
|---|-------|-----|--------|
| 1 | **Supabase built-in SMTP: 2 emails/hr** | Switch to Resend custom SMTP ($0, 100 emails/day free) | 1-2 hrs |
| 2 | **Serverless functions have zero auth** | Add `api/_auth.js` JWT validation to all endpoints | 2-4 hrs |
| 3 | **`service_role` key must never reach Dify** | Proxy pattern: Dify -> Vercel -> Supabase | Architecture (done) |
| 4 | **`'default-user'` hardcoded** | Pass real Supabase user ID via `user` + `inputs` | 1-2 hrs |
| 5 | **No database indexes** | Add indexes on every `user_id` column | 30 min |
| 6 | **No `ON DELETE CASCADE`** | Add cascades to all `auth.users` foreign keys | 30 min |
| 7 | **Missing UNIQUE constraints** | Add to summaries, evaluations, investments, conversations | 15 min |
| 8 | **`app_config` has no RLS** | Enable RLS + read-only public policy | 5 min |
| 9 | **No migration strategy** | Set up Supabase CLI migrations | 1 hr |

### Strongly Recommended (pre-launch)

| # | Issue | Fix | Effort |
|---|-------|-----|--------|
| 10 | OTP expiry default is 1 hour | Reduce to 600s (10 min) in dashboard | 5 min |
| 11 | No CAPTCHA on OTP | Enable hCaptcha/Turnstile in dashboard | 1-2 hrs |
| 12 | No security headers | Add CSP, X-Frame-Options via `vercel.json` | 30 min |
| 13 | No `onAuthStateChange` handler | Redirect to login on session expiry | 1-2 hrs |
| 14 | JWT expiry default is 1 hour | Reduce to 15-30 min in dashboard | 5 min |

### Post-Launch

| # | Issue | Notes |
|---|-------|-------|
| 15 | `document_embeddings` table | Create with exact dimension when model is chosen |
| 16 | Orphaned storage files on delete | Trigger + Edge Function to clean up Storage blobs |
| 17 | Data export (GDPR portability) | Serverless function to export all user data as JSON |
| 18 | Optimistic locking on action items | `updated_at` check for multi-tab race conditions |

---

## Supabase Dashboard Configuration

Before any code changes, configure these settings:

1. **Auth > Providers > Email**: Enable OTP, set expiry to 600 seconds
2. **Auth > SMTP Settings**: Configure Resend SMTP (host: `smtp.resend.com`, port: 465, username: `resend`, password: Resend API key, sender: `auth@nusuai.com`)
3. **Auth > Bot and Abuse Protection**: Enable hCaptcha or Cloudflare Turnstile
4. **Auth > Sessions**: Set JWT expiry to 900-1800 seconds (15-30 min)
5. **Auth > URL Configuration**: Add `https://app.nusuai.com` and `http://localhost:5173` as redirect URLs
6. **Database > Extensions**: Enable `pgvector` (for later use)

---

## File Handling Strategy

**Supabase Storage is the primary store.** Files are uploaded to Supabase first, metadata recorded in `file_metadata`, then a signed URL (1-hour expiry) is passed to Dify via the proxy endpoint. This gives:

- Single source of truth with RLS access control
- No dependency on Dify's undocumented file retention policy
- Signed URLs work with Dify's `remote_url` file reference type

The existing direct-to-Dify upload path (`/api/upload`) is kept during migration but deprecated.

---

## Conversation State: Dual Storage

Dify and Supabase serve different purposes — this is not redundant:

| Store | Purpose | Retention |
|-------|---------|-----------|
| **Dify** `conversation_id` | LLM context window for ongoing chat session | Undocumented, may be garbage-collected |
| **Supabase** `conversations` + `messages` | Permanent user history, search, analytics | Controlled by us |

Supabase is the source of truth for displaying conversation history. Dify's `conversation_id` is stored as a field on the conversation record. If Dify invalidates a conversation, a new one is started and recent context can be replayed from Supabase.

---

## Implementation Phases

### Phase 1: Supabase Setup + Auth
**Files**: `src/api/supabaseClient.js` (new), `src/api/dataAccess.js` (new), `src/components/LoginScreen.jsx` (rewrite of PasswordScreen), `src/App.jsx`, `api/_auth.js` (new), `vercel.json` (new)

1. Create Supabase project + configure dashboard settings
2. Set up Resend for custom SMTP
3. Set up Supabase CLI: `npx supabase init && npx supabase link`
4. Create initial migration with full schema SQL
5. Install `@supabase/supabase-js` + `jose`
6. Create `supabaseClient.js` — initialize client
7. Create `dataAccess.js` — auth methods
8. Rewrite `PasswordScreen.jsx` -> `LoginScreen.jsx` — email + OTP flow
9. Update `App.jsx` — Supabase session listener
10. Create `api/_auth.js` — JWT validation middleware
11. Add JWT validation to all serverless endpoints
12. Pass real user ID to Dify
13. Create `vercel.json` with security headers
14. Update `.env.example`

### Phase 2: Conversation Persistence
**Files**: `src/api/dataAccess.js` (extend), `src/App.jsx`

1. Add conversation + message data access methods
2. Fetch existing conversations on app load
3. Persist messages on send/receive
4. Handle Dify conversation invalidation recovery

### Phase 3: Evaluation & Action Item Persistence
**Files**: `src/api/dataAccess.js` (extend), `src/App.jsx`

1. Add evaluation + action item + investment selection methods
2. Upsert onboarding summaries, evaluations, investment selections
3. Upsert action items with race-condition-safe `ON CONFLICT` patterns

### Phase 4: File Storage Migration
**Files**: `src/api/dataAccess.js` (extend), `api/upload.js`, `api/supabase/files.js` (new), `src/App.jsx`

1. Create Storage bucket with RLS
2. Upload -> Supabase Storage -> metadata -> signed URL -> Dify
3. Create Dify proxy for signed URL requests

### Phase 5: Vector Search (pgvector)
**Files**: `src/api/dataAccess.js` (extend), `api/embed.js` (new), migration for `document_embeddings`

1. Choose embedding model, create table with exact dimension
2. Embedding serverless function (reads model config from `app_config`)
3. File upload -> chunk -> embed -> store
4. Similarity search method

### Phase 6: Dify Proxy Endpoints
**Files**: `api/supabase/profile.js` (new), `api/supabase/evaluation.js` (new), `api/supabase/files.js` (extend)

1. Proxy endpoints authenticated with `DIFY_WEBHOOK_SECRET`
2. Update Dify workflows to call proxy
3. Enable retries (3-5x) + error handling fallback paths

---

## Environment Variables (new, in addition to existing)

| Variable | Side | Purpose |
|----------|------|---------|
| `VITE_SUPABASE_URL` | Client | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Client | Supabase anon key (safe for client, RLS enforced) |
| `SUPABASE_URL` | Server | Same URL, non-VITE for serverless functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Bypasses RLS — **never expose to client or Dify** |
| `DIFY_WEBHOOK_SECRET` | Server + Dify | Shared secret for Dify -> Vercel proxy auth |
| `EMBEDDING_API_KEY` | Server | API key for embedding provider (Phase 5) |
| `RESEND_API_KEY` | Supabase SMTP | Used as SMTP password in Supabase dashboard |

### Security Rules
- Only `VITE_`-prefixed vars are bundled into the client build
- `SUPABASE_SERVICE_ROLE_KEY` exists only in Vercel env vars — never in Dify, never in client
- `DIFY_WEBHOOK_SECRET` stored in both Vercel and Dify env vars

---

## Verification Checklist

1. **Auth**: Email -> OTP -> login -> refresh -> still authenticated -> logout -> can't access data
2. **Persistence**: Send messages -> refresh -> messages restored
3. **Multi-tenancy**: User A data invisible to User B
4. **Serverless security**: Endpoints reject requests without valid JWT
5. **Dify proxy security**: Endpoints reject requests without valid webhook secret
6. **RLS**: Cross-user data access blocked
7. **CSP headers**: Present on all responses
8. **Tests**: `npm run test:run` all pass, `npm run lint` clean
