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

## v3.4 — Full Persistence Pipeline (Mar 2026)

Closes the loop: onboarding summary + evaluation results + investment state now survive page
refresh. Also embeds the summary into pgvector so KB search finds user-specific content,
making evaluation output company-specific rather than generic.

### Root cause of generic evaluation (fixed)

`buildCategoryContexts` queries `document_embeddings` by `userId`. No embeddings existed for
real users (only the seeded test user). Now: saving the summary also embeds it into
`document_embeddings` (10 chunks, one per category) so KB search immediately enriches context.

### Architecture decisions

- **Summary save = embed trigger**: `POST /api/summary` upserts to `onboarding_summaries` AND
  chunks + embeds into `document_embeddings`. One call, two effects, idempotent.
- **Client vs server writes**: RLS determines path. `onboarding_summaries` + `evaluations` are
  server-managed (SELECT only for clients → requires JWT-authenticated server endpoint).
  `action_items` + `investment_selections` have full CRUD RLS → client writes directly via
  Supabase JS.
- **Fire-and-forget persist**: `persistSummary()` and `persistEvaluation()` are called
  non-blocking after state is set. UI never waits for DB writes.
- **Auth-time restore**: On every login, load summary + evaluation + investments + action items
  in parallel from Supabase and restore React state.
- **UUID action item IDs**: `generateActionId()` counter replaced with `crypto.randomUUID()` so
  IDs can be used as Supabase primary keys directly.

### New files

- `api/summary.js` — `POST /api/summary` (JWT auth): upsert summary + chunk + embed
- `api/evaluation/save.js` — `POST /api/evaluation/save` (JWT auth): upsert evaluation
- `scripts/clear-user-data.js` — CLI tool: wipe all app data for a user by email or UUID (preserves auth account)

### Modified files

- `src/api/dataAccess.js` — added: `loadOnboardingSummary`, `loadEvaluation`,
  `loadInvestmentSelections`, `loadActionItems`, `upsertInvestmentSelection`, `saveActionItem`,
  `updateActionItemStatus`, `deleteActionItemsBySourceId`
- `src/App.jsx` — added: `persistSummary()`, `persistEvaluation()`, `mapDbEvalToState()`,
  `mapDbActionToState()`, auth-restore block, investment/action persist wiring
- `src/utils/actionItems.js` — `generateActionId` → `crypto.randomUUID()`

**Test totals:** 122 tests across 9 files (unchanged from v3.3; no new test files this version)

### Verified end-to-end in production (fundy.nusuai.com)

- Onboarding completion → `[summary] chunksEmbedded: 10` confirmed in Vercel logs
- Hard refresh → summary + evaluation state restored automatically
- Investment toggle → rows appear in `investment_selections` + `action_items` (Supabase dashboard)
- Mark complete → `action_items.status = 'completed'` confirmed
- `scripts/clear-user-data.js` — successfully cleared seeded dummy data from peter@nusufi.com

## v3.5 — Conversation Message Persistence (Phase D) (Mar 2026)

Every chat exchange (onboarding + deep-dive) is now saved to Supabase and restored on login.
Also adds a read-only view of the original onboarding conversation accessible from the summary
dashboard.

### Architecture decisions

- **Client-side writes only**: `conversations` + `messages` have SELECT + INSERT RLS — no server
  endpoint needed. All writes go directly via Supabase JS.
- **Refs for conversation DB IDs**: `conversationDbIdRef` (onboarding) and `deepDiveConvDbIdsRef`
  (map of categoryId → UUID) are `useRef`, not state. Avoids stale-closure issues inside
  streaming callbacks that fire-and-forget persist calls.
- **Lazy conversation creation**: `createConversation()` is only called when the first exchange
  completes — never on component mount. The ref is checked first; if populated (from auth restore
  or a prior exchange), no new row is created.
- **No duplicate rows despite NULL UNIQUE constraint**: Postgres UNIQUE on
  `(user_id, workflow, category_id)` doesn't prevent multiple NULLs (NULL ≠ NULL). Prevented
  by populating `conversationDbIdRef` from DB on auth restore so the lazy-create path is never
  reached twice for onboarding.
- **Messages always loaded on restore**: Onboarding message history is always fetched on auth
  restore (not just when no summary exists), so the read-only conversation view is immediately
  available without an additional DB call.
