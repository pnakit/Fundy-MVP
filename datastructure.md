# Data Structure — Dify Workflow I/O Contracts

Reference document defining the exact input/output contracts for every Dify workflow, the data that flows between them, and the database schema alignment. This is the source of truth for building both the Dify workflows and the app-side parsing/persistence logic.

**Status**: Draft — evaluation and investment data structures under active revision.

---

## Workflow Chain Overview

```
WORKFLOW 1: Onboarding Chat ─────────────────┐
  (conversational, multi-turn)                │
  Output: Onboarding Summary JSON ────────────┤
                                              │
WORKFLOW 2: Deep-Dive Chat                    │
  (conversational, per-category, multi-turn)  │
  Output: Enriched understanding (not passed  │
  to downstream workflows in MVP)             │
                                              ▼
                                   ┌─────────────────────┐
                                   │ Input:               │
                                   │  • Summary JSON only │
                                   └──────────┬──────────┘
                                              │
                                              ▼
WORKFLOW 3: Evaluation Generation ────────────┤
  (one-shot, structured output)               │
  Output: Evaluation + Action Items ──────────┤
                                              │
                                              ▼
WORKFLOW 4: Investment Matching ──────────────┘
  (one-shot, structured output)
  Output: Investment Recommendations + Per-Investment Actions
```

**Orchestration model:** Client-side. The React app calls each workflow sequentially, passing the output of one as input to the next. No Dify-to-Dify communication.

**Dify app types:**
- Workflows 1 & 2: Chat apps (multi-turn, conversational)
- Workflows 3 & 4: Workflow apps (single-shot, structured I/O)

---

## Shared Constants

All workflows use the same 10 dimension IDs. These are defined in `src/data/mockData.js` as `EVALUATION_DIMENSIONS` and `ONBOARDING_CATEGORIES`.

| ID | Title | Short Title | Icon |
|----|-------|-------------|------|
| `product_technology` | Product & Technology | Product | 🔧 |
| `market_traction` | Market Traction & Revenue | Market | 📈 |
| `business_model` | Business Model & Economics | Business | 💡 |
| `team_organization` | Team & Organization | Team | 👥 |
| `go_to_market` | Go-to-Market | GTM | 🚀 |
| `financial_health` | Financial Health | Finance | 💰 |
| `fundraising_capital` | Fundraising & Capital | Fundraising | 🏦 |
| `competitive_position` | Competitive Position | Competition | 🏆 |
| `operations` | Operations | Ops | ⚙️ |
| `legal_compliance` | Legal & Compliance | Legal | ⚖️ |

---

## Workflow 1: Onboarding Chat (EXISTS)

**Dify app type:** Chat
**API endpoint:** `POST /chat-messages` (via `POST /api/chat`)
**API key:** `DIFY_ONBOARDING_API_KEY`
**Prompt instructions:** See `dify-onboarding-prompt.md`
**Client parser:** `extractOnboardingSummary()` in `src/utils/extractSummary.js`

### Input (per message)

```json
{
  "query": "user message text",
  "conversation_id": "existing-id or empty for first message",
  "response_mode": "blocking | streaming",
  "user": "supabase-user-uuid",
  "files": [
    { "type": "document", "transfer_method": "local_file", "upload_file_id": "dify-file-id" }
  ],
  "inputs": {}
}
```

### Output (final message — structured summary)

The LLM outputs a conversational closing paragraph followed by a JSON block wrapped in delimiters:

```
Thank you for sharing all this information! I've compiled everything into
a comprehensive evaluation across 10 key dimensions.

[ONBOARDING_SUMMARY]
{
  "version": "1.0",
  "companyName": "Acme Corp",
  "generatedAt": "2026-02-28T14:30:00.000Z",
  "overallCompleteness": 68,
  "categories": [
    {
      "id": "product_technology",
      "title": "Product & Technology",
      "summary": "SaaS platform with proprietary ML pipeline...",
      "completeness": 85,
      "status": "complete",
      "highlights": [
        "Proprietary ML model with 3x benchmark performance",
        "API-first architecture enables rapid integration"
      ],
      "gaps": [
        "No patent filings documented",
        "Technical debt assessment missing"
      ],
      "keyMetrics": {
        "techStackMaturity": "Advanced",
        "ipProtection": "Low",
        "productStage": "Growth"
      },
      "deepDivePrompt": "Let's dive deeper into your product and technology. Based on what you shared, I'd like to explore your IP strategy, technical debt, and product roadmap in more detail."
    }
  ]
}
[/ONBOARDING_SUMMARY]
```

