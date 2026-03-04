# Project Memory — Fundy MVP

High-level record of the app's evolution, decisions made, and context for future work.

## v0 — Initial Commit

- Monolithic single-file React app (`App.jsx`, ~1900 lines including inline CSS)
- Three-window startup evaluation platform: Onboarding Chat, Evaluation & Actions, Investment Matching
- Mock data with simulated Dify API responses
- Deployed to Vercel at `fundy.nusuai.com`
- No tests, no linter, no component extraction

## v1 — Architecture & Quality Refactor (Feb 2026)

Full code review was conducted across 4 dimensions (Architecture, Code Quality, Tests, Performance). All changes were approved interactively before implementation.

### What changed

**Architecture (4 issues addressed):**
- Extracted monolithic App.jsx into ~10 modules: data, API, utils, components, CSS
- Removed `DataStore` singleton — initial data inlined as `useState` defaults (eliminates dual source of truth)
- Password moved from hardcoded string to `VITE_APP_PASSWORD` env var with `sessionStorage` persistence
- `DifyAPI` extracted to `src/api/difyApi.js` as standalone module

**Code Quality (4 issues addressed):**
- Created reusable `ChatPanel` component — eliminates 3x duplication of chat UI (onboarding, deep-dive, and the shared message list / typing / input pattern)
- Centralized color constants in `src/utils/colors.js` — `COLORS.success`, `.warning`, `.danger`, `.primary`, `.muted` used by all 4 color helper functions
- Created `ProgressRing` component — replaces 4 hand-rolled SVG circle patterns
- Fixed `toggleInvestment` bug: deselecting an investment now properly removes associated action items. Action IDs use incrementing counter instead of `Date.now() + Math.random()`

**Tests (4 issues addressed):**
- Set up Vitest + React Testing Library + jsdom
- 45 tests across 5 files: extractSummary (22), colors (6), difyApi mock (7), PasswordScreen (5), InvestmentToggle (5)
- Key coverage: LLM JSON parsing edge cases, auth gate flow, investment select/deselect action cleanup

**Performance (4 issues addressed):**
- CSS extracted to static `src/styles/app.css` (eliminates ~1000 line template literal diffing per render)
- `RadarChart` and `ChatPanel` wrapped in `React.memo`
- Google Fonts moved from CSS `@import` to `<link>` tags in `index.html` with `preconnect` hints

## v1.1 — Tooling & Resilience (Feb 2026)

### What changed

- **ESLint 9 + Prettier** — flat config (`eslint.config.js`), React + React Hooks plugins, Prettier integration (`.prettierrc`: single quotes, trailing commas, 120 char width). All files pass with 0 errors/warnings.
- **`.env.example`** — documents all env vars (`DIFY_BASE_URL`, `DIFY_ONBOARDING_API_KEY`, `DIFY_DEEPDIVE_API_KEY`, `VITE_DIFY_MOCK`, `VITE_DIFY_STREAMING`, `VITE_APP_PASSWORD`).
- **Serverless function DRY-up** — extracted `api/_shared.js` with `resolveApiKey()` and `getDifyBaseUrl()`. All 3 serverless functions (`chat.js`, `upload.js`, `chat/stop.js`) import from it.
- **Error boundaries** — `ErrorBoundary` component wraps each window in App.jsx. A crash in one window shows a retry UI without taking down the whole app.

## v1.2 — Architecture Planning (Feb 2026)

Comprehensive architecture research and production-readiness review for multi-tenancy, persistence, and auth. Full plan documented in `Architecture.md`.

### Decisions made

- **Supabase unified stack** — auth (email OTP), Postgres + RLS, pgvector, Storage. Single vendor, single SDK, RLS-based multi-tenancy.
- **Dify never touches Supabase directly** — proxy pattern via Vercel serverless functions. Dify stores secrets in plain text and exposes them in logs.
- **Embedding model flexibility** — model config stored in `app_config` table (not env vars), dimension set at table creation time.
- **File storage: Supabase Storage primary** — signed URLs passed to Dify via proxy. No dual-upload.
- **Conversation dual storage** — Dify for LLM context, Supabase for permanent history.
- **JWT validation on all serverless endpoints** — currently open to anyone, must fix before public beta.
- **Custom SMTP (Resend)** — Supabase built-in SMTP limited to 2 emails/hour, unusable for external users.

### Implementation order

