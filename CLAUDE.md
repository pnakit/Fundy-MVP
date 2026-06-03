# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT: Before starting any large project action, read `projectmemory.md` for context on past decisions and the app's evolution.**

**NOTE: Dify has been fully removed (June 2026). All LLM calls use Vercel AI SDK directly. See `DifyTactics.md` for historical context only.**

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
    difyApi.js               # Chat API client (blocking, streaming, mock modes)
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
| `VITE_SUPABASE_URL` | Client | Supabase project URL (safe to expose, RLS enforced) |
| `VITE_SUPABASE_ANON_KEY` | Client | Supabase publishable anon key |
| `VITE_LLM_MOCK` | Client | Set `true` for client-side mock mode (no server needed) |
| `SUPABASE_URL` | Server | Supabase project URL (for serverless functions) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase service role key (NEVER expose to client) |
| `OPENAI_API_KEY` | Server | Embedding generation (text-embedding-3-small) |
| `ACTIVE_KNOWLEDGE_BASE` | Server | KB selection — `internal` (Supabase pgvector) or partner ID |
| `LLM_CHAT_MODEL` | Server | AI SDK model for onboarding/deep-dive chat (e.g., `openai:gpt-4o-mini`) |
| `LLM_EVAL_MODEL` | Server | AI SDK model for evaluation + investment matching |
| `LLM_ANALYSIS_MODEL` | Server | AI SDK model for action item analysis |

Server-side vars are used by Vercel serverless functions. `VITE_`-prefixed vars are bundled into the client build. `VITE_DIFY_MOCK` is still accepted as a legacy alias for `VITE_LLM_MOCK`.

## Architecture

**Target Architecture**: See `Architecture.md` for the planned multi-tenancy, persistence, and auth architecture (Supabase unified stack). Summary, evaluation, investments, and action items are now persisted to Supabase and restored on login. Conversation message persistence is deferred (Phase D).

**Data Structure & Workflow Contracts**: See `datastructure.md` for the input/output contracts for all workflows (onboarding, deep-dive, evaluation generation, investment matching), the data that flows between them, client-side validation rules, and database schema alignment.

React 18 single-page app built with Vite. No routing library, no state management library.

**`App.jsx`** is the orchestrator — it owns all app state (~18 `useState` hooks) and passes it down to extracted components. The three main views (Onboarding, Evaluation, Investments) are render functions inside App.jsx because they share state (e.g., `actionItems` is used by both Evaluation and Investment windows).

**Onboarding** has four phases dispatched by `onboardingPhase` state:
- `'chat'` → `renderOnboardingChat()` — conversational AI onboarding via ChatPanel
- `'chat-readonly'` → `renderOnboardingChatReadonly()` — read-only history of completed onboarding conversation (navigated to from summary via "← View conversation")
- `'summary'` → `renderOnboardingSummary()` — category cards with progress rings
- `'deep-dive'` → `renderDeepDive()` — per-category follow-up chat with separate conversation state per category

**Chat API** (`src/api/difyApi.js`) handles client-side chat communication. Supports mock mode (`VITE_LLM_MOCK=true`) with simulated delays, or real mode via `/api/chat` serverless endpoint with SSE streaming.

**LLM Backend:** All LLM calls use Vercel AI SDK (`streamText`, `generateObject`) via provider-agnostic abstraction in `api/_llm.js`. Prompts live in `api/_prompts/`. Requires `LLM_CHAT_MODEL` and `LLM_EVAL_MODEL` env vars.

**Authentication** uses Supabase Auth with email + OTP (8-digit codes). `LoginScreen` handles the two-step flow (email entry → OTP verification). `App.jsx` listens for auth state changes via `onAuthStateChange` and stores the session. All API calls include the JWT in the `Authorization` header. Serverless functions validate JWTs via `api/_auth.js` using Supabase JWKS.

### Serverless Functions (Vercel)

Production API routing lives in `/api`. These are Vercel serverless functions, not bundled into the client.

```
api/
  _llm.js                 # Provider-agnostic LLM abstraction (Vercel AI SDK)
  _prompts/
    onboarding.js          # Onboarding chat system prompt + message builder
    deepdive.js            # Deep-dive category-scoped system prompt
    evaluation.js          # 10-category evaluation scorecards + Zod schema
    investment.js          # Investment recommendation prompt + Zod schema
  _auth.js                # JWT validation middleware (Supabase JWKS via jose)
  _supabase.js            # Supabase admin client (service_role key, cached)
  _webhookAuth.js         # Webhook secret validation (for external → Vercel callbacks)
  _chunking.js            # Text chunking utilities (conversations, summaries, files)
  chat.js                 # POST /api/chat — onboarding, deep-dive, action item chat (AI SDK streamText)
  upload.js               # POST /api/upload — file text extraction (officeparser)
  knowledge/
    _knowledgeBase.js     # KB abstraction layer (swappable internal/external pgvector)
    _embeddings.js        # OpenAI embedding client (text-embedding-3-small)
    _search.js            # Vector search endpoint (unused, `_`-prefixed to save Vercel function slot)
    embed.js              # POST /api/knowledge/embed — embedding ingestion endpoint
    _search.js            # Vector search endpoint (unused, `_`-prefixed to save function slot)
  summary.js              # POST /api/summary — upsert onboarding summary + embed into pgvector
  account/
    delete.js             # POST /api/account/delete — reset all user data (preserves auth account)
  action-items/
    embed.js              # POST /api/action-items/embed — embed action item chat exchanges into KB
    refresh.js            # POST /api/action-items/refresh — vector search + LLM analysis per action item
    _analyze.js           # LLM helper — GPT-4o-mini classification of action item status
  evaluation/
    generate.js           # POST /api/evaluation/generate — LLM evaluation + investment matching (SSE)
    save.js               # POST /api/evaluation/save — persist evaluation results to DB
    investment-match.js   # POST /api/evaluation/investment-match — mock fallback for Phase 2
    _categoryContext.js   # Per-category context assembly (10 parallel KB searches)
    _maturity.js          # Maturity calculation + investment matrix
```