### Output field definitions

| Field | Type | Rule |
|-------|------|------|
| `version` | string | Always `"1.0"` |
| `companyName` | string | From conversation, or `"Your Company"` if not stated |
| `generatedAt` | string | ISO 8601 timestamp |
| `overallCompleteness` | integer | 0-100, weighted average of category completeness scores |
| `categories` | array | Exactly 10 items, all dimension IDs present |

**Per-category fields:**

| Field | Type | Rule |
|-------|------|------|
| `id` | string | One of the 10 valid dimension IDs |
| `title` | string | Matching title for the dimension |
| `summary` | string | 1-2 sentence summary of what was learned |
| `completeness` | integer | 0-100 — how much information was provided |
| `status` | string | Derived: `>=70` → `"complete"`, `>=40` → `"needs_attention"`, `<40` → `"incomplete"` |
| `highlights` | string[] | 1-3 key strengths or findings |
| `gaps` | string[] | 1-3 pieces of missing information |
| `keyMetrics` | object | 2-4 string key-value pairs of relevant data points |
| `deepDivePrompt` | string | 2-3 sentence personalized opener for follow-up conversation |

**Completeness scoring guidelines:**

| Score | Meaning |
|-------|---------|
| 80-100 | Detailed, specific information with metrics or evidence |
| 60-79 | Good context but missing some specifics or quantitative data |
| 40-59 | Mentioned briefly or at a high level only |
| 20-39 | Minimal information or only tangentially related details |
| 0-19 | Not discussed at all |

### Client-side validation (`extractOnboardingSummary`)

1. Find `[ONBOARDING_SUMMARY]` and `[/ONBOARDING_SUMMARY]` markers
2. Strip markdown code fences, fix trailing commas
3. `JSON.parse()` — fail with `parse_error` if invalid
4. Validate `categories` array exists and has >= 5 items
5. Filter to valid dimension IDs only
6. Normalize each category: coerce `completeness` to 0-100 integer, derive `status`, fill defaults
7. Fill missing categories with placeholders (completeness 0, status `'incomplete'`)
8. Sort to match `ONBOARDING_CATEGORIES` order
9. Recalculate `overallCompleteness`

### DB writes

| Table | Column | Data |
|-------|--------|------|
| `conversations` | `workflow`, `dify_conversation_id` | `'onboarding'`, Dify's conversation ID |
| `messages` | `role`, `content`, `metadata` | Full chat history (user + assistant) |
| `onboarding_summaries` | `summary_data` | Parsed + validated summary JSON |

---

## Workflow 2: Deep-Dive Chat (EXISTS)

**Dify app type:** Chat
**API endpoint:** `POST /chat-messages` (via `POST /api/chat`)
**API key:** `DIFY_DEEPDIVE_API_KEY` (falls back to onboarding key if missing)
**Client handler:** `handleDeepDiveSendMessage()` in `App.jsx`

### Input (per message)

```json
{
  "query": "user message text",
  "conversation_id": "per-category-conversation-id",
  "response_mode": "blocking | streaming",
  "user": "supabase-user-uuid",
  "files": [
    { "type": "document", "transfer_method": "local_file", "upload_file_id": "dify-file-id" }
  ],
  "inputs": {
    "category_id": "product_technology"
  }
}
```

### Output

Unstructured conversational text. No markers or structured JSON.

The deep-dive workflow receives `category_id` via `inputs` and should tailor its conversation to that specific evaluation dimension. The first message in each deep-dive conversation is the `deepDivePrompt` from the onboarding summary (displayed as an assistant message before the user sends anything).