Build evaluation and investments features first, then implement the architecture phases:
1. Auth (replace password gate with email + OTP)
2. Conversation persistence
3. Evaluation & action item persistence
4. File storage migration
5. Vector search (pgvector)
6. Dify proxy endpoints

## v2.0 — Evaluation Page Redesign (Feb 2026)

Complete redesign of the Evaluation & Actions page from the original 8-dimension, 0-100 scoring model to a 10-dimension maturity + performance framework.

### What changed

**New Data Model:**
- 10 evaluation dimensions (Product & Tech, Market Traction, Business Model, Team, GTM, Financial Health, Fundraising, Competitive Position, Operations, Legal & Compliance)
- Each dimension has a maturity level (1-5: Concept → Early → Validated → Scaling → Leader) and a performance score (1-5: Poor → Fair → Average → Good → Exceptional)
- Each dimension includes a description paragraph (shown on card click)
- Action items now have `sourceType` ('evaluation' | 'investment'), `sourceId`, `dimensionId`, and `actionKey` fields

**New UI Layout (3 sections):**
1. **Overall Assessment** — Stage card (maturity name + 5-dot tracker) + Progress card (score + label) + description paragraph
2. **Dimension Analysis** — radar chart (maturity levels, left) + progress details card grid (5 columns, right). Cards are clickable to reveal descriptions. Sorted worst-performing first.
3. **Action Items** — grouped by dimension (worst-performing first), with performance badges. Action cards indented under group headers at 90% width.

**New Files:**
- `src/utils/actionItems.js` — `addInvestmentActions()` and `removeInvestmentActions()` pure functions, used by both App.jsx and tests
- `src/utils/actionItems.test.js` — 12 tests covering add/remove, metadata, immutability, edge cases

**Updated Files:**
- `src/data/mockData.js` — added `EVALUATION_DIMENSIONS`, `MATURITY_STAGES`, `PERFORMANCE_RATINGS` constants; replaced `MOCK_EVALUATION_DATA` and `INITIAL_ACTION_ITEMS` with new schemas
- `src/utils/colors.js` — added `getMaturityColor()`, `getPerformanceColor()`, `getPerformanceLabel()`, `getMaturityLabel()`
- `src/utils/colors.test.js` — added 15 new tests for the 4 new helpers (21 total, up from 6)
- `src/components/RadarChart.jsx` — label radius increased for 10-axis spacing, SVG overflow visible
- `src/components/InvestmentToggle.test.jsx` — fixed test harness to use real `sourceType`/`sourceId` logic via shared utility functions (was using stale `a.source` field); added 6th test
- `src/App.jsx` — rewrote `renderEvaluationWindow()`, added `expandedDimension` state, `toggleInvestment` refactored to use `actionItems.js` utility
- `src/styles/app.css` — removed old maturity/bar chart styles, added evaluation layout styles (overall card, dimension analysis grid, dimension cards, performance bars, action dimension groups)

**Test totals:** 73 tests across 6 files (up from 45 across 5 files)

## v2.1 — Supabase Auth (Feb 2026)

Replaced the client-side password gate with Supabase email + OTP authentication.

### What changed

**New Files:**
- `src/api/supabaseClient.js` — initializes Supabase client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- `src/api/dataAccess.js` — auth methods: `signInWithOtp`, `verifyOtp`, `signOut`, `getSession`, `getUser`, `onAuthStateChange`
- `src/components/LoginScreen.jsx` — two-step email → OTP login flow (8-digit code)
- `src/components/LoginScreen.test.jsx` — 8 tests covering email + OTP steps
- `api/_auth.js` — JWT validation middleware using `jose` (JWKS verification against Supabase)
- `vercel.json` — security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)

**Modified Files:**
- `src/App.jsx` — replaced `PasswordScreen` with `LoginScreen`, added `session`/`authLoading` state, `onAuthStateChange` listener, sign-out button in header
- `src/api/difyApi.js` — all API calls now include JWT in `Authorization` header via `getAuthHeaders()`
- `api/chat.js`, `api/upload.js`, `api/chat/stop.js` — all serverless endpoints now validate JWT via `_auth.js` middleware
- `.env.example` — added `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `src/styles/app.css` — added login/auth styles (`.login-back-btn`, `.header-actions`, `.header-email`, `.sign-out-btn`, `.password-submit:disabled`)

**Test totals:** 81 tests across 7 files (up from 73 across 6 files)

**Supabase dashboard config:**
- Email OTP enabled (8-digit codes)
- Custom email templates (dark-themed, using `{{ .Token }}` for OTP)
- OTP uses "Magic Link" template for returning users, "Confirm Signup" template for new users
- Site URL: `http://localhost:5173` for local dev (change to `https://fundy.nusuai.com` for production)

