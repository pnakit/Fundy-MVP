# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT: Before starting any large project action, read `projectmemory.md` for context on past decisions and the app's evolution.**

## Build & Development Commands

- `npm run dev` — Start Vite dev server (http://localhost:5173)
- `npm run build` — Production build
- `npm run preview` — Preview production build locally
- `npm run test` — Run tests in watch mode (Vitest)
- `npm run test:run` — Run tests once (CI mode)
- `npm run lint` — Run ESLint
- `npm run lint:fix` — Run ESLint with auto-fix
- `npm run format` — Run Prettier on all source files

## Project Structure

```
src/
  main.jsx                  # Entry point, imports global CSS
  App.jsx                   # Main orchestrator — state, handlers, render dispatch
  styles/app.css            # All CSS (extracted from inline styles)
  data/mockData.js          # Mock data constants (evaluation, investments, onboarding)
  api/difyApi.js            # Dify API client (blocking, streaming, mock modes)
  utils/
    extractSummary.js       # LLM response parser — extracts onboarding summary JSON
    colors.js               # Shared color constants and status/priority color helpers
  components/
    PasswordScreen.jsx      # Auth gate (password from VITE_APP_PASSWORD env var, sessionStorage)
    ChatPanel.jsx           # Reusable chat UI (messages + typing indicator + input)
    RadarChart.jsx          # SVG radar/spider chart (React.memo)
    ProgressRing.jsx        # SVG circular progress indicator (React.memo)
    ErrorBoundary.jsx       # Error boundary wrapper (per-window crash isolation)
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
| `VITE_APP_PASSWORD` | Client | Password for the auth gate (default: `fundy2026`) |

Server-side vars are used by Vercel serverless functions and the Vite dev proxy. `VITE_`-prefixed vars are bundled into the client build.

## Architecture

**Target Architecture**: See `Architecture.md` for the planned multi-tenancy, persistence, and auth architecture (Supabase unified stack). Consult that document when planning any work related to authentication, data persistence, file storage, vector search, or Dify integration updates. The current app uses mock/ephemeral state — the architecture document describes the production target.

React 18 single-page app built with Vite. No routing library, no state management library.

**`App.jsx`** is the orchestrator — it owns all app state (~13 `useState` hooks) and passes it down to extracted components. The three main views (Onboarding, Evaluation, Investments) are render functions inside App.jsx because they share state (e.g., `actionItems` is used by both Evaluation and Investment windows).

**Onboarding** has three phases dispatched by `onboardingPhase` state:
- `'chat'` → `renderOnboardingChat()` — conversational AI onboarding via ChatPanel
- `'summary'` → `renderOnboardingSummary()` — category cards with progress rings
- `'deep-dive'` → `renderDeepDive()` — per-category follow-up chat with separate conversation state per category

**Dify API** (`src/api/difyApi.js`) supports three modes controlled by env vars:
- `VITE_DIFY_MOCK=true` → mock responses with simulated delays (triggers summary on "summary"/"finish" keywords)
- `VITE_DIFY_STREAMING=true` → SSE streaming mode with `parseSSELine()` buffer management
- Default → blocking mode via `/api/chat` proxy

**Password protection** reads from `VITE_APP_PASSWORD` env var (defaults to `fundy2026`). Uses `sessionStorage` to persist across page refreshes within a session.

### Serverless Functions (Vercel)

Production API routing lives in `/api`. These are Vercel serverless functions, not bundled into the client.

```
api/
  _shared.js          # resolveApiKey(workflow) + getDifyBaseUrl() — shared by all endpoints
  chat.js             # POST /api/chat → Dify /chat-messages (blocking + streaming)
  upload.js           # POST /api/upload → Dify /files/upload (bodyParser disabled for multipart)
  chat/stop.js        # POST /api/chat/stop → Dify /chat-messages/{task_id}/stop
```

**Workflow routing**: request body includes a `workflow` field (`'onboarding'` or `'deepdive'`). `resolveApiKey()` maps this to the correct `DIFY_*_API_KEY` env var, falling back to the onboarding key if the requested workflow key is missing.

### Dev vs Production API Routing

- **Production (Vercel)**: `/api/chat` hits the serverless function in `api/chat.js`, which reads the `workflow` field from the request body and routes to the correct Dify API key.
- **Development (Vite)**: `vite.config.js` proxies `/api/chat` → Dify directly, but always uses the onboarding key (the proxy can't easily parse the request body). Deep-dive workflow routing only works fully in production.

### Key Patterns

- Color constants are centralized in `src/utils/colors.js` (`COLORS.success`, `COLORS.warning`, etc.)
- `ProgressRing` component replaces all hand-rolled SVG circle progress indicators
- `ChatPanel` component is shared between onboarding chat and deep-dive chat
- Action item IDs use an incrementing counter (`generateActionId()`) — not `Date.now() + Math.random()`
- Investment toggle properly cleans up associated action items on deselect
- Each window is wrapped in `<ErrorBoundary name="...">` for crash isolation

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

Current test coverage:
- `extractSummary.test.js` — 22 tests: JSON parsing, validation, normalization, edge cases, SSE parser
- `colors.test.js` — 6 tests: all color helper functions
- `difyApi.test.js` — 7 tests: mock response structure, summary triggers, file upload
- `PasswordScreen.test.jsx` — 5 tests: render, auth flow, error display, error clearing
- `InvestmentToggle.test.jsx` — 5 tests: select/deselect, action cleanup, multi-investment

Run a single test file: `npx vitest run src/utils/colors.test.js`

## Linting & Formatting

- ESLint 9 flat config (`eslint.config.js`) with React, React Hooks, and Prettier plugins
- `no-unused-vars` ignores `_`-prefixed variables (convention for intentionally unused params/catches)
- Prettier config in `.prettierrc`: single quotes, trailing commas, 120 char width

## Deployment

Deployed to Vercel with custom domain `app.nusuai.com`. Vercel auto-detects the Vite build and the `/api` serverless functions. Env vars must be set in Vercel project settings. See README.md for setup details.

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