### DB writes

| Table | Column | Data |
|-------|--------|------|
| `conversations` | `workflow`, `category_id`, `dify_conversation_id` | `'deepdive'`, category ID, Dify's conversation ID |
| `messages` | `role`, `content`, `metadata` | Per-category chat history |

### Deep-dive → Evaluation data flow

**Decision:** Workflow 3 receives the onboarding summary only. Deep-dive conversations enrich understanding but are not directly passed to the evaluation workflow. This keeps the evaluation input compact and predictable.

**Future enhancement:** After deep-dive, regenerate the summary for that category (new LLM call) → better evaluation input. Or pass summary + condensed deep-dive transcripts to Workflow 3.

---

## Workflow 3: Evaluation Generation (NEW)

**Dify app type:** Workflow (single-shot, not conversational)
**API endpoint:** `POST /workflows/run` (new proxy endpoint: `POST /api/workflow`)
**API key:** `DIFY_EVALUATION_API_KEY` (new)
**Client parser:** `extractEvaluation()` (to be built, similar to `extractOnboardingSummary()`)
**Trigger:** User clicks "Generate Evaluation" after onboarding is complete

### Input

```json
{
  "inputs": {
    "user_id": "supabase-user-uuid",
    "onboarding_summary": "{...stringified onboarding summary JSON...}"
  },
  "user": "supabase-user-uuid"
}
```

The `onboarding_summary` field contains the full validated output from Workflow 1 — all 10 categories with completeness scores, highlights, gaps, key metrics, and summaries.

### What the LLM analyzes per dimension

| Summary Field | Informs |
|---------------|---------|
| `completeness` | Higher completeness = more evidence available = potentially higher maturity |
| `highlights` | Strengths → higher performance score |
| `gaps` | Weaknesses → lower performance score, triggers action item generation |
| `keyMetrics` | Quantitative evidence for maturity/performance assessment |
| `summary` | Qualitative context for the dimension's description paragraph |

### Output (structured JSON with markers)

```
[EVALUATION_RESULT]
{
  "evaluation": {
    "overallMaturity": {
      "level": 3,
      "name": "Validated"
    },
    "overallPerformance": {
      "score": 3.2,
      "label": "Average"
    },
    "description": "Your company has validated its core offering and is building toward scale, with strong product execution but gaps in legal readiness and financial planning.",
    "dimensions": [
      {
        "id": "product_technology",
        "maturityLevel": 4,
        "performanceScore": 4,
        "description": "Strong technical foundation with proprietary ML pipeline and API-first architecture. Good scalability but IP protection strategy needs attention."
      },
      {
        "id": "market_traction",
        "maturityLevel": 3,
        "performanceScore": 3,
        "description": "Growing MRR with strong net retention. Customer acquisition cost trending down. Total addressable market analysis still needed."
      }
    ]
  },
  "actionItems": [
    {
      "actionKey": "gdpr-compliance",
      "title": "GDPR Compliance Audit",
      "description": "Review data handling practices for EU regulatory compliance",
      "priority": "critical",
      "dimensionId": "legal_compliance"
    },
    {
      "actionKey": "cash-flow-forecast",
      "title": "Cash Flow Forecast",
      "description": "Build 12-month cash flow projection with scenario modeling",
      "priority": "high",
      "dimensionId": "financial_health"
    }
  ]
}
[/EVALUATION_RESULT]
```

### Output field definitions — Evaluation

| Field | Type | Rule |
|-------|------|------|
| `overallMaturity.level` | integer | 1-5, derived from dimension maturity average (rounded) |
| `overallMaturity.name` | string | Must match level: 1=Concept, 2=Early, 3=Validated, 4=Scaling, 5=Leader |
| `overallPerformance.score` | float | 1.0-5.0, average of dimension performance scores (1 decimal place) |
| `overallPerformance.label` | string | Must match score: <=1.5=Poor, <=2.5=Fair, <=3.5=Average, <=4.5=Good, >4.5=Exceptional |
| `description` | string | 2-3 sentence overall assessment |
| `dimensions` | array | Exactly 10 items, all valid dimension IDs |

