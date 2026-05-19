# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT: Before starting any large project action, read `projectmemory.md` for context on past decisions and the app's evolution.**

**IMPORTANT: Before building, modifying, or wiring up any Dify workflow — including node design, variable bindings, output type declarations, or SSE event handling — read `DifyTactics.md` first.**

## Build & Development Commands

The project supports both `npm` and `bun` — `bun.lock` and `package-lock.json` are both present during the migration. Prefer `bun` for installs and script runs (much faster); npm still works as a fallback.

- `bun run dev` (or `npm run dev`) — Start Vite dev server (http://localhost:5173)
- `bun run build` — Production build
- `bun run preview` — Preview production build locally
- `bun run test` — Run tests in watch mode (Vitest)
- `bun run test:run` — Run tests once (CI mode)
- `bun run lint` — Run ESLint
- `bun run lint:fix` — Run ESLint with auto-fix
- `bun run format` — Run Prettier on all source files

## Cross-OS Dev Environment

This project follows the shared-drive Bun convention. The full playbook lives in `S:\CLAUDE.md` (loaded automatically by Claude Code as a parent CLAUDE.md). After every OS boot, run the relink helper from this directory:

- Windows: `S:\scripts\bun-relink.ps1`
- Linux:   `bash <linux-mount>/scripts/bun-relink.sh`

Project-specific state (Windows, set up 2026-05-19):
- Junction: `S:\Nusu Git LOCAL\Fundy-MVP\node_modules` → `C:\bun-modules\Fundy-MVP\node_modules`
- Old npm tree archived at `S:\backups\Fundy-MVP-npm-node_modules\` (safe to delete)
- `bun run test:run` → 203/203 in ~3s

## Project Structure

```
src/
  main.jsx                  # Entry point, imports global CSS
  App.jsx                   # Main orchestrator — state, handlers, render dispatch
  styles/app.css            # All CSS (extracted from inline styles)
  data/mockData.js          # Mock data constants (evaluation, investments, onboarding)
  api/
    supabaseClient.js       # Supabase client init (VITE_SUPABASE_URL + anon key)
    dataAccess.js            # Data access layer — auth + full persistence (read/write for summary, evaluation, investments, actions)
    difyApi.js               # Dify API client (blocking, streaming, mock modes)
    evaluationApi.js         # Streaming evaluation client (SSE → progressive category rendering)
  utils/
    extractSummary.js       # LLM response parser — extracts onboarding summary JSON
    colors.js               # Shared color constants and status/priority color helpers
    actionItems.js          # Pure functions for investment action item add/remove
    fileUpload.js           # File upload helpers (uploadFiles, buildUploadMessages)
  components/
    LoginScreen.jsx         # Auth gate — email + OTP via Supabase Auth
    ChatPanel.jsx           # Reusable chat UI (messages + typing indicator + input)
    RadarChart.jsx          # SVG radar/spider chart (React.memo)
    ProgressRing.jsx        # SVG circular progress indicator (React.memo)
    ErrorBoundary.jsx       # Error boundary wrapper (per-window crash isolation)

supabase/
  migrations/
    001_initial_schema.sql  # Full DB schema (12 tables + RLS + pgvector + search fn)

scripts/
  seed-test-data.js         # Seeds test conversations, summary, files, embeddings
```

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Side | Purpose |
|----------|------|---------|
| `DIFY_BASE_URL` | Server | Dify API base URL (default: `https://api.dify.ai/v1`) |
| `DIFY_ONBOARDING_API_KEY` | Server | API key for the onboarding Dify workflow |
| `DIFY_DEEPDIVE_API_KEY` | Server | API key for the deep-dive Dify workflow |
| `VITE_DIFY_MOCK` | Client | Set `true` to use mock responses instead of real API |
| `VITE_DIFY_STREAMING` | Client | Set `true` to use SSE streaming mode |
| `VITE_SUPABASE_URL` | Client | Supabase project URL (safe to expose, RLS enforced) |
| `VITE_SUPABASE_ANON_KEY` | Client | Supabase publishable anon key |
| `SUPABASE_URL` | Server | Supabase project URL (for serverless functions) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase service role key (NEVER expose to client) |
| `DIFY_EVALUATION_API_KEY` | Server | API key for the evaluation Dify Workflow |
| `DIFY_WEBHOOK_SECRET` | Server + Dify | Shared secret for Dify → Vercel webhook auth |
| `OPENAI_API_KEY` | Server | Embedding generation (text-embedding-3-small) |
| `ACTIVE_KNOWLEDGE_BASE` | Server | KB selection — `internal` (Supabase pgvector) or partner ID |

Server-side vars are used by Vercel serverless functions and the Vite dev proxy. `VITE_`-prefixed vars are bundled into the client build.

## Architecture

**Target Architecture**: See `Architecture.md` for the planned multi-tenancy, persistence, and auth architecture (Supabase unified stack). Consult that document when planning any work related to authentication, data persistence, file storage, vector search, or Dify integration updates. Summary, evaluation, investments, and action items are now persisted to Supabase and restored on login. Conversation message persistence is deferred (Phase D).

**Data Structure & Workflow Contracts**: See `datastructure.md` for the exact input/output contracts for all Dify workflows (onboarding, deep-dive, evaluation generation, investment matching), the data that flows between them, client-side validation rules, and database schema alignment. Consult that document when building or modifying Dify workflows, parsers, or persistence logic.

React 18 single-page app built with Vite. No routing library, no state management library.

**`App.jsx`** is the orchestrator — it owns all app state (~18 `useState` hooks) and passes it down to extracted components. The three main views (Onboarding, Evaluation, Investments) are render functions inside App.jsx because they share state (e.g., `actionItems` is used by both Evaluation and Investment windows).

**Onboarding** has four phases dispatched by `onboardingPhase` state:
- `'chat'` → `renderOnboardingChat()` — conversational AI onboarding via ChatPanel
- `'chat-readonly'` → `renderOnboardingChatReadonly()` — read-only history of completed onboarding conversation (navigated to from summary via "← View conversation")
- `'summary'` → `renderOnboardingSummary()` — category cards with progress rings
- `'deep-dive'` → `renderDeepDive()` — per-category follow-up chat with separate conversation state per category

**Dify API** (`src/api/difyApi.js`) supports three modes controlled by env vars:
- `VITE_DIFY_MOCK=true` → mock responses with simulated delays (triggers summary on "summary"/"finish" keywords)
- `VITE_DIFY_STREAMING=true` → SSE streaming mode with `parseSSELine()` buffer management
- Default → blocking mode via `/api/chat` proxy

**Authentication** uses Supabase Auth with email + OTP (8-digit codes). `LoginScreen` handles the two-step flow (email entry → OTP verification). `App.jsx` listens for auth state changes via `onAuthStateChange` and stores the session. All API calls include the JWT in the `Authorization` header. Serverless functions validate JWTs via `api/_auth.js` using Supabase JWKS.

### Serverless Functions (Vercel)

Production API routing lives in `/api`. These are Vercel serverless functions, not bundled into the client.

```
api/
  _shared.js              # resolveApiKey(workflow) + getDifyBaseUrl() — shared by all endpoints
  _auth.js                # JWT validation middleware (Supabase JWKS via jose)
  _supabase.js            # Supabase admin client (service_role key, cached)
  _webhookAuth.js         # Webhook secret validation (Dify → Vercel auth)
  _chunking.js            # Text chunking utilities (conversations, summaries, files)
  chat.js                 # POST /api/chat → Dify /chat-messages (blocking + streaming)
  upload.js               # POST /api/upload → Dify /files/upload (bodyParser disabled for multipart)
  chat/stop.js            # POST /api/chat/stop → Dify /chat-messages/{task_id}/stop
  knowledge/
    _knowledgeBase.js     # KB abstraction layer (swappable internal/external pgvector)
    _embeddings.js        # OpenAI embedding client (text-embedding-3-small)
    _search.js            # Vector search endpoint (unused, `_`-prefixed to save Vercel function slot)
    embed.js              # POST /api/knowledge/embed — embedding ingestion endpoint
    context.js            # GET/POST /api/knowledge/context — per-category context for Dify
  summary.js              # POST /api/summary — upsert onboarding summary + embed into pgvector
  account/
    delete.js             # POST /api/account/delete — reset all user data (preserves auth account)
  action-items/
    embed.js              # POST /api/action-items/embed — embed action item chat exchanges into KB
    refresh.js            # POST /api/action-items/refresh — vector search + LLM analysis per action item
    _analyze.js           # LLM helper — GPT-4o-mini classification of action item status
  evaluation/
    generate.js           # POST /api/evaluation/generate — orchestrates retrieval + Dify + SSE
    save.js               # POST /api/evaluation/save — persist evaluation results to DB
    investment-match.js   # POST /api/evaluation/investment-match — investment matching endpoint
    _categoryContext.js   # Per-category context assembly (10 parallel KB searches)
    _difyWorkflow.js      # Dify Workflow API + SSE stream transformation
```

**Vercel function limit**: Hobby plan allows 12 serverless functions. Every non-`_`-prefixed `.js` file under `api/` becomes a function. Helpers and test files MUST be `_`-prefixed to avoid counting toward the limit. Current count: exactly 12.

**Workflow routing**: request body includes a `workflow` field (`'onboarding'`, `'deepdive'`, or `'evaluation'`). `resolveApiKey()` maps this to the correct `DIFY_*_API_KEY` env var, falling back to the onboarding key if the requested workflow key is missing.

### Dev vs Production API Routing

- **Production (Vercel)**: `/api/chat` hits the serverless function in `api/chat.js`, which reads the `workflow` field from the request body and routes to the correct Dify API key.
- **Development (Vite)**: `vite.config.js` proxies `/api/chat` → Dify directly, but always uses the onboarding key (the proxy can't easily parse the request body). Deep-dive workflow routing only works fully in production.
- **Evaluation in dev**: No Vite proxy for `/api/evaluation/generate`. The client-side `evaluationApi.js` detects the 404 and automatically falls back to client-side mock mode.

### Key Patterns

- Color constants are centralized in `src/utils/colors.js` (`COLORS.success`, `COLORS.warning`, etc.)
- `ProgressRing` component replaces all hand-rolled SVG circle progress indicators
- `ChatPanel` component is shared between onboarding chat, deep-dive chat, and the read-only conversation view. Accepts `readOnly` prop — when true, the input area is hidden
- Action item IDs use `crypto.randomUUID()` — UUIDs serve as Supabase primary keys directly
- Investment toggle properly cleans up associated action items on deselect (via `actionItems.js` utility)
- Each window is wrapped in `<ErrorBoundary name="...">` for crash isolation
- Action items use `sourceType` ('evaluation' | 'investment'), `sourceId`, and `dimensionId` metadata

### Knowledge Retrieval & Evaluation Pipeline

**Architecture**: Retrieval happens in our API, not Dify. The `/api/evaluation/generate` endpoint queries the knowledge base, assembles per-category context, and passes pre-retrieved content to Dify as input variables. This lets us swap between internal Supabase pgvector and external partner databases without changing the Dify workflow.

**Knowledge base abstraction** (`api/knowledge/_knowledgeBase.js`): Config-driven adapter pattern with a unified `semanticSearch()` interface. Default KB from `ACTIVE_KNOWLEDGE_BASE` env var.

**Evaluation flow**: Frontend → `/api/evaluation/generate` (JWT auth) → 10 parallel KB searches → context assembly → Dify Workflow API (streaming) → SSE events → frontend progressive rendering. See `dify-evaluation-workflow.md` for the Dify workflow setup guide.

**Maturity inference** (Step 1b in the prompt): After initial scoring, UNPROVEN items at lower maturity gates are auto-promoted when higher-gate items are PROVEN. Tiered: 2+ gates apart → PROVEN, 1 gate apart → PARTIAL. Inferred items are excluded from gap recommendations. This prevents penalizing companies for not explicitly mentioning foundational capabilities they've clearly surpassed.

**Evaluation state**: `evaluationData` and `actionItems` start as `null`/`[]`. The evaluation page shows a placeholder until the user runs "Generate Evaluation". A "Use Sample Data" button loads `MOCK_ONBOARDING_SUMMARY` for testing without completing onboarding.

**Evaluation mock mode**: Three fallback layers:
1. `VITE_DIFY_MOCK=true` → client-side mock (never hits server)
2. `/api/evaluation/generate` returns 404 in dev → client auto-falls back to mock
3. Server has no `DIFY_EVALUATION_API_KEY` → server-side mock from onboarding data
4. OpenAI quota exceeded → falls back to onboarding-only context (no KB search)

**Dify node naming**: `eval_product_technology`, `eval_market_traction`, etc. — parsed from `node_finished` events to map to category IDs.

**Chunking** (`api/_chunking.js`): Conversations chunked as message-pair windows with overlap; summaries chunked as one chunk per category; files chunked as ~2000 char windows with 400 char overlap.

**Database**: 12 tables in `supabase/migrations/001_initial_schema.sql`. Includes pgvector `document_embeddings` table with HNSW index and `search_embeddings()` Postgres function.

**Webhook auth** (`api/_webhookAuth.js`): Separate from JWT auth — for future Dify → Vercel callbacks. Validates `DIFY_WEBHOOK_SECRET` with timing-safe comparison.

### Action Item Refresh

**Architecture**: User-triggered "Refresh Status" button searches the vector DB for evidence relevant to each action item, then runs a lightweight LLM classification (GPT-4o-mini, direct OpenAI call — not Dify) to assess whether each item has been addressed.

**Flow**: Frontend → `POST /api/action-items/refresh` (JWT auth) → batch embed all queries (single OpenAI call) → parallel semantic search per item (topK=5, threshold=0.5) → parallel LLM analysis (max 10 concurrent) → persist to `action_items.custom_data` JSONB → return results.

**Analysis results** stored in `custom_data.refresh`: `{ status, confidence, summary, evidence_count, refreshed_at }`. Status is one of: `addressed`, `partially_addressed`, `not_addressed`, `insufficient_evidence`.

**Action item chat embedding**: Each chat exchange in an action item's ChatPanel is fire-and-forget embedded via `POST /api/action-items/embed` (uses `source_type: 'conversation'` with `actionItemId` in metadata). These embeddings are then discoverable by the refresh search.

**Mock mode**: Same three-layer fallback as evaluation — `VITE_DIFY_MOCK=true` → client mock, 404 in dev → client mock, no `OPENAI_API_KEY` → server mock.

**Client state**: Action items carry `customData` (mapped from DB `custom_data` in `mapDbActionToState`). Refresh results are merged via `setActionItems` after the API call returns. Badges display on action cards with status-specific colors (green/orange/red/gray).

### Message Structure

All chat messages follow `{ role: 'user'|'assistant', content: string }` with optional flags:
- `isFile`, `isError`, `isStreaming`, `isMock` — used by `renderMessageContent()` to customize display
- Streaming messages use a dual-update pattern: `setMessages` with `isStreaming: true` during stream, replaced by final message on completion

### Styling

- Static CSS file at `src/styles/app.css` (imported in `main.jsx`)
- Fonts loaded via `<link>` tags in `index.html` with `preconnect` hints
- Dark theme with indigo/purple accent gradients. Glassmorphism effects.
- Fonts: 'Plus Jakarta Sans' (headings), 'DM Sans' (body)

## Testing

Vitest + React Testing Library + jsdom. Test setup in `src/test/setup.js`.

Test files live alongside their source files (`*.test.js` / `*.test.jsx`).

Current test coverage (198 tests, 14 files):
- `extractSummary.test.js` — 26 tests: JSON parsing, validation, normalization, edge cases, SSE parser
- `colors.test.js` — 23 tests: all color helper functions including maturity/performance helpers
- `difyApi.test.js` — 7 tests: mock response structure, summary triggers, file upload
- `LoginScreen.test.jsx` — 8 tests: email + OTP flow, error handling, back navigation
- `InvestmentToggle.test.jsx` — 6 tests: select/deselect, action cleanup, multi-investment, metadata
- `actionItems.test.js` — 12 tests: add/remove investment actions, metadata, immutability, edge cases
- `fileUpload.test.js` — 10 tests: upload, failure, mixed results, message building
- `_chunking.test.js` — 13 tests: conversation/summary/file chunking, overlap, edge cases
- `_difyWorkflow.test.js` — 25 tests: SSE parsing, node mapping, category extraction, error events, case-insensitive matching
- `dataAccess.test.js` — 25 tests: createConversation, updateDifyId, saveMessages, loadMessages, loadOnboarding, loadDeepDive, saveActionItem customData, loadActionItems
- `_analyze.test.js` — 18 tests: LLM response parsing, confidence clamping, status validation, markdown fence stripping, no-evidence shortcut
- `refresh.test.js` — 8 tests: auth, empty items, full pipeline, partial failures, mock mode, ID filtering
- `actionItemRefreshApi.test.js` — 5 tests: mock mode, 404 fallback, auth headers, network errors
- `evaluationApi.test.js` — 12 tests: evaluation client mock and real mode

Run a single test file: `npx vitest run src/utils/colors.test.js`

## Linting & Formatting

- ESLint 9 flat config (`eslint.config.js`) with React, React Hooks, and Prettier plugins
- `no-unused-vars` ignores `_`-prefixed variables (convention for intentionally unused params/catches)
- Prettier config in `.prettierrc`: single quotes, trailing commas, 120 char width

## Deployment

Deployed to Vercel with custom domain `fundy.nusuai.com`. Vercel auto-detects the Vite build and the `/api` serverless functions. Env vars must be set in Vercel project settings. See README.md for setup details.

## Code Review & Change Protocol

Review this plan thoroughly before making any code changes. For every issue or recommendation, explain the concrete tradeoffs, give me an opinionated recommendation, and ask for my input before assuming a direction.

### Engineering Preferences

Use these to guide all recommendations:

- **DRY is important** — flag repetition aggressively.
- **Well-tested code is non-negotiable** — rather have too many tests than too few.
- **"Engineered enough"** — not under-engineered (fragile, hacky) and not over-engineered (premature abstraction, unnecessary complexity).
- **Handle more edge cases, not fewer** — thoughtfulness > speed.
- **Bias toward explicit over clever.**

### Review Sections

#### 1. Architecture Review
Evaluate:
- Overall system design and component boundaries.
- Dependency graph and coupling concerns.
- Data flow patterns and potential bottlenecks.
- Scaling characteristics and single points of failure.
- Security architecture (auth, data access, API boundaries).

#### 2. Code Quality Review
Evaluate:
- Code organization and module structure.
- DRY violations — be aggressive here.
- Error handling patterns and missing edge cases (call these out explicitly).
- Technical debt hotspots.
- Areas that are over-engineered or under-engineered relative to my preferences.

#### 3. Test Review
Evaluate:
- Test coverage gaps (unit, integration, e2e).
- Test quality and assertion strength.
- Missing edge case coverage — be thorough.
- Untested failure modes and error paths.

#### 4. Performance Review
Evaluate:
- N+1 queries and database access patterns.
- Memory/CPU usage concerns.
- Caching opportunities.
- Slow or high-complexity code paths.

### Issue Format

For each issue found:
- Describe the problem concretely, with file and line references.
- Present 2–3 options, including "do nothing" where that's reasonable.
- For each option, specify: implementation effort, risk, impact on other code, and maintenance burden.
- Give your recommended option and why, mapped to my preferences above.
- Then explicitly ask whether I agree or want to choose a different direction before proceeding.

### Workflow

- Do not assume my priorities on timeline or scale.
- After each section, pause and ask for my feedback before moving on.

**BEFORE YOU START:** Ask if I want one of two options:
1. **BIG CHANGE:** Work through this interactively, one section at a time (Architecture → Code Quality → Tests → Performance) with at most 4 top issues in each section.
2. **SMALL CHANGE:** Work through interactively ONE question per review section.

**FOR EACH STAGE OF REVIEW:** Output the explanation and pros/cons of each stage's questions AND your opinionated recommendation and why. NUMBER issues and give LETTERS for options.
