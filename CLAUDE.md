# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm run dev` — Start Vite dev server (http://localhost:5173)
- `npm run build` — Production build
- `npm run preview` — Preview production build locally

No test runner or linter is configured.

## Architecture

This is **Fundy MVP** ("Startup Evaluator Platform"), a single-page React 18 app built with Vite. It provides AI-powered startup evaluation across three windows.

### Monolithic Structure

Nearly all application logic lives in **`src/App.jsx`** (~1800 lines). There is no routing library, state management library, or component library. State is managed entirely with React hooks (`useState`, `useRef`, `useEffect`).

The app is organized as three render functions inside `App.jsx`:

1. **`renderChatWindow`** — Chat-based onboarding interface. Collects company profile via conversational UI. Supports file uploads and integrates with Dify API (currently mocked with simulated responses).
2. **`renderEvaluationWindow`** — Displays evaluation results: maturity stage tracker (5 stages), radar/spider chart (8 dimensions), performance metrics with bar charts, and actionable items with priority/status tracking.
3. **`renderInvestmentWindow`** — Investment matching with suitability scores, circular progress indicators, and auto-generated action items when investments are selected.

### Data & API

- Mock data objects (`MOCK_EVALUATION_DATA`, `MOCK_INVESTMENT_DATA`, `INVESTMENT_ACTIONS`) provide demo data inline in `App.jsx`.
- `DataStore` object simulates state persistence.
- Dify API integration is stubbed out — the API key is hardcoded and responses are simulated with timeouts.

### Styling

- All CSS is in an inline `<style>` tag within `App.jsx` (no CSS files or CSS-in-JS library).
- Dark theme with indigo/purple accent gradients. Glassmorphism effects (backdrop blur, semi-transparent backgrounds).
- Fonts: 'Plus Jakarta Sans' (headings), 'DM Sans' (body).
- Status color convention: green (`#10b981`) = success, orange (`#f59e0b`) = warning, red (`#ef4444`) = critical.

## Deployment

Deployed to Vercel with custom domain `app.nusuai.com`. See README.md for Vercel and custom domain setup details.

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