**Per-dimension fields:**

| Field | Type | Rule |
|-------|------|------|
| `id` | string | One of the 10 valid dimension IDs |
| `maturityLevel` | integer | 1-5 |
| `performanceScore` | integer | 1-5 |
| `description` | string | 2-3 sentences describing the company's position in this dimension |

**Maturity scale:**

| Level | Name | Meaning |
|-------|------|---------|
| 1 | Concept | Idea stage, no implementation |
| 2 | Early | Initial implementation, limited validation |
| 3 | Validated | Core offering proven, building toward scale |
| 4 | Scaling | Actively scaling, processes maturing |
| 5 | Leader | Market leader, mature operations |

**Performance scale:**

| Score | Label | Meaning |
|-------|-------|---------|
| 1 | Poor | Fundamental gaps, immediate attention needed |
| 2 | Fair | Below average, significant improvement needed |
| 3 | Average | Meeting basic expectations, room for growth |
| 4 | Good | Above average, strong execution |
| 5 | Exceptional | Outstanding, industry-leading |

### Output field definitions — Action Items

| Field | Type | Rule |
|-------|------|------|
| `actionKey` | string | Unique kebab-case identifier (e.g., `"gdpr-compliance"`) |
| `title` | string | Short action title |
| `description` | string | 1-2 sentence description of what needs to be done |
| `priority` | string | One of: `"critical"`, `"high"`, `"medium"`, `"low"` |
| `dimensionId` | string | One of the 10 valid dimension IDs |

**Action item generation logic:**
- Focus on dimensions with `performanceScore` <= 3
- More action items for lower-scoring dimensions
- Priority mapping: score 1 → critical actions, score 2 → high, score 3 → medium
- Each action must be specific and actionable (not generic advice)
- Expect 8-15 total action items across all dimensions

### Client-side validation (`extractEvaluation`)

1. Find `[EVALUATION_RESULT]` and `[/EVALUATION_RESULT]` markers
2. Strip markdown code fences, fix trailing commas
3. `JSON.parse()` — fail with `parse_error` if invalid
4. Validate `evaluation.dimensions` has exactly 10 items with valid IDs
5. Validate all `maturityLevel` values are integers 1-5
6. Validate all `performanceScore` values are integers 1-5
7. Recalculate `overallMaturity.level` and `overallPerformance.score` from dimensions (verify LLM math)
8. Derive `overallMaturity.name` and `overallPerformance.label` from calculated values
9. Validate `actionItems` — all have required fields, valid `dimensionId`, valid `priority`
10. Assign client-side IDs to action items (incrementing counter)

### DB writes

| Table | Column | Data |
|-------|--------|------|
| `evaluations` | `maturity_stage` | `overallMaturity` object (JSONB) |
| `evaluations` | `dimensions` | dimensions array (JSONB) |
| `evaluations` | `performance_metrics` | `overallPerformance` object (JSONB) |
| `action_items` | all columns | Batch insert, `source_type='evaluation'`, `source_id=NULL`, each with `dimension_id` |

---

## Workflow 4: Investment Matching (NEW)

**Dify app type:** Workflow (single-shot, not conversational)
**API endpoint:** `POST /workflows/run` (via `POST /api/workflow`)
**API key:** `DIFY_INVESTMENT_API_KEY` (new)
**Client parser:** `extractInvestments()` (to be built)
**Trigger:** Automatically chained after Workflow 3 completes

### Input

```json
{
  "inputs": {
    "user_id": "supabase-user-uuid",
    "evaluation": "{...stringified evaluation JSON from Workflow 3...}"
  },
  "user": "supabase-user-uuid"
}
```

The `evaluation` field contains the full evaluation output — overall scores + all 10 dimension scores and descriptions. The LLM uses this to assess readiness for each investment type.

### What the LLM maps from evaluation dimensions to investment scores