### Decisions explicitly deferred

- **Resend custom SMTP** — Supabase built-in SMTP limited to 2 emails/hr. Before going live with external users: configure Resend (host `smtp.resend.com`, port `465`, username `resend`, password = Resend API key, sender `auth@nusuai.com`). Requires domain verification (DNS records) in Resend dashboard first.
- **OTP expiry tuning** — currently using Supabase defaults. Adjust later based on user feedback.
- **CAPTCHA / bot protection** — not yet enabled. Enable before public launch.
### Decisions from v2.0 still deferred
- **Window components as separate files** — the three window render functions stay in App.jsx because they share too much state. Extracting would require Context or massive prop drilling, which is over-engineering for now.
- **Full component test coverage** — only LoginScreen and InvestmentToggle have component tests. More should be added after the architecture stabilizes.
- **Integration test with mock HTTP server for Dify** — deferred until real Dify integration goes live.
- **CSS Modules / styled-components** — static CSS file is sufficient for current scope.
- **Message list virtualization (react-window)** — not needed until conversations exceed 100+ messages.
- **Dev proxy deep-dive routing** — Vite dev proxy always uses the onboarding API key. Deep-dive workflow routing only works in production (Vercel serverless). Acceptable for now since mock mode is the primary dev workflow.

## v2.2 — Code Quality Cleanup (Feb 2026)

Codebase audit and cleanup pass before continuing architecture phases.

### What changed

**Dead code removed:**
- Deleted `PasswordScreen.jsx` + `PasswordScreen.test.jsx` (replaced by LoginScreen in v2.1)
- Removed unused `PERFORMANCE_RATINGS` constant from `mockData.js`
- Removed `VITE_APP_PASSWORD` from `.env.example` (password gate replaced by Supabase auth)
- Removed unused `getMaturityColor` and `getMaturityLabel` imports from App.jsx

**DRY improvements:**
- Extracted `src/utils/fileUpload.js` — `uploadFiles()` and `buildUploadMessages()` replace ~70 lines of duplicated file upload logic between `handleFileUpload` and `handleDeepDiveFileUpload`
- Merged `renderDeepDiveMessageContent` into `renderMessageContent` — deep-dive was a strict subset, no need for a separate function
- Extracted `replaceLastMessage()` helper — replaces 8+ instances of the `const updated = [...prev]; updated[updated.length - 1] = {...}; return updated;` pattern
- Extracted `CHAT_ERROR_MESSAGE` constant — replaces 4 identical error strings

**Bug fixes:**
- Added null guards to `appendAssistant` and `updateLastMessage` closures in deep-dive handler — prevents crash if `categoryConversations[categoryId]` is undefined
- Added null guards to all `setCategoryConversations` callbacks in `handleDeepDiveFileUpload`

**Docs updated:**
- Updated CLAUDE.md: project structure (LoginScreen, dataAccess, supabaseClient, actionItems), env vars (Supabase), auth description, serverless functions (_auth.js), test counts

**New files:**
- `src/utils/fileUpload.js` — pure upload utility functions
- `src/utils/fileUpload.test.js` — 9 tests covering upload, failure, mixed results, message building