**Vercel function limit**: Hobby plan allows 12 serverless functions. Every non-`_`-prefixed `.js` file under `api/` becomes a function. Helpers and test files MUST be `_`-prefixed to avoid counting toward the limit. Current count: 10 (2 slots available).

**Workflow routing**: request body includes a `workflow` field (`'onboarding'`, `'deepdive'`, or `'action_item'`). `chat.js` dispatches to the appropriate handler.

### Dev vs Production API Routing

- **Production (Vercel)**: `/api/chat` hits the serverless function in `api/chat.js`, which routes by `workflow` field to the appropriate LLM handler.
- **Development (Vite)**: No API proxy. Set `VITE_LLM_MOCK=true` for local dev without Vercel, or use `vercel dev` to run serverless functions locally.
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

**Architecture**: `/api/evaluation/generate` embeds deep-dive conversations, then runs per-category LLM evaluations (batched in groups of 3), followed by deterministic maturity calculation and LLM-powered investment matching.

**Knowledge base abstraction** (`api/knowledge/_knowledgeBase.js`): Config-driven adapter pattern with a unified `semanticSearch()` interface. Default KB from `ACTIVE_KNOWLEDGE_BASE` env var.

**Evaluation flow**: Frontend → `/api/evaluation/generate` (JWT auth) → deep-dive embedding → 10 batched LLM evaluations (generateObject + Zod schema) → maturity calculation → investment matching → SSE events → frontend progressive rendering.

**Maturity inference** (Step 1b in the prompt): After initial scoring, UNPROVEN items at lower maturity gates are auto-promoted when higher-gate items are PROVEN. Tiered: 2+ gates apart → PROVEN, 1 gate apart → PARTIAL. Inferred items are excluded from gap recommendations. This prevents penalizing companies for not explicitly mentioning foundational capabilities they've clearly surpassed.

**Evaluation state**: `evaluationData` and `actionItems` start as `null`/`[]`. The evaluation page shows a placeholder until the user runs "Generate Evaluation". A "Use Sample Data" button loads `MOCK_ONBOARDING_SUMMARY` for testing without completing onboarding.

**Evaluation mock mode**: Three fallback layers:
1. `VITE_LLM_MOCK=true` → client-side mock (never hits server)
2. `/api/evaluation/generate` returns 404 in dev → client auto-falls back to mock
3. Server has no `LLM_EVAL_MODEL` → server-side mock from onboarding data

**Chunking** (`api/_chunking.js`): Conversations chunked as message-pair windows with overlap; summaries chunked as one chunk per category; files chunked as ~2000 char windows with 400 char overlap.

**Database**: 12 tables in `supabase/migrations/001_initial_schema.sql`. Includes pgvector `document_embeddings` table with HNSW index and `search_embeddings()` Postgres function.

**Webhook auth** (`api/_webhookAuth.js`): Separate from JWT auth — for external → Vercel callbacks. Validates shared secret with timing-safe comparison.

### Action Item Refresh

**Architecture**: User-triggered "Refresh Status" button searches the vector DB for evidence relevant to each action item, then runs a lightweight LLM classification (GPT-4o-mini) to assess whether each item has been addressed.

**Flow**: Frontend → `POST /api/action-items/refresh` (JWT auth) → batch embed all queries (single OpenAI call) → parallel semantic search per item (topK=5, threshold=0.5) → parallel LLM analysis (max 10 concurrent) → persist to `action_items.custom_data` JSONB → return results.

**Analysis results** stored in `custom_data.refresh`: `{ status, confidence, summary, evidence_count, refreshed_at }`. Status is one of: `addressed`, `partially_addressed`, `not_addressed`, `insufficient_evidence`.

**Action item chat embedding**: Each chat exchange in an action item's ChatPanel is fire-and-forget embedded via `POST /api/action-items/embed` (uses `source_type: 'conversation'` with `actionItemId` in metadata). These embeddings are then discoverable by the refresh search.

**Mock mode**: Same fallback as evaluation — `VITE_LLM_MOCK=true` → client mock, 404 in dev → client mock, no `OPENAI_API_KEY` → server mock.

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
- `difyApi.test.js` — 7 tests: chat API mock response structure, summary triggers, file upload
- `LoginScreen.test.jsx` — 8 tests: email + OTP flow, error handling, back navigation
- `InvestmentToggle.test.jsx` — 6 tests: select/deselect, action cleanup, multi-investment, metadata
- `actionItems.test.js` — 12 tests: add/remove investment actions, metadata, immutability, edge cases
- `fileUpload.test.js` — 10 tests: upload, failure, mixed results, message building
- `_chunking.test.js` — 13 tests: conversation/summary/file chunking, overlap, edge cases
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