| Evaluation Dimension | Influences |
|---|---|
| Product & Technology (maturity + performance) | Seed (MVP readiness), Series A (scalability) |
| Market Traction (performance) | Series A (PMF evidence), Seed (initial traction) |
| Business Model (performance) | Series A (scalable model), Venture Debt (profitability path) |
| Financial Health (performance) | Venture Debt (recurring revenue), all (runway assessment) |
| Fundraising & Capital (maturity) | Series A (prior rounds), Venture Debt (existing VC backing) |
| Team (performance) | Seed (founding team), Strategic (partnership capability) |
| Competitive Position (performance) | Strategic (market position), Grants (innovation) |
| Operations (performance) | Grants (job creation), Strategic (integration readiness) |
| Legal & Compliance (performance) | All (due diligence readiness) |
| GTM (performance) | Crowdfunding (marketing capability), Series A (growth motion) |

### Output (structured JSON with markers)

```
[INVESTMENT_RESULT]
{
  "investments": [
    {
      "id": "seed",
      "type": "Seed Funding",
      "description": "Early-stage capital for product development and initial market validation",
      "suitability": 45,
      "minAmount": "$250K",
      "maxAmount": "$2M",
      "timeline": "3-6 months",
      "requirements": ["MVP", "Initial traction", "Founding team"],
      "status": "partial_match",
      "rationale": "Strong product but limited market validation reduces seed attractiveness at this stage.",
      "actions": [
        {
          "actionKey": "prepare-pitch-deck",
          "title": "Prepare Pitch Deck",
          "description": "Create a compelling 10-15 slide pitch deck",
          "priority": "high"
        },
        {
          "actionKey": "financial-projections-seed",
          "title": "Financial Projections",
          "description": "Build 3-year financial model with key assumptions",
          "priority": "high"
        }
      ]
    },
    {
      "id": "series_a",
      "type": "Series A",
      "description": "Growth capital for scaling operations and expanding market reach",
      "suitability": 82,
      "minAmount": "$2M",
      "maxAmount": "$15M",
      "timeline": "4-8 months",
      "requirements": ["Product-market fit", "Revenue traction", "Scalable model"],
      "status": "strong_match",
      "rationale": "Validated product with growing revenue makes Series A the strongest match.",
      "actions": [
        {
          "actionKey": "data-room-setup",
          "title": "Data Room Setup",
          "description": "Compile due diligence documents in organized data room",
          "priority": "critical"
        },
        {
          "actionKey": "growth-metrics-dashboard",
          "title": "Growth Metrics Dashboard",
          "description": "Prepare detailed metrics and KPI tracking",
          "priority": "high"
        }
      ]
    }
  ]
}
[/INVESTMENT_RESULT]
```

### Output field definitions — Investments

| Field | Type | Rule |
|-------|------|------|
| `investments` | array | Exactly 6 items, all required IDs present |

**Per-investment fields:**

| Field | Type | Rule |
|-------|------|------|
| `id` | string | One of: `seed`, `series_a`, `venture_debt`, `grants`, `strategic`, `crowdfunding` |
| `type` | string | Human-readable investment type name |
| `description` | string | 1-2 sentence tailored description based on company profile |
| `suitability` | integer | 0-100, overall match score |
| `minAmount` | string | Typical minimum investment amount (formatted with `$` and abbreviations) |
| `maxAmount` | string | Typical maximum investment amount |
| `timeline` | string | Typical process timeline (e.g., `"3-6 months"`) |
| `requirements` | string[] | 2-4 key requirements for this investment type |
| `status` | string | Derived from suitability: `>=75` → `strong_match`, `>=50` → `moderate_match`, `>=30` → `partial_match`, `<30` → `weak_match` |
| `rationale` | string | 1-2 sentence explanation of why this suitability score was given |
| `actions` | array | 2-4 action items specific to pursuing this investment type |

**Per-investment action fields:**

| Field | Type | Rule |
|-------|------|------|
| `actionKey` | string | Unique kebab-case identifier |
| `title` | string | Short action title |
| `description` | string | 1-2 sentence description |
| `priority` | string | One of: `"critical"`, `"high"`, `"medium"`, `"low"` |

