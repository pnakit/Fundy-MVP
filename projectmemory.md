# Project Memory — Fundy MVP

High-level record of the app's evolution, decisions made, and context for future work.

## v0 — Initial Commit

- Monolithic single-file React app (`App.jsx`, ~1900 lines including inline CSS)
- Three-window startup evaluation platform: Onboarding Chat, Evaluation & Actions, Investment Matching
- Mock data with simulated Dify API responses
- Deployed to Vercel at `app.nusuai.com`
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

### Decisions explicitly deferred

- **Server-side auth** — client-side password gate is acceptable for MVP demo. Revisit when real users need access control.
- **Window components as separate files** — the three window render functions stay in App.jsx because they share too much state. Extracting would require Context or massive prop drilling, which is over-engineering for now.
- **Full component test coverage** — only password gate and investment toggle tested. More component tests should be added after the architecture stabilizes.
- **Integration test with mock HTTP server for Dify** — deferred until real Dify integration goes live.
- **CSS Modules / styled-components** — static CSS file is sufficient for current scope.
- **Message list virtualization (react-window)** — not needed until conversations exceed 100+ messages.
- **Dev proxy deep-dive routing** — Vite dev proxy always uses the onboarding API key. Deep-dive workflow routing only works in production (Vercel serverless). Acceptable for now since mock mode is the primary dev workflow.