**Test totals:** 85 tests across 7 files (up from 81; PasswordScreen's 5 tests removed, 9 fileUpload tests added)

### DRY analysis: streaming handlers

The onboarding and deep-dive streaming handlers share a similar skeleton but diverge significantly in details: onboarding has ~50 lines of summary-detection and progress-tracking logic, while deep-dive targets a nested state structure via closures. A full unification would create a complex abstraction with many callback parameters — over-engineering for the actual similarity. The `replaceLastMessage` helper and shared `CHAT_ERROR_MESSAGE` constant capture the real shared pieces.

## v3.0 — Knowledge Retrieval + Streaming Evaluation Pipeline (Mar 2026)

Built the plumbing for Dify workflows to pull user data from Supabase, plus a streaming evaluation pipeline.

### Architecture decisions

- **Retrieval in our API, not Dify**: Dify's Knowledge Retrieval node is statically configured. Our API queries the KB, assembles per-category context, and passes pre-retrieved content to Dify as input variables. This allows swapping between internal Supabase pgvector and external partner databases.
- **Knowledge base abstraction**: Config-driven adapter pattern with unified `semanticSearch()` interface. Default from `ACTIVE_KNOWLEDGE_BASE` env var, per-request override.
- **Embedding model**: OpenAI `text-embedding-3-small` (1536 dimensions). Config stored in `app_config` table for future swapability.
- **Extracted file text in Supabase Storage**: Raw extracted text stored as `.txt` files alongside originals, tracked via `file_metadata.extracted_text_path`. Not in database.
- **Full 12-table schema in one migration**: All planned tables from Architecture.md + datastructure.md updates, plus pgvector `document_embeddings` table. Avoids multiple migrations.
- **Webhook auth separate from JWT auth**: `_webhookAuth.js` for future Dify → Vercel callbacks. Evaluation endpoint uses JWT auth (frontend-facing).

### What changed

**Database (supabase/migrations/001_initial_schema.sql):**
- 12 tables: user_profiles, conversations, messages, onboarding_summaries, evaluations, action_items (updated schema), investment_selections, investment_recommendations (new), file_metadata (+extracted_text_path), app_config, deletion_audit, document_embeddings (new/pgvector)
- Full RLS policies, indexes, trigger (enforce message user_id), HNSW vector index
- `search_embeddings()` Postgres function for cosine similarity search
- Seeded `app_config` with embedding model config
- Supabase CLI initialized (`supabase/` directory)

**Knowledge base layer (api/knowledge/):**
- `knowledgeBase.js` — KB abstraction with internal Supabase pgvector adapter
- `embeddings.js` — OpenAI embedding client (batch + single)
- `embed.js` — `POST /api/knowledge/embed` ingestion endpoint (webhook auth)

**Evaluation pipeline (api/evaluation/):**
- `generate.js` — `POST /api/evaluation/generate` (JWT auth, SSE streaming)
- `_categoryContext.js` — builds context for 10 categories: onboarding data + 10 parallel KB searches
- `_difyWorkflow.js` — calls Dify `/workflows/run` (streaming), transforms `node_finished` → `category_complete`

**Infrastructure (api/):**
- `_supabase.js` — server-side Supabase admin client (service_role, cached)
- `_webhookAuth.js` — webhook secret validation (constant-time comparison)
- `_chunking.js` — text chunking (conversations: message-pair windows, summaries: per-category, files: fixed windows with overlap)
- `_shared.js` — added `evaluation` to WORKFLOW_KEYS

**Frontend:**
- `src/api/evaluationApi.js` — streaming evaluation client (SSE → progressive callbacks)
- `src/App.jsx` — new state hooks (evaluationLoading, evaluationProgress, evaluationStatus, evaluationError), `handleGenerateEvaluation()`, "Generate Evaluation" button with progress indicator
- `src/styles/app.css` — evaluation button, progress indicator, error banner styles

**Test data:**
- `scripts/seed-test-data.js` — seeds conversations, summary, files, embeddings (`--real` or `--fake` mode)

**New files (15):**
- `supabase/migrations/001_initial_schema.sql`
- `api/_supabase.js`, `api/_webhookAuth.js`, `api/_chunking.js`, `api/_chunking.test.js`
- `api/knowledge/knowledgeBase.js`, `api/knowledge/embeddings.js`, `api/knowledge/embed.js`
- `api/evaluation/generate.js`, `api/evaluation/_categoryContext.js`, `api/evaluation/_difyWorkflow.js`
- `src/api/evaluationApi.js`
- `scripts/seed-test-data.js`

**Test totals:** 98 tests across 8 files (up from 85; 13 chunking tests added)

### Infrastructure completed

- pgvector enabled in Supabase Dashboard
- Supabase CLI linked (`npx supabase link --project-ref jzenlaqfxnqfpcqsdwwt`)
- Migration pushed (`001_initial_schema.sql` + `002_repair_vector_and_policies.sql`) — all 12 tables, RLS, indexes, pgvector, search function live
- Test data seeded with fake embeddings (17 chunks: 4 onboarding + 3 deep-dive + 10 summary)
- OpenAI API key set (quota-limited; real embeddings deferred)

### v3.1 — Evaluation UX Polish (Mar 2026)

**Changes:**
- `evaluationData` starts as `null`, `actionItems` starts as `[]` — no more misleading mock data on load
- Evaluation page shows placeholder: "Complete onboarding to begin" or "Ready to evaluate" depending on onboarding state
- "Use Sample Data" button loads `MOCK_ONBOARDING_SUMMARY` for testing without completing onboarding
- Client-side mock mode in `evaluationApi.js`: `VITE_DIFY_MOCK=true` runs evaluation entirely client-side; 404 fallback auto-mocks in dev without Vercel
- Server-side mock mode in `generate.js`: when `DIFY_EVALUATION_API_KEY` is not set, returns simulated evaluation from onboarding summary
- OpenAI quota fallback: if KB retrieval fails, falls back to onboarding-only context with yellow warning banner
- `evaluationWarning` state + yellow banner for non-fatal issues (KB unavailable, mock mode)
- Optional chaining on all `evaluationData.*` references to handle partial streaming state
- `dify-evaluation-workflow.md` created — full setup guide for the Dify evaluation workflow

**Test totals:** 98 tests across 8 files (unchanged)

## v3.2 — Dify Evaluation Workflow Build & Debug (Mar 2026)

Built and debugged the Dify evaluation workflow end-to-end in Dify Studio.

### Dify Workflow Architecture

The implemented workflow uses an Iteration node for context retrieval, not 10 independent HTTP nodes:

- **Code 1 (`define_categories`)**: Python node that hardcodes all 10 evaluation categories — each with 20 evidence items and their semantic search queries. No inputs, outputs `categories Array[Object]`.
- **Iteration (`context_retrieval`)**: Parallel loop (max 10) over the categories array. Inner chain per iteration:
  - **Code 2 (`build_query`)**: Bound to `Iteration / item Object`. Extracts `category_id`, `category_title`, `combined_query` (all item queries joined), and `items_checklist` (numbered list of item names).
  - **HTTP Request**: `POST /api/knowledge/context?secret=<DIFY_WEBHOOK_SECRET>` with body `{user_id, category_id, query, top_k: 10, threshold: 0.3}`. Returns `{"context": "..."}`.
  - **Code 3 (`format_context`)**: Parses HTTP response JSON, formats into eval prompt structure, prepends `CATEGORY_ID: {id}\n` prefix. Outputs single `eval_context` String.
- **Code 4 (`route_to_llms`)**: Receives `iteration_output Array[String]`, parses `CATEGORY_ID:` prefix from each, builds `result["context_" + cat_id]` dynamically. Outputs 10 `context_*` String variables.
- **10 parallel LLM nodes** (`eval_<category_id>`): Each receives its `context_*` variable and evaluates against the scorecard.

### Debugging Lessons

Five bugs caught during construction — all documented in `dify-evaluation-workflow.md`:

1. **Code 2 input bound to full array** instead of `Iteration / item` → function received a list instead of a single dict.
2. **Code 3 variable name mismatch** → renamed input to `http_body` in UI but function still used `context` → `NameError`.
3. **Code 3 missing JSON parse** → HTTP body is a raw JSON string, not a dict. Must use `json.loads(http_body).get("context", "")`.
4. **Code 3 wrong return key** → returned `{"eval_context": ...}` but declared output was `result` → "Output result is missing" error.
5. **Code 3 missing CATEGORY_ID prefix** → Code 4 looks for `CATEGORY_ID:` prefix to route contexts. Without it, `result` stays `{}` and all 10 output variables remain empty.

### Search Query Philosophy (Key Change)

All 200 semantic search queries were rewritten. Original queries used evaluation jargon that founders never write ("cap table clean maintained accurate"). Revised queries match how founders actually describe evidence ("founders own percent investors own option pool outstanding shares breakdown").

**Rule**: Write queries in the language a founder uses when they *have* this evidence — specific numbers, tool names, concrete outcomes, natural speech. Not the language an investor uses when *looking* for it.

### Files Updated

- `dify-evaluation-workflow.md` — workflow architecture, all 200 queries, query philosophy note
- Dify Studio — Code 1 node with all 10 categories + revised queries

### Current State

- Workflow running in Dify Studio (Code 1 → Iteration → HTTP → Code 4 → LLM nodes)
- Auth and HTTP retrieval confirmed working (200 responses)
- Empty context in Dify Studio testing is expected (`sys.user_id` ≠ Supabase UUID)
- LLM nodes next to verify: confirm JSON output schema matches frontend expectations

## v3.3 — Evaluation Pipeline Wiring & Output Validation (Mar 2026)

Validated the full pipeline from Dify Studio → LLM output → frontend, fixed category ID mismatch, preserved rich LLM output, and re-seeded with real embeddings.

### Changes

**Dify Studio — `user_id` input variable:**
- Added `user_id` as a START node input variable in the Dify evaluation workflow
- HTTP Request body now references `user_id` workflow input instead of `sys.user_id`
- `sys.user_id` in Dify Studio is Dify's own user ID, not a Supabase UUID — this fix allows Studio testing with real Supabase data by entering a UUID in the Run panel
- Test UUID: `0d71eb07-6e99-4109-ae02-b9e1f657c911` (peter@nusufi.com)

**`api/evaluation/generate.js`:**
- Added `user_id: userId` to the `inputs` object passed to Dify, so the workflow input variable is populated in production

**`api/evaluation/_difyWorkflow.js`:**
- Added `VALID_CATEGORY_IDS` set — explicit source of truth for category ID ↔ Dify node name contract
- `extractCategoryFromNodeTitle()` now validates against the set; unknown node titles are silently ignored (not errors)
- `node_finished` handler: prefers `outputs.structured_output` → `outputs.text` → `outputs.result`
- Always overrides `categoryData.category_id` with the node-title-derived value — the LLM output was including the `eval_` prefix (`"eval_business_model"`) which broke `EVALUATION_DIMENSIONS` lookup

**`src/App.jsx` — `onCategoryComplete` callback:**
- `dim` object now preserves all LLM output fields: `status`, `highlights`, `gaps`, `keyMetrics`, `deepDivePrompt`
- Previously only `category_id`, `completeness`, `summary` were kept; all other fields were silently dropped
- `keyMetrics` contains `perItemAssessment` (per-item PROVEN/PARTIAL/UNPROVEN scores) for future UI use

**Naming convention (documented):**

| Layer | Convention | Example |
|-------|-----------|---------|
| App-level IDs, evaluationApi.js | bare | `business_model` |
| Dify node titles | `eval_` prefix | `eval_business_model` |
| Dify context inputs to workflow | `context_` prefix | `context_business_model` |
| Code 3 CATEGORY_ID: labels | bare | `business_model` |

**Test data:**
- Re-seeded with real OpenAI embeddings (`node scripts/seed-test-data.js --real`)
- 17 chunks: 4 onboarding + 3 deep-dive + 10 summary for peter@nusufi.com

**`api/evaluation/_difyWorkflow.test.js` — new file:**
- 17 tests covering: category ID extraction, VALID_CATEGORY_IDS validation, category_id override, structured_output preference, rich field passthrough, error handling

**Test totals:** 117 tests across 9 files (up from 98 across 8 files)

### LLM Output Schema (confirmed working)

```json
{
  "category_id": "eval_business_model",
  "category_title": "Business Model & Economics",
  "summary": "...",
  "completeness": 60,
  "status": "partial",
  "highlights": ["..."],
  "gaps": ["..."],
  "keyMetrics": {
    "mrr": 45000,
    "perItemAssessment": { "1_BusinessModelDescribed": "PROVEN", ... },
    "provenCount": 7, "partialCount": 3, "unprovenCount": 10
  },
  "deepDivePrompt": "..."
}
```

---

### Next steps (from v3.1)

1. Create Dify evaluation Workflow in Dify Studio (see `dify-evaluation-workflow.md`)
2. Set `DIFY_EVALUATION_API_KEY` in `.env` and Vercel
3. Set remaining Vercel env vars: `DIFY_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `ACTIVE_KNOWLEDGE_BASE`
4. Re-seed with real embeddings: `node scripts/seed-test-data.js --real` (after OpenAI quota is available)

### Decisions deferred

- **Real embedding test** — OpenAI API key has quota limit; re-run seed with `--real` when billing is sorted
- **External KB adapter** — config-driven but only internal Supabase adapter implemented
- **File text extraction pipeline** — `extracted_text_path` column exists but no extraction logic yet
- **Conversation persistence from client** — tables exist but client doesn't write to them yet (Phase 2)
- **Additional serverless tests** — webhook auth, KB search, category context tests planned but not yet written
