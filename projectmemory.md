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
- Site URL: `http://localhost:5173` for local dev (change to `https://app.nusuai.com` for production)

### Decisions explicitly deferred

- **Resend custom SMTP** — Supabase built-in SMTP limited to 2 emails/hr. Before going live with external users: configure Resend (host `smtp.resend.com`, port `465`, username `resend`, password = Resend API key, sender `auth@nusuai.com`). Requires domain verification (DNS records) in Resend dashboard first.
- **OTP expiry tuning** — currently using Supabase defaults. Adjust later based on user feedback.
- **CAPTCHA / bot protection** — not yet enabled. Enable before public launch.
- **PasswordScreen** — still exists with passing tests but is no longer imported by App.jsx. Can be removed in a future cleanup.

### Decisions from v2.0 still deferred
- **Window components as separate files** — the three window render functions stay in App.jsx because they share too much state. Extracting would require Context or massive prop drilling, which is over-engineering for now.
- **Full component test coverage** — only password gate and investment toggle tested. More component tests should be added after the architecture stabilizes.
- **Integration test with mock HTTP server for Dify** — deferred until real Dify integration goes live.
- **CSS Modules / styled-components** — static CSS file is sufficient for current scope.
- **Message list virtualization (react-window)** — not needed until conversations exceed 100+ messages.
- **Dev proxy deep-dive routing** — Vite dev proxy always uses the onboarding API key. Deep-dive workflow routing only works in production (Vercel serverless). Acceptable for now since mock mode is the primary dev workflow.