- **processCompletedResponse returns finalContent**: Refactored to return the assistant's final
  message string, enabling the blocking (non-streaming) path to persist exchanges without
  duplicating the message extraction logic.

### Read-only conversation view

- New `'chat-readonly'` phase — navigated to from summary via "← View conversation" button
  (replaces the old "← Back to conversation" which returned to the live editable chat)
- Uses `ChatPanel` with new `readOnly={true}` prop — hides the input area entirely
- Appends a closing note at the end of the message list directing users to category deep dives
- "← Back to summary" button returns to the summary dashboard
- ChatPanel `readOnly` prop: when true, the `chat-input-area` div is not rendered

### New functions (dataAccess.js)

- `createConversation(workflow, categoryId)` — INSERT conversation row, returns UUID
- `updateConversationDifyId(conversationDbId, difyConversationId)` — UPDATE dify_conversation_id
- `saveMessages(conversationDbId, userId, pairs)` — bulk INSERT message pairs
- `loadMessages(conversationDbId)` — SELECT messages ordered by created_at, returns [{role, content}]
- `loadOnboardingConversation()` — SELECT onboarding conversation row (maybeSingle)
- `loadDeepDiveConversations()` — SELECT all deepdive conversations + their messages; returns map

### New App.jsx additions

- `conversationDbIdRef` / `deepDiveConvDbIdsRef` — useRef hooks for DB UUIDs
- `persistConversationExchange(workflow, categoryId, userMsg, assistantMsg, difyConvId)` — creates
  conversation row on first call, updates Dify ID, inserts message pair. Fire-and-forget.
- Wired into: onboarding streaming path, onboarding blocking path, deep-dive streaming path,
  deep-dive blocking path
- `restoreUserData` extended: loads conversation IDs into refs, loads onboarding messages into
  state, loads deep-dive conversations (with messages) into `categoryConversations` state
- `renderOnboardingChatReadonly()` — Phase 1b render function, read-only view with closing note
- `scripts/clear-user-data.js` — deletes messages + conversations in addition to prior tables

### Modified files

- `src/api/dataAccess.js` — 6 new functions
- `src/api/dataAccess.test.js` — NEW, 18 tests (vi.hoisted pattern for mock hoisting fix)
- `src/components/ChatPanel.jsx` — `readOnly` prop added
- `src/App.jsx` — refs, persistConversationExchange, restoreUserData extension, readonly phase

**Test totals:** 140 tests across 10 files (up from 122)

### Verified end-to-end

- Onboarding exchanges saved to `messages` table; conversation row in `conversations`
- Deep-dive exchanges saved per-category; restored on login with full message history
- "← View conversation" shows read-only onboarding history with closing note
- Mid-onboarding refresh: previous messages restored to chat state

---

## v3.6 — Deep-Dive Chatflow, File Embedding, Evaluation Action Item Merge (Mar 2026)

### What changed

**Deep-dive dedicated Dify chatflow**
- `DIFY_DEEPDIVE_API_KEY` now routes deep-dive conversations to a separate Dify chatflow
  (distinct from onboarding). Previously fell back to the onboarding key.
- Removed `[onboarding]` fallback badge from messages and CSS (dead code).

**File upload improvements**
- `src/utils/fileUpload.js`: added `DIFY_MAX_FILES=10` and `DIFY_MAX_FILE_SIZE_MB=15` constants.
  `uploadFiles()` pre-validates file size before upload; returns `oversized: [{name, sizeMB}]`.
- Both `handleFileUpload` and `handleDeepDiveFileUpload` in App.jsx validate file count and size
  with specific user-facing error messages.
- `buildUploadMessages` success note updated to include limits.

**File text embedding (streaming path)**
- `api/chat.js` now parses SSE events server-side while forwarding the stream to the client.
- A Code node titled `"File Text Relay"` in the Dify chatflow emits a `node_finished` event
  with `outputs.file_text` = the concatenated File Extractor output (joined from list to string).
- Server captures this text + the `message_id` from `message_end`, then after stream close:
  chunks with `chunkFileText()`, embeds with OpenAI `text-embedding-3-small`, upserts to
  `document_embeddings` with `source_type='file'`, `source_id=message_id`.
