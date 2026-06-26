# Fundy MVP

AI-powered startup evaluation platform. Founders are onboarded through a
conversational interview, the platform scores their company across 10
maturity dimensions, and matches them to suitable investment options — all
backed by a retrieval-augmented evaluation pipeline.

Live at **[fundy.nusuai.com](https://fundy.nusuai.com)**.

## Overview

Fundy is a React single-page app with a set of Vercel serverless functions
behind it. It walks a founder through three connected views:

1. **Onboarding** — A conversational AI interview gathers company context
   (with file upload support), then produces a structured summary of the
   company across categories, each with a progress ring.
2. **Evaluation** — Generates a 10-dimension maturity scorecard rendered as
   a radar/spider chart plus per-category breakdowns, and surfaces
   prioritised action items for closing gaps.
3. **Investments** — Matches the company to investment options with
   suitability scoring, and lets the user toggle options to generate
   linked action items.

All LLM work runs through the **Vercel AI SDK** (`streamText`,
`generateObject`) against a provider-agnostic abstraction, and retrieval is
powered by **Supabase pgvector**. (Earlier versions routed through Dify; it
has been fully removed — see `DifyTactics.md` for historical context.)

## Tech Stack

- **Frontend:** React 18 + Vite 5 (single-page app, no router, no state
  library — `App.jsx` is the orchestrator)
- **Backend:** Vercel serverless functions (`/api`)
- **LLM:** Vercel AI SDK (`ai`, `@ai-sdk/openai`) with Zod schemas
- **Database / Auth / Vectors:** Supabase (Postgres + RLS + pgvector,
  email-OTP auth)
- **Embeddings:** OpenAI `text-embedding-3-small`
- **Testing:** Vitest + React Testing Library + jsdom
- **Tooling:** ESLint 9 (flat config) + Prettier

## Quick Start (Local Development)

The project supports both **bun** and **npm** (`bun.lock` and
`package-lock.json` are both checked in). Prefer `bun` for speed; `npm`
works as a fallback.

```bash
# Install dependencies
bun install            # or: npm install

# Run the dev server (no backend required in mock mode)
bun run dev            # or: npm run dev
```

Then open http://localhost:5173.

For local dev without a backend, set `VITE_LLM_MOCK=true` in `.env` — chat,
evaluation, and action-item refresh all fall back to client-side mocks with
simulated delays. To exercise the real serverless functions locally, run
`vercel dev` instead.

### Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start the Vite dev server |
| `bun run build` | Production build |
| `bun run preview` | Preview the production build locally |
| `bun run test` | Run tests in watch mode (Vitest) |
| `bun run test:run` | Run tests once (CI mode) |
| `bun run lint` | Run ESLint |
| `bun run lint:fix` | Run ESLint with auto-fix |
| `bun run format` | Run Prettier on all source files |
| `bun run seed:demo` | Seed demo data (fake) |
| `bun run seed:demo:real` | Seed demo data (real LLM/embeddings) |

## Environment Variables

Copy `.env.example` to `.env` and fill in values. `VITE_`-prefixed vars are
bundled into the client build; the rest are server-side only (set them in
Vercel project settings, never expose them to the client).

| Variable | Side | Purpose |
|----------|------|---------|
| `VITE_SUPABASE_URL` | Client | Supabase project URL (safe to expose, RLS enforced) |
| `VITE_SUPABASE_ANON_KEY` | Client | Supabase publishable anon key |
| `VITE_LLM_MOCK` | Client | `true` for client-side mock mode (no server needed) |
| `SUPABASE_URL` | Server | Supabase project URL (for serverless functions) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase service-role key (**never** expose to client) |
| `OPENAI_API_KEY` | Server | Embedding generation (`text-embedding-3-small`) |
| `ACTIVE_KNOWLEDGE_BASE` | Server | KB selection — `internal` (Supabase pgvector) or a partner ID |
| `LLM_CHAT_MODEL` | Server | AI SDK model for onboarding/deep-dive chat (e.g. `openai:gpt-4o-mini`) |
| `LLM_EVAL_MODEL` | Server | AI SDK model for evaluation + investment matching |
| `LLM_ANALYSIS_MODEL` | Server | AI SDK model for action-item analysis |

`VITE_DIFY_MOCK` is still accepted as a legacy alias for `VITE_LLM_MOCK`.

## Project Structure

```
src/
  main.jsx                  # Entry point, imports global CSS
  App.jsx                   # Orchestrator — owns app state, render dispatch
  styles/app.css            # All CSS (dark theme, glassmorphism)
  data/mockData.js          # Mock data (evaluation, investments, onboarding)
  api/                      # Client-side API clients
    supabaseClient.js       # Supabase client init
    dataAccess.js           # Data access layer (auth + persistence)
    difyApi.js              # Chat client (blocking/streaming/mock modes)
    evaluationApi.js        # Streaming evaluation client (SSE)
    actionItemRefreshApi.js # Action-item refresh client
  utils/                    # extractSummary, colors, actionItems, fileUpload, pdfExtract
  components/               # LoginScreen, ChatPanel, RadarChart, ProgressRing,
                            # InvestmentToggle, ErrorBoundary, DebugPanel

api/                        # Vercel serverless functions (not bundled into client)
  _llm.js                   # Provider-agnostic LLM abstraction (Vercel AI SDK)
  _auth.js                  # JWT validation (Supabase JWKS via jose)
  _supabase.js              # Supabase admin client (service_role)
  _chunking.js              # Text chunking (conversations, summaries, files)
  _prompts/                 # onboarding, deepdive, evaluation, investment prompts
  chat.js                   # POST /api/chat — routed by `workflow` field
  upload.js                 # POST /api/upload — file text extraction
  summary.js                # POST /api/summary — upsert + embed onboarding summary
  knowledge/                # embed.js + KB abstraction + embeddings/search
  evaluation/               # generate.js (SSE), save.js, investment-match.js, maturity
  action-items/             # refresh.js, embed.js, _analyze.js
  account/delete.js         # Reset all user data (preserves auth account)

supabase/
  migrations/001_initial_schema.sql   # 12 tables + RLS + pgvector + search fn

scripts/                    # Demo/test data seeding
```

> **Vercel function limit:** the Hobby plan allows 12 serverless functions.
> Every non-`_`-prefixed `.js` file under `api/` counts as one, so helpers
> and test files are `_`-prefixed to stay under the limit.

## How It Works

### Authentication
Supabase Auth with email + OTP (8-digit codes). `LoginScreen` handles the
email → OTP flow; `App.jsx` listens via `onAuthStateChange`. Every API call
carries the JWT in the `Authorization` header, and serverless functions
validate it against Supabase JWKS.

### Evaluation pipeline
`POST /api/evaluation/generate` embeds the deep-dive conversations, runs 10
per-category LLM evaluations (batched in groups of 3 to respect rate
limits), applies deterministic maturity inference, then runs LLM-powered
investment matching — streaming progress back to the client via SSE for
progressive rendering.

### Action-item refresh
`POST /api/action-items/refresh` batch-embeds each action item's query,
runs parallel semantic search over the vector DB, and uses a lightweight
LLM classification to judge whether each item has been addressed. Results
(`addressed` / `partially_addressed` / `not_addressed` /
`insufficient_evidence`) are persisted and shown as status badges.

### Mock-mode fallbacks
The app degrades gracefully when no backend is available:
1. `VITE_LLM_MOCK=true` → client-side mock (never hits the server)
2. `/api/...` returns 404 in dev → client auto-falls back to mock
3. Server has no LLM model configured → server-side mock from onboarding data

## Testing

```bash
bun run test:run                       # full suite (CI mode)
npx vitest run src/utils/colors.test.js # a single file
```

Tests live alongside their source files (`*.test.js` / `*.test.jsx`) and
cover the summary parser, color/maturity helpers, chat and evaluation API
clients, auth flow, action-item logic and refresh pipeline, chunking, LLM
prompt builders, and the maturity calculation.

## Deployment

Deployed to **Vercel** with the custom domain `fundy.nusuai.com`.

### Deploy via GitHub (recommended)

1. Push to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
3. **Add New Project** → import the repository.
4. Vercel auto-detects the Vite build and the `/api` serverless functions.
5. Add the environment variables (see above) in **Settings → Environment
   Variables**.
6. **Deploy.**

### Deploy via CLI

```bash
npm install -g vercel
vercel
```

### Custom domain

In the Vercel dashboard, go to **Settings → Domains**, add
`fundy.nusuai.com`, and create the DNS records Vercel shows you (typically a
CNAME to `cname.vercel-dns.com`) at your registrar. DNS propagation usually
takes a few minutes.

## Further Reading

- `CLAUDE.md` — development notes and architecture deep-dive
- `Architecture.md` — target multi-tenancy / persistence / auth design
- `datastructure.md` — workflow input/output contracts and schema alignment
- `projectmemory.md` — past decisions and the app's evolution
</content>
</invoke>