### Investment type definitions

The LLM must always evaluate these 6 investment types:

| ID | Type | What the LLM assesses |
|---|---|---|
| `seed` | Seed Funding | Early-stage readiness: MVP, team, initial traction |
| `series_a` | Series A | Growth readiness: product-market fit, revenue, scalable model |
| `venture_debt` | Venture Debt | Debt readiness: existing VC backing, recurring revenue, profitability path |
| `grants` | Government Grants | Grant eligibility: innovation focus, R&D activity, local impact |
| `strategic` | Strategic Investment | Strategic value: market position, partnership potential, synergies |
| `crowdfunding` | Equity Crowdfunding | Crowd appeal: consumer brand, community, marketing capability |

### Suitability scoring guidelines

| Score Range | Label | Meaning |
|---|---|---|
| 75-100 | `strong_match` | Strong alignment — most requirements met |
| 50-74 | `moderate_match` | Moderate alignment — key requirements partially met |
| 30-49 | `partial_match` | Partial alignment — significant gaps remain |
| 0-29 | `weak_match` | Weak alignment — fundamental requirements unmet |

### Client-side validation (`extractInvestments`)

1. Find `[INVESTMENT_RESULT]` and `[/INVESTMENT_RESULT]` markers
2. Strip markdown code fences, fix trailing commas
3. `JSON.parse()` — fail with `parse_error` if invalid
4. Validate `investments` array has exactly 6 items with all required IDs
5. Validate `suitability` is integer 0-100 for each
6. Derive `status` from `suitability` (verify LLM's status matches the score)
7. Validate `actions` arrays — all have required fields, valid priorities
8. Validate `requirements` arrays — 2-4 strings each

### DB writes

| Table | Column | Data |
|-------|--------|------|
| `investment_recommendations` (NEW) | `recommendations` | Full investment output (JSONB), upsert per user |
| *(on user toggle)* `investment_selections` | `investment_type`, `selected` | User's investment selections |
| *(on user toggle)* `action_items` | all columns | `source_type='investment'`, `source_id=investmentId`, actions from selected investment |

---

## Client-Side Orchestration Flow

```
User clicks "Generate Evaluation"
  │
  ├─ 1. Client reads onboarding summary from state (or fetches from Supabase)
  │
  ├─ 2. POST /api/workflow
  │     Body: { workflow: 'evaluation', inputs: { onboarding_summary: JSON.stringify(summary) } }
  │     └─ Vercel proxy → DIFY_EVALUATION_API_KEY → Dify Workflow 3
  │     └─ Returns: evaluation + action items JSON
  │
  ├─ 3. Client parses + validates evaluation output
  │     └─ extractEvaluation(response) — marker-based extraction + validation
  │     └─ Saves to `evaluations` table + `action_items` table
  │     └─ Updates UI: evaluation window shows real data
  │
  ├─ 4. POST /api/workflow
  │     Body: { workflow: 'investment', inputs: { evaluation: JSON.stringify(evaluationData) } }
  │     └─ Vercel proxy → DIFY_INVESTMENT_API_KEY → Dify Workflow 4
  │     └─ Returns: investment recommendations JSON
  │
  ├─ 5. Client parses + validates investment output
  │     └─ extractInvestments(response) — marker-based extraction + validation
  │     └─ Saves to `investment_recommendations` table
  │     └─ Updates UI: investment window shows real data
  │
  └─ 6. UI ready
        └─ User browses evaluation dimensions, expands descriptions
        └─ User selects investments → per-investment actions added to action items list
        └─ User manages action items (status, notes, files)
```

---

## New Infrastructure Required

### New Vercel proxy endpoint

`POST /api/workflow` — proxies to Dify's `POST /workflows/run` endpoint. Same auth pattern as `api/chat.js` (JWT validation + API key routing).

### New API keys

| Key | Purpose |
|-----|---------|
| `DIFY_EVALUATION_API_KEY` | Dify Workflow app for evaluation generation |
| `DIFY_INVESTMENT_API_KEY` | Dify Workflow app for investment matching |

### New client-side parsers

| Parser | Markers | Similar to |
|--------|---------|------------|
| `extractEvaluation(response)` | `[EVALUATION_RESULT]...[/EVALUATION_RESULT]` | `extractOnboardingSummary()` |
| `extractInvestments(response)` | `[INVESTMENT_RESULT]...[/INVESTMENT_RESULT]` | `extractOnboardingSummary()` |

---

## Database Schema Alignment

### Current schema gaps (vs. Architecture.md)

| Gap | Issue | Fix |
|-----|-------|-----|
| No `investment_recommendations` table | Workflow 4 output has no table | Add new table: `id, user_id, recommendations JSONB, created_at, updated_at` with UNIQUE on `user_id` |
| `action_items` missing columns | Schema has `source TEXT` but app uses `sourceType`, `sourceId`, `dimensionId`, `actionKey` | Replace `source` with `source_type`, `source_id`, `dimension_id`, `action_key` columns |
| `action_items.priority` missing `'critical'` | Schema CHECK constraint is `('high', 'medium', 'low')` | Add `'critical'` to CHECK constraint |
| `evaluations` JSONB shapes undocumented | Schema has `maturity_stage`, `dimensions`, `performance_metrics` JSONB columns | Shapes defined in Workflow 3 output above |

### New table: `investment_recommendations`

```sql
CREATE TABLE investment_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendations JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_investment_recommendations_user UNIQUE (user_id)
);

CREATE INDEX idx_investment_recommendations_user_id ON investment_recommendations(user_id);

ALTER TABLE investment_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own recommendations" ON investment_recommendations
  FOR SELECT USING (auth.uid() = user_id);
```

### Updated `action_items` table

```sql
CREATE TABLE action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_key TEXT,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed')),
  source_type TEXT CHECK (source_type IN ('evaluation', 'investment')),
  source_id TEXT,
  dimension_id TEXT,
  file_ids TEXT[],
  custom_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Re-evaluation Strategy

When a user re-runs evaluation (e.g., after more deep-dives):

- **Evaluation data:** Upsert — completely replaces previous evaluation. (Future: version history to track evolution over time.)
- **Investment recommendations:** Upsert — completely replaces previous recommendations. (Future: version history.)
- **Action items are persistent.** Once created, action items remain static unless the user explicitly addresses them (changes status, marks complete). On re-evaluation:
  - New action items (new `action_key` not in existing set) → **added** to the list
  - Existing action items that still appear in new results → **kept as-is** with all user modifications (status, notes, files) preserved
  - Existing action items that no longer appear in new results → **kept as-is** (they don't disappear)
  - Action items only leave the list when the user marks them completed or manually removes them
- **Action items (investment-sourced):** Independently managed — tied to user investment selections, unaffected by re-evaluation.

### Action item merge logic (on re-evaluation)

```
For each new action item from Workflow 3:
  IF action_key already exists in user's action_items:
    → SKIP (keep existing item with user's modifications)
  ELSE:
    → INSERT as new item (status='pending')

Existing items whose action_key is NOT in new results:
  → KEEP (no deletion)
```

This means the action item list is **append-only** from the AI's perspective. Only the user can remove or complete items.

---

## Resolved Design Decisions

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Deep-dive → Evaluation input | Summary-only for MVP | Keeps input compact; deep-dive enrichment is a future enhancement |
| 2 | Investment recommendations storage | New `investment_recommendations` table | Cleaner separation from evaluations, independent lifecycle |
| 3 | Workflows 3+4 architecture | Two separate independent Dify Workflow apps | Simpler to build, test, and debug independently |
| 4 | Re-evaluation data replacement | Upsert (replace) evaluation + investment data | Version history for tracking evolution is a future enhancement |
| 5 | Action item persistence on re-evaluation | Preserve all user modifications; append-only from AI | Action items remain static unless the user explicitly addresses them |