- Non-fatal: stream always closes normally even if embedding fails.
- **Requires streaming mode**: only works when `response_mode=streaming`. Ensure
  `VITE_DIFY_STREAMING=true` is set in Vercel env vars and redeployed so client uses streaming.
  A `console.warn` fires if files are sent in blocking mode (so this is detectable in logs).

**Evaluation action item merge**
- `api/evaluation/save.js`: accepts optional `actionItems` array. Fetches existing `action_key`s
  for the user, inserts only items whose `actionKey` is not already present. Preserves user edits
  on re-evaluation. Returns `actionItemsAdded` count.
- `src/App.jsx` `persistEvaluation`: passes evaluation-sourced action items from state.
  Currently a no-op (Dify evaluation workflow doesn't emit action items yet); merge logic is
  ready for when it does.

### Dify chatflow setup notes

- `File Text Relay` Code node: input variable type must be `Array[String]` (not plain String).
  Output: `"\n\n---\n\n".join(str(t) for t in file_text)` — joins File Extractor list to string.
- File Extractor node output key is `text` (a list, one entry per uploaded file).
- Deep-dive chatflow must have streaming enabled in Dify Studio (Response mode: Streaming)
  for `node_finished` events to appear in the SSE stream.
- Workflow-based chatflows emit `workflow_finished` (not `message_end`) — `message_id` is at
  the top level. Both event types are handled in `api/chat.js`.
- Deep-dive always streams (not gated on `VITE_DIFY_STREAMING`); only `VITE_DIFY_MOCK=true`
  triggers the blocking fallback path.

### Verified end-to-end (v3.6)

File upload in deep-dive → 28 file chunks embedded into `document_embeddings` with
`source_type='file'`, `source_id=<message_id>`. Evaluation KB retrieval will now find file content.

---

## v3.7 — Investment Matching Integration (Mar 2026)

Replaces static `MOCK_INVESTMENT_DATA` with a live LLM-driven investment matching pipeline.
Phase 2 of the Dify evaluation workflow (4 new nodes) calculates maturity, scores the investment
matrix, and generates a personalized recommendation report streamed to the frontend.

### Architecture decisions

- **Phase 2 extends the existing evaluation workflow** — no separate Dify app. After the 10 `eval_*`
  LLM nodes complete, a Variable Aggregator feeds their outputs into: `calculate_maturity` (Python
  code node) → `generate_matrix` (Python code node) → `investment_recommendations` (LLM node).
- **SSE event ordering**: `investment_matching_started` fires when `calculate_maturity` starts,
  then `maturity_calculated` fires when it finishes. `investment_recommendations_complete` fires
  when the LLM node completes. All 3 are emitted before `workflow_complete`.
- **Stale closure pattern**: `capturedInvestmentRecommendations` local variable in
  `handleGenerateEvaluation` captures investment data synchronously in the callback, so
  `persistEvaluation` can safely pass it to `/api/evaluation/save` after `workflow_complete` fires.
- **Investment actions from evaluation, not toggle**: `toggleInvestment` now only tracks selection
  intent (`upsertInvestmentSelection`). Action items come from `next_steps[]` in the LLM output,
  auto-added in `onInvestmentRecommendationsComplete`. Static `INVESTMENT_ACTIONS` is gone.
- **`investment_data` column in `evaluations`**: full LLM output (`investment_readiness_summary`,
  `recommended_funding[]`, etc.) persisted as JSONB. Restored on login like evaluation results.
- **Investment ID migration**: Old IDs (`grants`, `strategic`, `crowdfunding`) replaced by
  `grant_funding`, `pre_seed`, `revenue_based_financing`. Old `investment_selections` rows are
  orphaned (accepted MVP break).

### New investment data shape (LLM output)

```json
{
  "investment_readiness_summary": { "assessment": "...", "primary_recommendation": "...", "readiness_score": "Moderate" },
  "recommended_funding": [{ "investment_type": "pre_seed", "rating": "strong_fit", "fit_explanation": "..." }],
  "conditional_options": [{ "investment_type": "seed", "conditions_for_fit": "...", "improvements_needed": [] }],
  "improvement_roadmap": [{ "priority": 1, "category": "market_traction", "current_score": 45, "target_score": 70, "unlocks": ["seed"], "specific_actions": [], "timeline": "..." }],
  "not_recommended": [{ "investment_type": "series_a", "reason": "..." }],
  "next_steps": [{ "priority": 1, "action": "...", "timeline": "2 weeks", "expected_outcome": "..." }]
}
```

### Rating → suitability mapping (frontend rendering)

`ideal`→95, `strong_fit`→80, `acceptable`→65, `conditional`→50, `marginal`→40, `not_suitable`→15

### Modified files

| File | Change |
|------|--------|
| `api/evaluation/_difyWorkflow.js` | 3 new event types in `transformDifyEvent()` |
| `api/evaluation/save.js` | Accept + persist `investmentRecommendations` as `investment_data` |
| `api/evaluation/generate.js` | Mock Phase 2: `MOCK_INVESTMENT_RECOMMENDATIONS` constant + 3 mock events in `streamMockEvaluation()` |
| `src/api/evaluationApi.js` | 3 new callbacks + mock Phase 2 events using `MOCK_INVESTMENT_DATA` |
| `src/api/dataAccess.js` | `loadEvaluation()` SELECT now includes `investment_data` |
| `src/data/mockData.js` | `MOCK_INVESTMENT_DATA` replaced with new LLM output shape; `INVESTMENT_ACTIONS` removed |
| `src/App.jsx` | `investmentData` starts `null`; `setInvestmentData` wired; new callbacks; `persistEvaluation` passes `investmentRecommendations`; `toggleInvestment` simplified; `renderInvestmentWindow()` rewritten |
| `src/styles/app.css` | New CSS classes for readiness block, roadmap, conditional cards, not-recommended |
| `api/evaluation/_difyWorkflow.test.js` | 4 new investment matching event tests (21 total) |
| `src/api/dataAccess.test.js` | 3 new `loadEvaluation` tests (21 total) |
| `src/api/evaluationApi.test.js` | NEW — 10 tests for investment callbacks in mock + real SSE modes |
| `src/components/InvestmentToggle.test.jsx` | Rewritten for new toggle-only behavior (8 tests) |

**Test totals:** 159 tests across 11 files (up from 140 across 10 files)

### Pending (manual steps)

1. **Supabase migration**: `ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS investment_data jsonb;`
2. **Dify Studio**: Add 4 nodes after the 10 `eval_*` nodes:
   - **Variable Aggregator** (`aggregator`) — collects all 10 `eval_*` node outputs
   - **Code Node** (`calculate_maturity`) — Python: weighted maturity score 1–1000, stage, performance level
   - **Code Node** (`generate_matrix`) — Python: score each investment type against the matrix
   - **LLM Node** (`investment_recommendations`) — structured output matching the shape above

## v3.8 — Evaluation Prompt Redesign & Gap Consolidation (Mar 2026)

Redesigned the LLM evaluation prompts and gap output to produce focused, stage-aware action items
instead of unbounded gap lists (previously 300+ action items per evaluation).

### Architecture decisions

- **Per-category env vars**: Replaced single `EVALUATION_FRAMEWORK` env var with 10 separate
  `eval_<category_id>` env vars in Dify. Each contains only its category's 20-item scorecard
  and maturity stage interpretation.
- **Structured scoring methodology**: New 6-step prompt (score items → calculate completeness →
  derive status → determine maturity stage → identify stage-aware gaps → build output). Explicit
  formula: PROVEN=1, PARTIAL=0.5, UNPROVEN=0, completeness = (total / 20) × 100.
- **Stage-aware gap scoping**: Gaps only include UNPROVEN/PARTIAL items at the company's current
  maturity gate (table_stakes) and the next gate up (stretch). Items 2+ levels above are excluded.
  Maximum 5 gaps per category, consolidated. This reframes gaps from "everything you're missing"
  to "how to demonstrate exceptional progress at your current stage."
- **Gap object format**: `gaps` changed from `string[]` to `{ action, type, evidence_items }[]`.
  `type` is `"table_stakes"` or `"stretch"`. `evidence_items` traces back to scorecard item numbers.
  Priority derived from type: table_stakes → high, stretch → medium.
- **IF/ELSE context fallback deferred**: Skipped Step 4 (Dify-side context fetching). Context is
  always provided by our API. Fallback only needed if an external KB bypasses our API.
- **Backward compatible**: `App.jsx` gap→action conversion handles both old string gaps and new
  object gaps via `typeof gap === 'string'` check.

### Modified files

| File | Change |
|------|--------|
| `dify-evaluation-workflow.md` | New prompt template, per-category env var content with BEGIN/END markers, updated output schema, deferred Step 4 |
| `src/data/mockData.js` | All 10 category gaps converted to `{ action, type, evidence_items }` objects |
| `src/App.jsx` | Gap→action item conversion handles object format; priority from `gapType`; `gapType`/`evidenceItems` fields on action items; category cards show "must-haves" vs "stretch goals"; action cards show gap type badge |
| `src/styles/app.css` | New styles: `.gaps-table-stakes`, `.gaps-stretch`, `.gap-type-badge` |
| `api/evaluation/_difyWorkflow.test.js` | Updated test data to new gap object format |

**Test totals:** 163 tests across 11 files (up from 159)

### Pending

1. **Dify Studio**: Update all 10 LLM node prompts using new template from `dify-evaluation-workflow.md`
2. **Dify Studio**: Update all 10 LLM node output variable schemas (JSON schema in workflow doc)
3. **Dify Studio**: Create 10 `eval_<category_id>` env vars from scorecard content in workflow doc
4. ~~**Onboarding question redesign**~~: DONE — see v3.9 below

## v3.9 — Onboarding Question Redesign & Adaptive Escalation (Mar 2026)

Redesigned the Dify onboarding chatflow to align question gathering directly with the 20-item evaluation scorecards per category.

### Changes
- **`dify-onboarding-prompt.md`** — Restructured as per-node configuration guide (was single system prompt). Sections for each Dify chatflow node:
  - **NEXT QUESTION LLM**: 10-question bank (was 8) mapped to evaluation categories + adaptive escalation rules (Concept → move on, Early → dig deeper to Validated, Validated → move on)
  - **RESPONSE PROCESSING LLM**: Evidence-aware follow-up logic — only requests follow-up when critical foundational info missing
  - **LLM IS REVIEWING YOUR RESPONSE**: 10-category extraction (was 9 misaligned fields: problem_audience, competitive_advantage, etc. → now product_technology, market_traction, business_model, etc.)
  - **GENERATING ONBOARDING**: Evidence-aligned completeness scoring, evidence-aware deepDivePrompt generation
  - **APPEND KEY INFO BY CATE**: Variable mapping table (old → new names)
  - **CODE CONCATENATE CATEG / CONSOLIDATED_CON**: Field reference updates
  - **IF/ELSE 2**: Threshold > 8 → > 9 (10 questions)
- **`dify-evaluation-workflow.md`** — Updated onboarding mapping section: replaced TODO with completed question mapping table showing primary questions, evidence items targeted, and context variables per category

### Pending
1. **Dify Studio**: Apply per-node prompts from `dify-onboarding-prompt.md` to chatflow (7 nodes to update)

## Next Steps (priority order)

### Immediate

1. **Dify Studio**: Apply per-node updates from `dify-onboarding-prompt.md` to the onboarding chatflow (see Update Order section in that doc)

2. **Evaluation quality verification** — with a real user account, run the full pipeline and confirm:
   - Onboarding adaptive escalation (LLM probes next gate when founder demonstrates maturity)
   - Stage-aware gaps (max 5 per category, table_stakes vs stretch)
   - Gap type badges render correctly in action items
   - Investment recommendation section renders after evaluation completes
   - `investment_data` column populated in `evaluations` table
   - Refreshing restores evaluation + investment data

### Medium term

3. **Account self-service reset/delete** — `POST /api/account/reset` (wipe data, keep auth) and
   `POST /api/account/delete` (full GDPR delete). Add UI in settings panel.
   `scripts/clear-user-data.js` is the basis for the reset endpoint logic.

4. **File text extraction pipeline** — extract text from uploaded PDFs/docs server-side, chunk +
   embed, store path in `file_metadata.extracted_text_path`. Makes uploaded files searchable
   in KB retrieval.

5. **Conversation embedding** — embed onboarding + deep-dive message chunks into
   `document_embeddings` (source_type: 'conversation') to enrich future KB retrieval. Builds
   on Phase D infrastructure. Run after each session ends or on a schedule.

### Long horizon

6. **Resend custom SMTP** — before inviting external users. Supabase built-in is 2 emails/hr.
7. **External KB adapter** — `knowledgeBase.js` has adapter pattern but only internal implemented.
8. **CAPTCHA / bot protection** — before public launch.

