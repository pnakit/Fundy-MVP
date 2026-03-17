# Fundy — Executive Summary

**Fundy** is an AI-powered startup evaluation platform that guides founders through a structured assessment of their company across 10 business dimensions, generates a comprehensive investment-readiness evaluation, and matches them with suitable funding types — all through a conversational interface.

---

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Onboarding │────▶│  Deep-Dive   │────▶│   Evaluation    │────▶│   Investment     │
│  Chat       │     │  Follow-ups  │     │   Generation    │     │   Matching       │
│             │     │              │     │                 │     │                  │
│ AI-guided   │     │ Per-category │     │ 10-dimension    │     │ 6 funding types  │
│ Q&A across  │     │ conversations│     │ scoring with    │     │ scored & ranked  │
│ 10 business │     │ to fill gaps │     │ action items    │     │ with due         │
│ dimensions  │     │              │     │                 │     │ diligence tasks  │
└─────────────┘     └──────────────┘     └─────────────────┘     └──────────────────┘
```

## The 10 Evaluation Dimensions

| Dimension | What It Covers |
|-----------|---------------|
| Product & Technology | Tech stack, IP, scalability, product stage |
| Market Traction | Revenue, customers, growth metrics |
| Business Model | Unit economics, pricing, scalability |
| Team & Organization | Founders, hiring, org structure |
| Go-to-Market | Channels, strategy, customer acquisition |
| Financial Health | Runway, burn rate, cash flow |
| Fundraising & Capital | Prior rounds, investor relations |
| Competitive Position | Moats, market share, differentiation |
| Operations | Processes, infrastructure, compliance |
| Legal & Compliance | IP protection, regulatory, contracts |

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + Vite | Single-page app with real-time streaming UI |
| **AI Engine** | Dify + OpenAI GPT-4o-mini | Multi-workflow AI (Dify) + lightweight analysis (direct OpenAI) |
| **Auth & Database** | Supabase (Postgres + RLS) | Authentication, persistence, row-level security |
| **Vector Search** | pgvector + OpenAI Embeddings | Semantic search over company data for context-aware evaluation |
| **Serverless API** | Vercel Edge Functions | JWT-secured endpoints, SSE streaming, Dify proxy |
| **Deployment** | Vercel | Auto-deploy, custom domain (fundy.nusuai.com) |

## Key Outputs

- **Maturity Score** (1–5): Where the company sits on the Concept → Leader spectrum
- **Performance Scores**: Per-dimension 1–5 ratings with descriptions
- **Radar Chart**: Visual snapshot of strengths and gaps across all 10 dimensions
- **Action Items**: Prioritized, specific tasks generated from evaluation gaps — with per-item chat, file uploads, and AI-powered status refresh that searches the knowledge base to assess whether each item has been addressed
- **Investment Match**: 6 funding types scored 0–100 with fit explanations, requirements, and due diligence checklists
- **Improvement Roadmap**: Sequenced actions that unlock funding eligibility

## Security Model

All user data is isolated via Supabase Row-Level Security — every query is scoped to `auth.uid()`. JWTs are validated on every API call. The Dify AI engine never has direct database access; all data flows through authenticated Vercel serverless functions.

## Current State (v4.0)

- 198 automated tests across 14 files
- Full auth flow (email + OTP)
- Onboarding, evaluation, and investment persistence to Supabase
- Streaming AI responses with progressive UI rendering
- Knowledge base embedding and semantic retrieval operational
- Action item refresh: vector search + LLM classification per item
- Deployed and accessible at **fundy.nusuai.com**
