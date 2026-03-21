# Fundy — Architecture & System Documentation

Comprehensive technical documentation with diagrams covering every major component, workflow, and data flow in the Fundy platform.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [User Journey & Application Flow](#2-user-journey--application-flow)
3. [Frontend Architecture](#3-frontend-architecture)
4. [Authentication Flow](#4-authentication-flow)
5. [Onboarding Workflow](#5-onboarding-workflow)
6. [Deep-Dive Workflow](#6-deep-dive-workflow)
7. [Evaluation Pipeline](#7-evaluation-pipeline)
8. [Investment Matching Pipeline](#8-investment-matching-pipeline)
9. [Knowledge Base & Embedding System](#9-knowledge-base--embedding-system)
10. [Database Schema](#10-database-schema)
11. [Serverless API Layer](#11-serverless-api-layer)
12. [Data Persistence & Restoration](#12-data-persistence--restoration)
13. [Action Item Lifecycle](#13-action-item-lifecycle)

---

## 1. System Architecture Overview

The platform is a three-tier system: a React SPA frontend, Vercel serverless functions as the API/middleware layer, and Supabase + Dify as backend services. All AI interactions are proxied through Vercel — Dify never has direct database access.

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────┐               │
│  │ Login    │  │ App.jsx      │  │ evaluationA │               │
│  │ Screen   │  │ (orchestrator│  │ pi.js       │               │
│  │          │  │  18 hooks)   │  │ (SSE client)│               │
│  └────┬─────┘  └──────┬───────┘  └──────┬──────┘               │
│       │               │                 │                        │
│  ┌────┴───────────────┴─────────────────┴──────┐                │
│  │           supabase-js  +  fetch              │                │
│  │     (RLS-enforced reads, JWT on all calls)   │                │
│  └──────────────────────┬───────────────────────┘                │
└─────────────────────────┼────────────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────┼────────────────────────────────────────┐
│                  VERCEL SERVERLESS                                │
│                                                                  │
│  ┌─────────┐  ┌───────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ /api/   │  │ /api/     │  │ /api/        │  │ /api/      │  │
│  │ chat    │  │ upload    │  │ evaluation/  │  │ summary    │  │
│  │         │  │           │  │ generate     │  │            │  │
│  └────┬────┘  └─────┬─────┘  └──────┬───────┘  └─────┬──────┘  │
│       │             │               │                 │          │
│  ┌────┴─────────────┴───────────────┴─────────────────┴──────┐  │
│  │  _auth.js (JWT verify)  |  _shared.js (API key routing)  │  │
│  └───────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────┼───────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌────────────┐   ┌──────────────┐   ┌──────────┐
     │   Dify     │   │  Supabase    │   │  OpenAI  │
     │ (LLM      │   │  Postgres    │   │ Embeddings│
     │  workflows)│   │  + pgvector  │   │ API      │
     │            │   │  + Auth      │   │          │
     └────────────┘   └──────────────┘   └──────────┘
```

**Key design principle**: Dify is a pure LLM orchestrator. It receives pre-assembled context and returns structured output. All data retrieval, embedding, and persistence happens in Vercel serverless functions, keeping secrets secure and allowing backend swaps without touching Dify workflows.

---

## 2. User Journey & Application Flow

The app has three main windows, progressed linearly. Each window builds on the data from the previous one.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER JOURNEY                                 │
│                                                                      │
│   ┌──────────┐                                                       │
│   │  LOGIN   │  Email → OTP code → Session                          │
│   └────┬─────┘                                                       │
│        │                                                             │
│        ▼                                                             │
│   ┌──────────────────────── WINDOW 1 ───────────────────────────┐   │
│   │                    ONBOARDING                                │   │
│   │                                                              │   │
│   │  ┌─────────┐    ┌──────────┐    ┌──────────┐               │   │
│   │  │  Chat   │───▶│ Summary  │───▶│Deep-Dive │               │   │
│   │  │  Phase  │    │  Cards   │    │ Per-Cat  │               │   │
│   │  │         │    │ (10 dims)│    │  Chats   │               │   │
│   │  └─────────┘    └──────────┘    └──────────┘               │   │
│   │                                                              │   │
│   │  AI asks 10 primary questions → extracts structured summary  │   │
│   │  User can deep-dive into any category for richer data        │   │
│   └──────────────────────────────────────────────────────────────┘   │
│        │                                                             │
│        ▼  (summary data passed as input)                             │
│   ┌──────────────────────── WINDOW 2 ───────────────────────────┐   │
│   │                    EVALUATION                                │   │
│   │                                                              │   │
│   │  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌─────────┐ │   │
│   │  │ Maturity │  │  Radar    │  │Performance │  │ Action  │ │   │
│   │  │  Stage   │  │  Chart    │  │  Metrics   │  │  Items  │ │   │
│   │  │  (1-5)   │  │ (10 axes) │  │  (bars)    │  │ (tasks) │ │   │
│   │  └──────────┘  └───────────┘  └────────────┘  └─────────┘ │   │
│   │                                                              │   │
│   │  KB-enriched AI evaluation → progressive streaming results   │   │
│   └──────────────────────────────────────────────────────────────┘   │
│        │                                                             │
│        ▼  (evaluation scores passed as input)                        │
│   ┌──────────────────────── WINDOW 3 ───────────────────────────┐   │
│   │                    INVESTMENTS                               │   │
│   │                                                              │   │
│   │  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌─────────┐ │   │
│   │  │Readiness │  │ Funding   │  │Improvement │  │   Due   │ │   │
│   │  │ Summary  │  │  Cards    │  │  Roadmap   │  │Diligence│ │   │
│   │  │          │  │ (6 types) │  │            │  │Checklists│ │   │
│   │  └──────────┘  └───────────┘  └────────────┘  └─────────┘ │   │
│   │                                                              │   │
│   │  AI matches to 6 funding types with scores + action items    │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Frontend Architecture

The frontend is a single-page React 18 app with no routing library. `App.jsx` is the central orchestrator holding all state. Components are extracted for reuse, but the three main render functions stay in App.jsx because they share state.

```
┌──────────────────────────────────────────────────────────────┐
│                         App.jsx                               │
│                    (Central Orchestrator)                      │
│                                                               │
│  State (18 hooks):                                            │
│  ┌─────────────┬──────────────┬────────────────┐             │
│  │ session     │ messages     │ evaluationData │             │
│  │ authLoading │ inputValue   │ evaluationLoad │             │
│  │ deleteState │ isTyping     │ evalProgress   │             │
│  │ activeWindow│ conversationId│ evalStatus    │             │
│  │ onboarding  │ uploadedFiles│ evalError      │             │
│  │   Phase     │ activeCategory│ investmentData│             │
│  │ onboarding  │ categoryConvs│ actionItems   │             │
│  │   Summary   │ expandedDim  │ selectedInvest│             │
│  └─────────────┴──────────────┴────────────────┘             │
│                                                               │
│  ┌────────────────┐ ┌────────────────┐ ┌──────────────────┐ │
│  │ renderOnboard- │ │ renderEvalua-  │ │ renderInvestment │ │
│  │ ingChat()      │ │ tionWindow()   │ │ Window()         │ │
│  │                │ │                │ │                  │ │
│  │ • Chat phase   │ │ • Maturity bar │ │ • Readiness card │ │
│  │ • Summary view │ │ • Radar chart  │ │ • Funding cards  │ │
│  │ • Deep-dive    │ │ • Metrics bars │ │ • Roadmap        │ │
│  │ • Read-only    │ │ • Action items │ │ • DD checklists  │ │
│  └────────┬───────┘ └───────┬────────┘ └────────┬─────────┘ │
└───────────┼─────────────────┼───────────────────┼────────────┘
            │                 │                   │
            ▼                 ▼                   ▼
┌──────────────────────────────────────────────────────────────┐
│                    Shared Components                          │
│                                                               │
│  ┌────────────┐ ┌────────────┐ ┌──────────────┐            │
│  │ ChatPanel  │ │ RadarChart │ │ProgressRing  │            │
│  │ (memo)     │ │ (memo, SVG)│ │ (memo, SVG)  │            │
│  │            │ │            │ │              │            │
│  │ Messages   │ │ 10-axis    │ │ Circular %   │            │
│  │ Input bar  │ │ spider plot│ │ indicator    │            │
│  │ File attach│ │ Score poly │ │              │            │
│  │ Read-only  │ │            │ │              │            │
│  └────────────┘ └────────────┘ └──────────────┘            │
│                                                               │
│  ┌────────────┐ ┌──────────────────────────────┐            │
│  │ LoginScreen│ │ ErrorBoundary                 │            │
│  │            │ │ (wraps each window for crash  │            │
│  │ Email→OTP  │ │  isolation)                   │            │
│  └────────────┘ └──────────────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

**Onboarding phase state machine** within `renderOnboardingChat()`:

```
                    ┌──────────┐
                    │  'chat'  │  ◀── Initial state
                    │          │      AI asks questions, user responds
                    └────┬─────┘
                         │ Summary JSON detected in AI response
                         ▼
                    ┌──────────┐
              ┌────▶│'summary' │  Category cards with completeness rings
              │     │          │  User can view conversation or deep-dive
              │     └──┬───┬───┘
              │        │   │
   "← View    │        │   │  Click category card
   conversation"       │   │
              │        ▼   ▼
   ┌──────────┴──┐  ┌──────────┐
   │'chat-       │  │'deep-    │  Per-category follow-up chat
   │ readonly'   │  │ dive'    │  Separate conversation per category
   │             │  │          │
   └─────────────┘  └──────────┘
                         │ "← Back to summary"
                         ▼
                    ┌──────────┐
                    │'summary' │
                    └──────────┘
```

---

## 4. Authentication Flow

Authentication uses Supabase Auth with passwordless email OTP. The `LoginScreen` component handles the two-step flow, and `App.jsx` listens for session changes to gate all content.

```
┌────────────────────────────────────────────────────────────────┐
│                   AUTHENTICATION FLOW                           │
│                                                                 │
│  User                   LoginScreen              Supabase Auth  │
│   │                         │                         │         │
│   │  Enter email            │                         │         │
│   │────────────────────────▶│                         │         │
│   │                         │  signInWithOtp(email)   │         │
│   │                         │────────────────────────▶│         │
│   │                         │                         │         │
│   │                         │    OTP sent via email   │         │
│   │                         │◀────────────────────────│         │
│   │  Enter 8-digit code     │                         │         │
│   │────────────────────────▶│                         │         │
│   │                         │ verifyOtp(email, token) │         │
│   │                         │────────────────────────▶│         │
│   │                         │                         │         │
│   │                         │  JWT session returned   │         │
│   │                         │◀────────────────────────│         │
│   │                         │                         │         │
│   │  App.jsx receives session via onAuthStateChange   │         │
│   │  └─▶ restoreUserData() loads saved state          │         │
│   │                                                   │         │
│   │                                                             │
│   │  ══════ On every API call ══════                            │
│   │                                                             │
│   │  fetch('/api/...', { Authorization: Bearer <JWT> })         │
│   │         │                                                   │
│   │         ▼                                                   │
│   │  ┌─────────────┐                                           │
│   │  │  _auth.js   │  Validates JWT via Supabase JWKS          │
│   │  │  (middleware)│  Checks issuer, audience, expiry          │
│   │  │             │  Returns { user: payload } or 401         │
│   │  └─────────────┘                                           │
│                                                                 │
│  Also supports: demo login (signInWithPassword for testing)     │
└────────────────────────────────────────────────────────────────┘
```

**Security layers**:
- All Supabase client queries enforce Row-Level Security via `auth.uid()`
- All serverless endpoints validate JWTs via JWKS (cached, no per-request network call)
- Dify never has database access — all data flows through authenticated Vercel functions
- `SUPABASE_SERVICE_ROLE_KEY` exists only in Vercel env vars, never in client or Dify

---

## 5. Onboarding Workflow

The onboarding flow collects company information through a conversational AI interface. The Dify onboarding workflow asks 10 primary questions (one per evaluation dimension) with adaptive follow-up probes. When sufficient information is gathered, the AI produces a structured JSON summary.

```
┌──────────────────────────────────────────────────────────────────────┐
│                     ONBOARDING DATA FLOW                              │
│                                                                       │
│  User              App.jsx           Vercel /api/chat      Dify       │
│   │                   │                    │                │         │
│   │  Type message     │                    │                │         │
│   │──────────────────▶│                    │                │         │
│   │                   │  POST /api/chat    │                │         │
│   │                   │  {query, convoId,  │                │         │
│   │                   │   workflow:'onboard│ing'}           │         │
│   │                   │───────────────────▶│                │         │
│   │                   │                    │  resolveApiKey  │         │
│   │                   │                    │  ('onboarding') │         │
│   │                   │                    │───────────────▶│         │
│   │                   │                    │                │         │
│   │                   │                    │  LLM response  │         │
│   │                   │                    │◀───────────────│         │
│   │                   │  response + convoId│                │         │
│   │                   │◀───────────────────│                │         │
│   │                   │                    │                │         │
│   │  Display response │                    │                │         │
│   │◀──────────────────│                    │                │         │
│   │                   │                    │                │         │
│   │  ... (multiple turns) ...              │                │         │
│   │                   │                    │                │         │
│   │                   │  Final response contains:          │         │
│   │                   │  [ONBOARDING_SUMMARY]              │         │
│   │                   │  { version, companyName,           │         │
│   │                   │    overallCompleteness,            │         │
│   │                   │    categories: [10 items] }        │         │
│   │                   │  [/ONBOARDING_SUMMARY]             │         │
│   │                   │                    │                │         │
│   │                   │  extractOnboardingSummary()         │         │
│   │                   │  ├─ Find markers                   │         │
│   │                   │  ├─ Strip code fences              │         │
│   │                   │  ├─ JSON.parse + validate          │         │
│   │                   │  ├─ Normalize completeness 0-100   │         │
│   │                   │  ├─ Fill missing categories        │         │
│   │                   │  └─ Sort to standard order          │         │
│   │                   │                    │                │         │
│   │                   │  persistSummary()  │                │         │
│   │                   │──────────────────▶ POST /api/summary          │
│   │                   │                    │                │         │
│   │                   │         ┌──────────┴──────────┐    │         │
│   │                   │         │ Upsert summary row  │    │         │
│   │                   │         │ Chunk per category   │    │         │
│   │                   │         │ Generate embeddings  │    │         │
│   │                   │         │ Store in pgvector    │    │         │
│   │                   │         └─────────────────────┘    │         │
│   │                   │                    │                │         │
│   │  Show summary     │                    │                │         │
│   │  cards (10 dims)  │                    │                │         │
│   │◀──────────────────│                    │                │         │
└──────────────────────────────────────────────────────────────────────┘
```

**Summary structure per category**:

```
┌─────────────────────────────────────────────┐
│  Category: Product & Technology              │
│                                              │
│  Completeness: ████████░░ 85%     ◀── ProgressRing
│  Status: complete                            │
│                                              │
│  Summary: "SaaS platform with proprietary    │
│  ML pipeline..."                             │
│                                              │
│  Highlights:                                 │
│    ✓ Proprietary ML model (3x benchmark)     │
│    ✓ API-first architecture                  │
│                                              │
│  Gaps:                                       │
│    ✗ No patent filings documented            │
│    ✗ Technical debt assessment missing        │
│                                              │
│  Key Metrics:                                │
│    Tech Stack: Advanced                      │
│    IP Protection: Low                        │
│    Product Stage: Growth                     │
│                                              │
│  [Click to Deep-Dive →]                      │
└─────────────────────────────────────────────┘
```

**Three Dify API modes** (controlled by env vars):

```
┌──────────────────────────────────────────────────────┐
│  VITE_DIFY_MOCK=true                                  │
│  └─▶ Client-side mock: simulated delays, canned      │
│      responses, triggers summary on keywords          │
│                                                       │
│  VITE_DIFY_STREAMING=true                             │
│  └─▶ SSE streaming: progressive token display,       │
│      parseSSELine() buffer management                 │
│                                                       │
│  Default (both false)                                 │
│  └─▶ Blocking: wait for full response, display once  │
└──────────────────────────────────────────────────────┘
```

---

## 6. Deep-Dive Workflow

After onboarding, users can click any category card to enter a deep-dive — a follow-up conversation focused on that specific dimension. Each category has its own independent conversation state.

```
┌──────────────────────────────────────────────────────────────┐
│                    DEEP-DIVE ARCHITECTURE                      │
│                                                               │
│  Summary View (10 category cards)                             │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐
│  │P&T│ │Mkt│ │Biz│ │Tem│ │GTM│ │Fin│ │Fun│ │Cmp│ │Ops│ │Lgl│
│  │85%│ │60%│ │45%│ │70%│ │55%│ │30%│ │40%│ │65%│ │50%│ │25%│
│  └─┬─┘ └───┘ └───┘ └───┘ └───┘ └─┬─┘ └───┘ └───┘ └───┘ └───┘
│    │                               │                          │
│    │ click                         │ click                    │
│    ▼                               ▼                          │
│  ┌─────────────────┐  ┌─────────────────┐                    │
│  │ Deep-Dive Chat  │  │ Deep-Dive Chat  │   (independent)    │
│  │ P&T             │  │ Financial       │                    │
│  │                 │  │                 │                    │
│  │ Assistant:      │  │ Assistant:      │                    │
│  │ "Let's explore  │  │ "I'd like to    │                    │
│  │  your IP..."    │  │  understand     │                    │
│  │ (deepDivePrompt)│  │  your runway.." │                    │
│  │                 │  │                 │                    │
│  │ Separate convoId│  │ Separate convoId│                    │
│  │ Separate Dify   │  │ Separate Dify   │                    │
│  │ conversation    │  │ conversation    │                    │
│  └─────────────────┘  └─────────────────┘                    │
│                                                               │
│  State: categoryConversations = {                             │
│    product_technology: { messages: [...], conversationId },   │
│    financial_health:   { messages: [...], conversationId },   │
│    ...                                                        │
│  }                                                            │
└──────────────────────────────────────────────────────────────┘
```

Deep-dive conversations are persisted to Supabase (`conversations` + `messages` tables, `workflow='deepdive'`, `category_id` set). They are embedded into the knowledge base before evaluation to enrich context.

---

## 7. Evaluation Pipeline

The evaluation is a two-phase streaming pipeline. Phase 1 evaluates all 10 dimensions. Phase 2 calculates investment readiness. Both use Dify Workflow apps (single-shot, not conversational) with SSE streaming.

```
┌──────────────────────────────────────────────────────────────────────┐
│                    EVALUATION PIPELINE (2 Phases)                      │
│                                                                       │
│  ════════════════ PHASE 1: Category Evaluation ═══════════════════    │
│                                                                       │
│  Frontend                    /api/evaluation/generate          Dify   │
│     │                              │                            │     │
│     │  POST { companyName,         │                            │     │
│     │    onboardingSummary }        │                            │     │
│     │─────────────────────────────▶│                            │     │
│     │                              │                            │     │
│     │                    ┌─────────┴─────────┐                  │     │
│     │                    │ 1. Verify JWT     │                  │     │
│     │                    │ 2. Embed deep-dive│                  │     │
│     │                    │    conversations   │                  │     │
│     │                    │ 3. 10 parallel KB  │                  │     │
│     │                    │    searches        │                  │     │
│     │                    │ 4. Assemble per-   │                  │     │
│     │                    │    category context│                  │     │
│     │                    └─────────┬─────────┘                  │     │
│     │                              │                            │     │
│     │                              │  Dify Workflow API         │     │
│     │                              │  (streaming)               │     │
│     │                              │───────────────────────────▶│     │
│     │                              │                            │     │
│     │                              │        ┌──────────────────┐│     │
│     │                              │        │  Dify Workflow:  ││     │
│     │                              │        │                  ││     │
│     │                              │        │  Code 1: define  ││     │
│     │                              │        │    categories    ││     │
│     │                              │        │       │          ││     │
│     │                              │        │  Iteration (×10):││     │
│     │                              │        │  ┌─ Code 2: query││     │
│     │                              │        │  ├─ HTTP: KB     ││     │
│     │                              │        │  └─ Code 3: fmt  ││     │
│     │                              │        │       │          ││     │
│     │                              │        │  Code 4: route   ││     │
│     │                              │        │  to 10 LLM nodes ││     │
│     │                              │        │       │          ││     │
│     │                              │        │  eval_product_*  ││     │
│     │                              │        │  eval_market_*   ││     │
│     │                              │        │  eval_business_* ││     │
│     │                              │        │  ... (×10)       ││     │
│     │                              │        └──────────────────┘│     │
│     │                              │                            │     │
│     │  ◀── SSE stream ──────────── │ ◀── SSE events ───────────│     │
│     │                              │                            │     │
│     │  Events received:            │  Event transformation:     │     │
│     │  • category_started          │  node_started(eval_*) →    │     │
│     │  • category_complete ×10     │    category_started        │     │
│     │  • workflow_complete         │  node_finished(eval_*) →   │     │
│     │                              │    category_complete       │     │
│     │  Progressive UI update:      │  workflow_finished →       │     │
│     │  Each category appears       │    workflow_complete       │     │
│     │  as it completes             │                            │     │
│     │                              │                            │     │
│  ════════════════ PHASE 2: Investment Matching ═══════════════════    │
│                                                                       │
│     │  POST /api/evaluation/       │                            │     │
│     │  investment-match            │                            │     │
│     │  { categoryResults }         │                            │     │
│     │─────────────────────────────▶│                            │     │
│     │                              │───────────────────────────▶│     │
│     │                              │                            │     │
│     │  Events:                     │  Dify Investment Workflow:  │     │
│     │  • investment_matching_      │  Variable Aggregator →     │     │
│     │    started                   │  calculate_maturity →      │     │
│     │  • maturity_calculated       │  generate_matrix →         │     │
│     │  • investment_recommenda-    │  investment_recommendations│     │
│     │    tions_complete            │                            │     │
│     │  • workflow_complete         │                            │     │
│     │                              │                            │     │
│  ════════════════ PERSIST ════════════════════════════════════════    │
│     │                              │                            │     │
│     │  POST /api/evaluation/save   │                            │     │
│     │  { evaluationData,           │                            │     │
│     │    actionItems,              │                            │     │
│     │    investmentRecommendations }│                            │     │
│     │─────────────────────────────▶│                            │     │
│     │                              │  Upsert to evaluations +   │     │
│     │                              │  Merge action items        │     │
│     │                              │  (append-only from AI)     │     │
└──────────────────────────────────────────────────────────────────────┘
```

**Mock/Fallback layers** (graceful degradation):

```
Layer 1: VITE_DIFY_MOCK=true         → Client-side mock (never hits server)
Layer 2: /api/evaluation/generate 404 → Client auto-falls back to mock (dev)
Layer 3: No DIFY_EVALUATION_API_KEY   → Server-side mock from onboarding data
Layer 4: OpenAI quota exceeded        → Falls back to onboarding-only context
```

---

## 8. Investment Matching Pipeline

After evaluation, the investment window shows AI-generated funding recommendations with detailed fit analysis.

```
┌──────────────────────────────────────────────────────────────────┐
│                  INVESTMENT WINDOW COMPONENTS                     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Investment Readiness Summary                              │  │
│  │  "Your company shows strong Series A readiness with        │  │
│  │   validated product and growing revenue..."                │  │
│  │  Readiness Score: ████████░░ 78%                          │  │
│  │  Primary Recommendation: Series A                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │ RECOMMENDED │ │ CONDITIONAL │ │NOT RECOMMEND│                │
│  │             │ │             │ │             │                │
│  │ Series A    │ │ Venture Debt│ │ Rev-Based   │                │
│  │ ██████ 82%  │ │ ████░░ 55%  │ │ ██░░░░ 25%  │                │
│  │             │ │             │ │             │                │
│  │ Fit: Strong │ │ Conditions: │ │ Reason:     │                │
│  │ product w/  │ │ Need 12mo   │ │ Insufficient│                │
│  │ growing rev │ │ revenue     │ │ recurring   │                │
│  │             │ │ history     │ │ revenue     │                │
│  │ Terms: ...  │ │             │ │             │                │
│  │ Objections: │ │ Improvements│ │             │                │
│  │  ...        │ │ needed: ... │ │             │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Improvement Roadmap                                       │  │
│  │  Priority 1: Financial Health (score 2 → 4)                │  │
│  │    Unlocks: Venture Debt, Series A stronger                │  │
│  │    Actions: Build 12mo forecast, Document MRR              │  │
│  │    Timeline: 4-6 weeks                                     │  │
│  │  Priority 2: Legal & Compliance (score 1 → 3)              │  │
│  │    ...                                                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Due Diligence Checklists (on investment toggle)           │  │
│  │  ☑ Series A selected → checklist loaded:                   │  │
│  │    □ Audited financials                                    │  │
│  │    □ Board deck template                                   │  │
│  │    □ Metrics dashboard                                     │  │
│  │    □ Customer reference list                               │  │
│  │    □ Legal/IP documentation                                │  │
│  │    □ Data room setup                                       │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**6 funding types evaluated**:

| ID | Type | Key Assessment Criteria |
|---|---|---|
| `pre_seed` | Pre-Seed | Idea clarity, founding team, initial concept |
| `seed` | Seed Funding | MVP readiness, initial traction, team |
| `series_a` | Series A | Product-market fit, revenue, scalable model |
| `grant_funding` | Government Grants | Innovation focus, R&D, local impact |
| `venture_debt` | Venture Debt | Existing VC backing, recurring revenue |
| `revenue_based_financing` | Revenue-Based Financing | MRR history, unit economics, predictability |

---

## 9. Knowledge Base & Embedding System

The platform builds a per-user knowledge base from onboarding data, conversation history, and uploaded files. This KB is queried during evaluation to provide context-aware assessments.

```
┌──────────────────────────────────────────────────────────────────┐
│                  KNOWLEDGE BASE PIPELINE                          │
│                                                                   │
│  ═══════ INGESTION (data → embeddings) ═══════                   │
│                                                                   │
│  Source Data              Chunking              Embedding          │
│  ┌──────────┐     ┌─────────────────┐    ┌────────────────┐     │
│  │Onboarding│────▶│ 1 chunk per     │───▶│ OpenAI         │     │
│  │ Summary  │     │ category (×10)  │    │ text-embedding │     │
│  └──────────┘     └─────────────────┘    │ -3-small       │     │
│  ┌──────────┐     ┌─────────────────┐    │ (1536 dims)    │     │
│  │Conversa- │────▶│ Message-pair    │───▶│                │     │
│  │ tions    │     │ windows w/      │    │ Batch embed    │     │
│  └──────────┘     │ 400 char overlap│    │ all chunks     │     │
│  ┌──────────┐     └─────────────────┘    └───────┬────────┘     │
│  │Uploaded  │     ┌─────────────────┐            │              │
│  │ Files    │────▶│ ~2000 char      │───▶        │              │
│  └──────────┘     │ windows w/      │            │              │
│                   │ 400 char overlap│            │              │
│                   └─────────────────┘            │              │
│                                                  ▼              │
│                              ┌──────────────────────────┐       │
│                              │  document_embeddings     │       │
│                              │  (Supabase pgvector)     │       │
│                              │                          │       │
│                              │  id | user_id | source_  │       │
│                              │  type | source_id |      │       │
│                              │  chunk_index | content | │       │
│                              │  embedding (vector 1536) │       │
│                              │                          │       │
│                              │  HNSW index (cosine)     │       │
│                              │  m=16, ef_construction=64│       │
│                              └──────────┬───────────────┘       │
│                                         │                       │
│  ═══════ RETRIEVAL (query → context) ═══════                    │
│                                         │                       │
│  /api/evaluation/generate               │                       │
│  ┌──────────────────────┐               │                       │
│  │ Per category (×10):  │               │                       │
│  │  1. Build query from │               │                       │
│  │     category context │               │                       │
│  │  2. Embed query      │───────────────┘                       │
│  │  3. search_embeddings│◀── cosine similarity                  │
│  │     (top_k, threshold│                                       │
│  │      source_types,   │                                       │
│  │      user_id)        │                                       │
│  │  4. Assemble context │                                       │
│  │     for Dify input   │                                       │
│  └──────────────────────┘                                       │
│                                                                  │
│  Result: context_product_technology = "relevant chunks..."       │
│          context_market_traction = "relevant chunks..."          │
│          ... (×10 context variables passed to Dify)              │
└──────────────────────────────────────────────────────────────────┘
```

**KB abstraction layer** (`knowledgeBase.js`): Config-driven adapter pattern with a unified `semanticSearch()` interface. Currently only the internal Supabase pgvector adapter is implemented. The adapter is swappable to support external partner databases in the future.

---

## 10. Database Schema

12 tables with Row-Level Security on every table. `auth.uid()` enforces per-user data isolation automatically.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        DATABASE SCHEMA (Supabase Postgres)            │
│                                                                       │
│  ┌──────────────────┐                                                │
│  │  auth.users      │◀──── Supabase managed                         │
│  │  (id UUID PK)    │                                                │
│  └────────┬─────────┘                                                │
│           │ CASCADE DELETE on all foreign keys                        │
│           │                                                          │
│  ┌────────┼──────────────────────────────────────────────────────┐   │
│  │        │                                                      │   │
│  │   ┌────┴────────────┐     ┌───────────────────┐              │   │
│  │   │ user_profiles   │     │ app_config         │  (global)   │   │
│  │   │ id, email,      │     │ key PK, value JSONB│              │   │
│  │   │ company_name    │     └───────────────────┘              │   │
│  │   └─────────────────┘                                        │   │
│  │                                                               │   │
│  │   ┌─────────────────┐     ┌───────────────────┐              │   │
│  │   │ conversations   │────▶│ messages           │              │   │
│  │   │ id, user_id,    │     │ id, conversation_id│              │   │
│  │   │ workflow,        │     │ user_id, role,     │              │   │
│  │   │ dify_convo_id,  │     │ content, metadata  │              │   │
│  │   │ category_id     │     └───────────────────┘              │   │
│  │   └─────────────────┘                                        │   │
│  │                                                               │   │
│  │   ┌─────────────────┐     ┌───────────────────┐              │   │
│  │   │ onboarding_     │     │ evaluations        │              │   │
│  │   │ summaries       │     │ id, user_id,       │              │   │
│  │   │ id, user_id,    │     │ maturity_stage,    │              │   │
│  │   │ summary_data,   │     │ dimensions,        │              │   │
│  │   │ onboarding_phase│     │ performance_metrics│              │   │
│  │   └─────────────────┘     │ investment_data    │              │   │
│  │                           └───────────────────┘              │   │
│  │                                                               │   │
│  │   ┌─────────────────┐     ┌───────────────────┐              │   │
│  │   │ action_items    │     │ investment_        │              │   │
│  │   │ id, user_id,    │     │ selections         │              │   │
│  │   │ action_key,     │     │ id, user_id,       │              │   │
│  │   │ title, desc,    │     │ investment_type,   │              │   │
│  │   │ priority, status│     │ selected           │              │   │
│  │   │ source_type,    │     └───────────────────┘              │   │
│  │   │ source_id,      │                                        │   │
│  │   │ dimension_id    │     ┌───────────────────┐              │   │
│  │   └─────────────────┘     │ file_metadata     │              │   │
│  │                           │ id, user_id,      │              │   │
│  │   ┌─────────────────┐     │ file_name, path,  │              │   │
│  │   │ document_       │     │ dify_file_id,     │              │   │
│  │   │ embeddings      │     │ extracted_text_   │              │   │
│  │   │ id, user_id,    │     │ path              │              │   │
│  │   │ source_type,    │     └───────────────────┘              │   │
│  │   │ source_id,      │                                        │   │
│  │   │ chunk_index,    │     ┌───────────────────┐              │   │
│  │   │ content,        │     │ deletion_audit    │  (service    │   │
│  │   │ embedding       │     │ id, deleted_user, │   role only) │   │
│  │   │ (vector 1536)   │     │ deleted_at,       │              │   │
│  │   │ HNSW index      │     │ deleted_by        │              │   │
│  │   └─────────────────┘     └───────────────────┘              │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  RLS Policy Summary:                                                  │
│  • user_profiles, action_items, investment_selections → full CRUD     │
│  • conversations, messages → SELECT + INSERT only (append-only)       │
│  • onboarding_summaries, evaluations → SELECT only (server upserts)   │
│  • file_metadata → SELECT + INSERT only                               │
│  • app_config → SELECT only (global read, service_role writes)        │
│  • deletion_audit → no public access                                  │
│  • document_embeddings → scoped by user_id in search function         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 11. Serverless API Layer

All serverless functions live in `/api` and deploy as Vercel functions. Every endpoint validates JWTs via `_auth.js` middleware.

```
┌──────────────────────────────────────────────────────────────────┐
│                    VERCEL SERVERLESS FUNCTIONS                     │
│                                                                   │
│  Shared Utilities (not endpoints — prefixed with _)               │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ _auth.js │  │_shared.js│  │_supabase.js│  │_webhookAuth  │  │
│  │ JWT      │  │ API key  │  │ Admin      │  │ .js          │  │
│  │ verify   │  │ routing  │  │ client     │  │ Dify webhook │  │
│  └──────────┘  └──────────┘  └────────────┘  └──────────────┘  │
│                                                                   │
│  Endpoints:                                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  POST /api/chat                                            │  │
│  │  Proxies to Dify /chat-messages (onboarding + deep-dive)   │  │
│  │  Supports streaming (SSE) and blocking modes               │  │
│  │  Post-processes: extracts file text → chunks → embeds      │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  POST /api/upload                                          │  │
│  │  Proxies multipart file upload to Dify /files/upload       │  │
│  │  Body parser disabled for streaming pass-through           │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  POST /api/summary                                         │  │
│  │  Upserts onboarding summary → chunks → embeds to pgvector  │  │
│  │  Also embeds conversation messages                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  POST /api/evaluation/generate  (Edge Runtime)             │  │
│  │  Phase 1: 10 parallel KB searches → Dify Workflow → SSE    │  │
│  │  Transforms Dify node events → category_started/complete   │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  POST /api/evaluation/investment-match  (Edge Runtime)     │  │
│  │  Phase 2: category results → Dify Workflow → SSE           │  │
│  │  Transforms events → maturity + investment recommendations │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  POST /api/evaluation/save                                 │  │
│  │  Persists evaluation + investment data + action items       │  │
│  │  Merge logic: new action_keys appended, existing preserved │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  POST /api/knowledge/embed                                 │  │
│  │  Ingestion endpoint for embedding documents into KB        │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  POST /api/chat/stop                                       │  │
│  │  Stops a streaming Dify response (task_id based)           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  API Key Routing (_shared.js):                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  workflow: 'onboarding'  → DIFY_ONBOARDING_API_KEY       │    │
│  │  workflow: 'deepdive'    → DIFY_DEEPDIVE_API_KEY         │    │
│  │  workflow: 'action_item' → DIFY_DEEPDIVE_API_KEY         │    │
│  │  workflow: 'evaluation'  → DIFY_EVALUATION_API_KEY       │    │
│  │  workflow: 'investment'  → DIFY_INVESTMENT_API_KEY        │    │
│  │  (missing key → falls back to onboarding key)            │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 12. Data Persistence & Restoration

On login, all persisted data is restored so the user sees their last state. Persistence is fire-and-forget for non-critical writes to avoid blocking the UI.

```
┌──────────────────────────────────────────────────────────────────┐
│              DATA PERSISTENCE & RESTORATION FLOW                  │
│                                                                   │
│  ═══ ON LOGIN (restoreUserData) ═══                              │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Parallel reads via supabase-js (RLS enforced):          │    │
│  │                                                          │    │
│  │  loadOnboardingSummary() ──▶ onboardingSummary +         │    │
│  │                              onboardingPhase             │    │
│  │  loadEvaluation() ─────────▶ evaluationData +            │    │
│  │                              investmentData              │    │
│  │  loadInvestmentSelections()─▶ selectedInvestments         │    │
│  │  loadActionItems() ────────▶ actionItems                 │    │
│  │  loadOnboardingConversation()▶ conversationId + messages  │    │
│  │  loadDeepDiveConversations()─▶ categoryConversations      │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ═══ DURING USE (fire-and-forget writes) ═══                     │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Event                      Persistence call             │    │
│  │  ─────                      ─────────────────            │    │
│  │  Chat message sent/received persistConversationExchange() │    │
│  │  Summary generated          POST /api/summary             │    │
│  │  Evaluation complete        POST /api/evaluation/save     │    │
│  │  Investment toggled         upsertInvestmentSelection()   │    │
│  │  Action item created        saveActionItem()              │    │
│  │  Action item status changed updateActionItemStatus()      │    │
│  │  Investment deselected      deleteActionItemsBySourceId() │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ═══ RE-EVALUATION MERGE STRATEGY ═══                            │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Evaluation data:  UPSERT (completely replaces)           │    │
│  │  Investment data:  UPSERT (completely replaces)           │    │
│  │  Action items:     APPEND-ONLY from AI                    │    │
│  │    • New action_key → INSERT                              │    │
│  │    • Existing action_key → SKIP (preserve user edits)     │    │
│  │    • Removed from new results → KEEP (no deletion)        │    │
│  │    • Only user can mark complete or remove                │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 13. Action Item Lifecycle

Action items are generated from three sources and managed through a unified lifecycle.

```
┌──────────────────────────────────────────────────────────────────┐
│                    ACTION ITEM LIFECYCLE                           │
│                                                                   │
│  ═══ SOURCES ═══                                                  │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ EVALUATION      │  │ INVESTMENT      │  │ DUE DILIGENCE   │  │
│  │ (AI-generated)  │  │ (AI next_steps) │  │ (Checklist)     │  │
│  │                 │  │                 │  │                 │  │
│  │ sourceType:     │  │ sourceType:     │  │ sourceType:     │  │
│  │  'evaluation'   │  │  'investment'   │  │  'due_diligence'│  │
│  │ sourceId: null  │  │ sourceId:       │  │ sourceId:       │  │
│  │ dimensionId:    │  │'investment_     │  │  investment ID  │  │
│  │  category ID    │  │  matching'      │  │                 │  │
│  │                 │  │                 │  │ Triggered on    │  │
│  │ From evaluation │  │ From LLM       │  │ investment      │  │
│  │ gaps analysis   │  │ next_steps[]   │  │ toggle ON       │  │
│  │ (max 5/category)│  │ on eval done   │  │ Removed on      │  │
│  │                 │  │                 │  │ toggle OFF      │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                     │           │
│           └────────────────────┼─────────────────────┘           │
│                                ▼                                 │
│                    ┌──────────────────────┐                      │
│                    │    ACTION ITEM       │                      │
│                    │    { id (UUID),      │                      │
│                    │      title,          │                      │
│                    │      description,    │                      │
│                    │      priority,       │                      │
│                    │      status,         │                      │
│                    │      sourceType,     │                      │
│                    │      sourceId,       │                      │
│                    │      dimensionId,    │                      │
│                    │      actionKey }     │                      │
│                    └──────────┬───────────┘                      │
│                               │                                  │
│  ═══ STATUS TRANSITIONS ═══  │                                   │
│                               ▼                                  │
│            ┌──────────┐  ┌───────────┐  ┌───────────┐           │
│            │ pending  │─▶│in-progress│─▶│ completed │           │
│            └──────────┘  └───────────┘  └───────────┘           │
│                                                                   │
│  ═══ PRIORITY LEVELS ═══                                         │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ CRITICAL │  │   HIGH   │  │  MEDIUM  │  │   LOW    │        │
│  │ (#ef4444)│  │ (#f59e0b)│  │ (#6366f1)│  │ (#64748b)│        │
│  │ Score: 1 │  │ Score: 2 │  │ Score: 3 │  │ Score: 4+│        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                   │
│  Evaluation action items map performance score to priority:       │
│  dimension score 1 → critical, 2 → high, 3 → medium              │
│  Each action specifies type: 'table_stakes' (must-do) or         │
│  'stretch' (nice-to-have) with linked evidence_items[]            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Appendix: Environment Variables

| Variable | Side | Purpose |
|----------|------|---------|
| `VITE_SUPABASE_URL` | Client | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Client | Supabase anon key (safe, RLS enforced) |
| `VITE_DIFY_MOCK` | Client | `true` → client-side mock mode |
| `VITE_DIFY_STREAMING` | Client | `true` → SSE streaming mode |
| `VITE_DEMO_USER_EMAIL` | Client | Demo login email (optional) |
| `VITE_DEMO_USER_PASSWORD` | Client | Demo login password (optional) |
| `SUPABASE_URL` | Server | Supabase URL for serverless functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Admin DB access (never expose) |
| `DIFY_BASE_URL` | Server | Dify API base URL |
| `DIFY_ONBOARDING_API_KEY` | Server | Onboarding workflow key |
| `DIFY_DEEPDIVE_API_KEY` | Server | Deep-dive workflow key |
| `DIFY_EVALUATION_API_KEY` | Server | Evaluation workflow key (Phase 1) |
| `DIFY_INVESTMENT_API_KEY` | Server | Investment workflow key (Phase 2) |
| `OPENAI_API_KEY` | Server | Embedding generation |
| `ACTIVE_KNOWLEDGE_BASE` | Server | KB selection (`internal` or partner ID) |
| `DIFY_WEBHOOK_SECRET` | Server + Dify | Webhook authentication |
