# Dify Evaluation Workflow Setup Guide

## Overview

This document describes how to create the evaluation workflow in Dify Studio. The workflow receives pre-retrieved context for each of the 10 evaluation categories and runs 10 parallel LLM branches to produce structured evaluation results.

**Workflow type**: Workflow (not Chatflow) — single-execution automation triggered via API.

## Creating the Workflow in Dify Studio

### Step 1: Create the app
- In Dify Studio, click **Create App** → select **Workflow** (not Chatflow)
- Name it something like "Startup Evaluation"

### Step 2: Set up per-category Environment Variables

Each of the 10 LLM nodes has its own environment variable containing the category-specific evaluation scorecard. This allows each node to reference only its own evidence items and maturity interpretation.

- Go to **Settings** (gear icon) → **Environment Variables**
- Create **10 environment variables** (type: String), one per category:

| Env Variable | Referenced by node |
|---|---|
| `eval_product_technology` | `eval_product_technology` LLM node |
| `eval_market_traction` | `eval_market_traction` LLM node |
| `eval_business_model` | `eval_business_model` LLM node |
| `eval_team_organization` | `eval_team_organization` LLM node |
| `eval_go_to_market` | `eval_go_to_market` LLM node |
| `eval_financial_health` | `eval_financial_health` LLM node |
| `eval_fundraising_capital` | `eval_fundraising_capital` LLM node |
| `eval_competitive_position` | `eval_competitive_position` LLM node |
| `eval_operations` | `eval_operations` LLM node |
| `eval_legal_compliance` | `eval_legal_compliance` LLM node |

For each env variable, paste the corresponding category scorecard from the **"Environment Variable Content"** section below. Each scorecard contains the 20 evidence items table and the maturity stage interpretation for that category.

### Step 3: Configure the Start node
- The **Start** node is already on the canvas
- Add **12 input variables**: `company_name`, `user_id`, and 10 `context_*` variables
- See "Input Variables" section below for the full list
- The Start node receives these via our API call (`POST /workflows/run`)

### Step 4: Context fallback (DEFERRED)

> **Skipped for now.** Context is always provided by our API (`/api/evaluation/generate`) which does KB retrieval before calling the Dify workflow. The IF/ELSE fallback node (which would let Dify fetch context itself when `context_*` inputs are empty) is only needed if an external knowledge base is used that bypasses our API. Implement this fallback only if/when that use case arises.
>
> For Dify Studio testing without our API, use the "Run" panel and paste context manually into the `context_*` input fields, or leave them blank to test the zero-context path (all items score UNPROVEN).

### Step 5: Add 10 LLM nodes (parallel)
- Drag 10 LLM nodes — they will run in **parallel**
- Name each node exactly as specified in the "Node Naming Convention" section
- Each LLM node reads: its `{{#env.eval_[CATEGORY_ID]#}}` env var + its `context_*` variable
- Use the Prompt Template from the section below for each node's system prompt

### Step 6: Connect to End
- Connect all 10 LLM node outputs directly to the **End** node
- **Do NOT add a Variable Aggregator** — we want each branch to fire `node_finished` independently for streaming

### Trigger
Dify Workflow apps are **API-triggered**. Our serverless function `api/evaluation/generate.js` calls `POST {DIFY_BASE_URL}/workflows/run` with `response_mode: "streaming"`.

**From the user's perspective**: They click "Generate Evaluation" in the webapp → our API does KB retrieval → calls this Dify workflow → streams results back.

### Where things live (single source of truth)

| Component | Location | How to edit |
|-----------|----------|-------------|
| Evaluation criteria (per-category scorecards) | 10 Dify env vars `eval_<category_id>` | Dify Studio → Settings → Environment Variables |
| Search queries for KB retrieval | Supabase `app_config` table, key `evaluation_search_queries` | Supabase Dashboard → Table Editor |
| KB retrieval logic | `api/knowledge/context.js` + `api/evaluation/_categoryContext.js` | Code (serverless functions) |
| LLM prompts | Dify LLM nodes (reference `{{#env.eval_<category_id>#}}`) | Dify Studio → node editor |

## How it's called

Our API endpoint `POST /api/evaluation/generate` does:
1. Authenticates the user (JWT)
2. Queries the knowledge base for each category (10 parallel semantic searches)
3. Assembles context per category (onboarding data + retrieved chunks)
4. Calls this Dify workflow via `POST /workflows/run` with `response_mode: "streaming"`
5. Transforms `node_finished` SSE events into `category_complete` events for the frontend

**The API passes 11 input variables** to the workflow — `company_name` plus one `context_*` field per evaluation category.

## Onboarding-to-Evaluation Mapping (1:1)

Each of the 10 evaluation dimensions has a dedicated onboarding category that feeds it. The mapping is 1:1 — no shared fields.

**Onboarding question mapping**: The onboarding chatflow uses 10 primary questions (one per category) designed to elicit evidence for Concept + Early gate items (items 1-8), with adaptive escalation to probe Validated and Scaling gates when the founder demonstrates maturity. See **`dify-onboarding-prompt.md`** for the full question bank, evidence item mapping, and escalation rules.

| Evaluation Dimension | Category ID | Primary Question | Evidence Items Targeted | Context Variable |
|---------------------|-------------|-----------------|------------------------|------------------|
| Product & Technology | `product_technology` | "Tell me about your product — what problem does it solve, who is it for, and where are you in building it?" | #1-7 (product, problem, users, architecture, customers, features, feedback) | `context_product_technology` |
| Market Traction & Revenue | `market_traction` | "How are you acquiring customers and generating revenue? Walk me through your traction so far." | #1-7 (market, value prop, first customer, revenue model, MRR, channels, retention) | `context_market_traction` |
| Business Model & Economics | `business_model` | "How does your business make money? Tell me about your pricing, costs, and how the economics work." | #1-7 (model, pricing, WTP, tiers, margins, costs, ARPU) | `context_business_model` |
| Team & Organization | `team_organization` | "Tell me about your team — who are the founders, what's everyone's background, and who else have you brought on?" | #1-7 (founders, domain expertise, technical, full-time, hires, roles, compensation) | `context_team_organization` |
| Go-to-Market | `go_to_market` | "How do you find and sell to customers? Walk me through your go-to-market approach." | #1-7 (ICP, distribution, manual sales, motion, website, leads, conversion) | `context_go_to_market` |
| Financial Health | `financial_health` | "What does your financial picture look like — burn rate, runway, and how you track your finances?" | #1-7 (records, burn, revenue, reporting, runway, budget, rev vs expenses) | `context_financial_health` |
| Fundraising & Capital | `fundraising_capital` | "Where are you in your fundraising journey? Have you raised capital, and what are your plans?" | #1-7 (need, use of funds, materials, seed, cap table, relationships, valuation) | `context_fundraising_capital` |
| Competitive Position | `competitive_position` | "Who are your main competitors, and what makes you different?" | #1-7 (competitors, differentiation, awareness, matrix, UVP, preference, switching costs) | `context_competitive_position` |
| Operations | `operations` | "How does your team work day-to-day? What tools and processes keep things running?" | #1-7 (tools, communication, PM, dev process, support, uptime, incidents) | `context_operations` |
| Legal & Compliance | `legal_compliance` | "What's your legal setup? Are you incorporated, and do you have key agreements in place?" | #1-7 (incorporated, founder agreements, ToS, employment, contractor, IP, privacy) | `context_legal_compliance` |

## Input Variables (Start Node)

Configure these in the Start node of the Dify workflow:

| Variable Name | Type | Description |
|--------------|------|-------------|
| `company_name` | String | Company display name |
| `user_id` | String | Supabase user ID (used by HTTP fallback to fetch context) |
| `context_product_technology` | Paragraph | Retrieved context for Product & Technology |
| `context_market_traction` | Paragraph | Retrieved context for Market Traction & Revenue |
| `context_business_model` | Paragraph | Retrieved context for Business Model & Economics |
| `context_team_organization` | Paragraph | Retrieved context for Team & Organization |
| `context_go_to_market` | Paragraph | Retrieved context for Go-to-Market |
| `context_financial_health` | Paragraph | Retrieved context for Financial Health |
| `context_fundraising_capital` | Paragraph | Retrieved context for Fundraising & Capital |
| `context_competitive_position` | Paragraph | Retrieved context for Competitive Position |
| `context_operations` | Paragraph | Retrieved context for Operations |
| `context_legal_compliance` | Paragraph | Retrieved context for Legal & Compliance |

**Use Paragraph type, not String** — String has a 256 character limit, contexts can be much longer.

## Workflow Structure

The workflow uses an Iteration node to fetch context for each category in parallel, then routes assembled context to 10 parallel LLM evaluation nodes.

```
                         START
                           │
             Code 1 (define_categories)
                           │
          Iteration (context_retrieval)   ← parallel mode, max 10
          ┌────────────────────────────┐
          │  Code 2 (build_query)      │  extract query + checklist from item
          │          ↓                 │
          │  HTTP Request (iteration)  │  POST /api/knowledge/context
          │          ↓                 │
          │  Code 3 (format_context)   │  parse JSON response, prepend CATEGORY_ID:
          └────────────────────────────┘
                           │
             Code 4 (route_to_llms)       ← parse CATEGORY_ID → 10 context_* vars
                           │
  ┌────┬────┬────┬────┬────┼────┬────┬────┬────┬────┐
  ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼
 LLM  LLM  LLM  LLM  LLM  LLM  LLM  LLM  LLM  LLM
 P&T  Mkt  Biz  Tm   GTM  Fin  Cap  Cmp  Ops  Lgl
  └────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘
                           │
                          END
```

### Node Inventory

| Node | Type | Role |
|------|------|------|
| Start | Input | `company_name`, `user_id` + optional `context_*` variables |
| Code 1 (`define_categories`) | Code | Hardcodes all 10 categories with 20 evidence items and search queries each |
| Iteration (`context_retrieval`) | Iteration | Parallel loop (max 10) — input: `categories` array, output: `eval_context` strings |
| → Code 2 (`build_query`) | Code | Bound to iteration `item` — extracts `category_id`, `combined_query`, `items_checklist` |
| → HTTP Request (`iteration`) | HTTP | `POST /api/knowledge/context?secret=...` with `user_id`, `category_id`, `query` |
| → Code 3 (`format_context`) | Code | Parses HTTP response JSON, formats eval prompt, prepends `CATEGORY_ID:` prefix |
| Code 4 (`route_to_llms`) | Code | Parses `CATEGORY_ID:` prefix from each string → routes to 10 `context_*` output variables |
| `eval_<category_id>` (×10) | LLM | Evaluates one category against the scorecard — outputs structured JSON |
| End | Output | All 10 category evaluation results |

### Critical Implementation Notes

- **Code 2 input binding**: Must be bound to `Iteration (context_retrieval) / item Object` — not to the source `categories` array. Binding to the full array causes the function to receive a list instead of a single dict.
- **Code 3 variable naming**: Function parameter names must exactly match declared input variable names in the Dify UI. If the HTTP response variable is named `http_body`, the function signature must use `http_body`, not `context`.
- **Code 3 JSON parsing**: The HTTP response `body` is a raw JSON string (`{"context":"..."}`). Must parse with `json.loads(http_body).get("context", "")` — do not pass the raw string to the LLM prompt.
- **Code 3 CATEGORY_ID prefix**: Prepend `CATEGORY_ID: {category_id}\n` to the output. Code 4 relies on this prefix to route each context to the correct output variable.
- **Code 3 output variable**: Name the declared output variable `eval_context`. The Iteration node's output variable reference must point to `Code 3 (format_context) / eval_context`.
- **Code 4 parsing**: Splits on first `\n` to extract `cat_id`, builds `result["context_" + cat_id]` dynamically. Declared output variables must match exactly: `context_product_technology`, `context_market_traction`, etc.
- **No Variable Aggregator**: LLM nodes connect directly to END. Each fires `node_finished` independently, enabling streaming `category_complete` events to the frontend.

**Dify Studio testing**: `sys.user_id` is a Dify-internal identifier, not a Supabase UUID. The HTTP endpoint returns 200 with empty context ("No onboarding data available"). All items score UNPROVEN — this is correct. Real data flows when triggered from the app with a valid Supabase user.

## LLM Node Configuration

### Node Naming Convention (CRITICAL)

Each LLM node must be titled with the prefix `eval_` followed by the category ID:

| Node Title | Category |
|-----------|----------|
| `eval_product_technology` | Product & Technology |
| `eval_market_traction` | Market Traction & Revenue |
| `eval_business_model` | Business Model & Economics |
| `eval_team_organization` | Team & Organization |
| `eval_go_to_market` | Go-to-Market |
| `eval_financial_health` | Financial Health |
| `eval_fundraising_capital` | Fundraising & Capital |
| `eval_competitive_position` | Competitive Position |
| `eval_operations` | Operations |
| `eval_legal_compliance` | Legal & Compliance |

Our API parses `node_finished` events by extracting the category ID from the node title (stripping the `eval_` prefix). If the naming doesn't match, the event is silently ignored.

### Model

GPT-4o, Claude 3.5 Sonnet, or any model with structured output support.

### Input Variable

Each LLM node receives its corresponding `context_*` variable from the Start node:
- `eval_product_technology` → uses `{{context_product_technology}}`
- `eval_market_traction` → uses `{{context_market_traction}}`
- etc.

All nodes also use `{{company_name}}`.

### Output Format

Each LLM node should output **structured JSON** matching this schema:

```json
{
  "category_id": "product_technology",
  "category_title": "Product & Technology",
  "summary": "2-3 sentence assessment. States the determined maturity stage and references concrete evidence.",
  "completeness": 35,
  "status": "unproven",
  "highlights": ["Specific strength citing evidence from the data"],
  "gaps": [
    {
      "action": "Implement systematic user feedback collection (NPS surveys, feature request tracking) to demonstrate you are listening to customers",
      "type": "table_stakes",
      "evidence_items": [7]
    },
    {
      "action": "Document measurable customer outcomes and early retention signals to build product-market fit evidence",
      "type": "stretch",
      "evidence_items": [8, 9]
    }
  ],
  "keyMetrics": { "metricName": "value" },
  "deepDivePrompt": "2-3 sentence natural follow-up opener referencing what was shared and probing the most impactful gap"
}
```

**Field rules:**
- `category_id`: Must exactly match the dimension ID (e.g., `product_technology`)
- `category_title`: Human-readable name
- `completeness`: Integer 0-100, calculated as `(total_points / 20) × 100` where PROVEN=1, PARTIAL=0.5, UNPROVEN=0
- `status`: Derived from completeness — `>= 70` → `"proven"`, `>= 40` → `"partial"`, `< 40` → `"unproven"`
- `highlights`: Up to 5 strings citing specific evidence (metrics, facts, quotes) from PROVEN items. Prioritize items impressive for the company's maturity stage.
- `gaps`: Up to 5 objects, each with:
  - `action` (string): A specific, actionable recommendation the founder can take. Framed as what would make an investor confident at this stage. Related UNPROVEN/PARTIAL items should be consolidated into a single gap.
  - `type` (`"table_stakes"` | `"stretch"`): `table_stakes` = missing/partial items at the company's current maturity gate (must close to meet expectations). `stretch` = items at the next gate up (signals readiness to advance).
  - `evidence_items` (number[]): Which evidence item numbers (1-20) from the scorecard this gap addresses.
- `keyMetrics`: Object of key-value pairs (string values). Extract quantitative metrics from the data. Use `{}` if none found.
- `deepDivePrompt`: Natural 2-3 sentence follow-up opener that references what was shared and probes the most impactful gap.

**Dify output variable schema** (paste into each LLM node's output variable config):
```json
{
  "type": "object",
  "properties": {
    "category_id": { "type": "string" },
    "category_title": { "type": "string" },
    "summary": { "type": "string" },
    "completeness": { "type": "integer", "minimum": 0, "maximum": 100 },
    "status": { "type": "string", "enum": ["proven", "partial", "unproven"] },
    "highlights": { "type": "array", "items": { "type": "string" } },
    "gaps": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "action": { "type": "string" },
          "type": { "type": "string", "enum": ["table_stakes", "stretch"] },
          "evidence_items": { "type": "array", "items": { "type": "integer" } }
        },
        "required": ["action", "type", "evidence_items"]
      }
    },
    "keyMetrics": { "type": "object", "additionalProperties": { "type": "string" } },
    "deepDivePrompt": { "type": "string" }
  },
  "required": ["category_id", "category_title", "summary", "completeness", "status", "highlights", "gaps", "keyMetrics", "deepDivePrompt"]
}
```

---

## Environment Variable Content — Per-Category Scorecards

Each category's environment variable should contain the content shown below. Copy everything between the `--- BEGIN ---` and `--- END ---` markers for each category into the corresponding Dify environment variable.

Each scorecard contains:
1. The 20 evidence items table with maturity gates
2. The maturity stage thresholds
3. The maturity stage interpretation specific to that category

### Query Design Philosophy

The semantic search queries in each scorecard are written to match **how founders describe evidence**, not how investors look for it. A founder won't write "cap table clean maintained accurate" — they'll write "founders own 65%, option pool is 15%". Queries use natural founder speech patterns, specific numbers, tool names, and concrete outcomes rather than evaluation jargon.

---

### `eval_product_technology`

`--- BEGIN env variable content ---`

## Product & Technology — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Working product exists | Concept | `product is live users can sign up here is the demo how it works` |
| 2 | Core problem clearly defined | Concept | `companies have to manually struggle with this costs time before we built` |
| 3 | Target user identified | Concept | `our customers are we built this for they typically work at` |
| 4 | Technical architecture documented | Early | `we built using our stack is runs on AWS GCP Node Python React Postgres` |
| 5 | Product used by real customers | Early | `we have active users customers logging in daily weekly usage numbers` |
| 6 | Core feature set complete | Early | `the product lets you users can do key features include we shipped` |
| 7 | User feedback collected systematically | Early | `users told us our NPS is customers said they wish survey results` |
| 8 | Product solves problem measurably | Validated | `customers went from to saved time reduced cost results after using` |
| 9 | Product-market fit signals present | Validated | `customers keep coming back referring friends organic retention stayed without asking` |
| 10 | Technical scalability demonstrated | Validated | `system handled peak requests per second concurrent users latency at load` |
| 11 | Development velocity sustainable | Validated | `we deploy weekly shipped features this sprint two-week releases cadence` |
| 12 | Technical debt managed | Validated | `code review test coverage we allocate time refactoring quality standards` |
| 13 | Security practices in place | Scaling | `pen test passed SOC2 encrypt customer data audit security assessment` |
| 14 | IP protection strategy exists | Scaling | `filed patent provisional application trade secret we own proprietary algorithm` |
| 15 | Platform/API extensibility | Scaling | `our API third parties integrate developers built on webhooks SDK ecosystem` |
| 16 | Data infrastructure mature | Scaling | `we track events per day analytics warehouse Mixpanel Segment dashboards alerts` |
| 17 | Multi-environment deployment | Scaling | `staging before production CI pipeline automated tests deploy process` |
| 18 | Product roadmap driven by data | Leader | `data showed users doing so we prioritized A/B test analytics informed decision` |
| 19 | Industry-recognized technical excellence | Leader | `won recognized benchmark compared top ranked award featured in` |
| 20 | Innovation pipeline active | Leader | `building next R&D exploring research upcoming capabilities working on new` |

### Maturity Stage Interpretation for Product & Technology
- **Concept** (0–4): Has an idea or early prototype but no real users
- **Early** (5–8): Working product with initial users, basic architecture in place
- **Validated** (9–13): Product-market fit signals, customers getting measurable value, scalable architecture
- **Scaling** (14–17): Enterprise-ready security, IP protected, extensible platform, data-driven development
- **Leader** (18–20): Industry-recognized technology, active innovation pipeline, comprehensive technical excellence

`--- END env variable content ---`

---

### `eval_market_traction`

`--- BEGIN env variable content ---`

## Market Traction & Revenue — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Target market identified | Concept | `the market we are going after segment we focus on companies that` |
| 2 | Value proposition articulated | Concept | `unlike alternatives we offer reason customers choose us different because` |
| 3 | First paying customer acquired | Concept | `first sale closed customer paid us initial revenue first contract signed` |
| 4 | Revenue model defined | Early | `we charge per seat subscription monthly fee pricing is annual contract` |
| 5 | Monthly recurring revenue established | Early | `MRR is thousand monthly recurring revenue subscription paying customers` |
| 6 | Customer acquisition channel identified | Early | `we find customers through most customers come from our main channel is` |
| 7 | Customer retention measured | Early | `percent of customers renew churn is low customers stay average tenure` |
| 8 | Revenue growth rate documented | Validated | `grew percent last month revenue doubled this quarter growth rate` |
| 9 | Net revenue retention above 100% | Validated | `existing customers spend more upsell expanded account increased seats` |
| 10 | Customer acquisition cost known | Validated | `costs us dollars to acquire new customer marketing spend per acquisition` |
| 11 | Total addressable market sized | Validated | `the market is billion we are going after segment worth opportunity` |
| 12 | Repeatable sales process exists | Validated | `sales pipeline stages close rate we convert from demo to paid` |
| 13 | Multiple revenue streams active | Scaling | `also generate from services professional implementation in addition to subscription` |
| 14 | Unit economics positive | Scaling | `we make profit per customer lifetime value multiple of acquisition cost` |
| 15 | Market share measured | Scaling | `we have percent of the market one of the top players in space` |
| 16 | International or multi-market revenue | Scaling | `customers in UK Europe Canada international revenue outside US global` |
| 17 | Revenue predictability demonstrated | Scaling | `annual contracts we can forecast revenue ninety percent accuracy cohort` |
| 18 | Category leader position | Leader | `we are the leading top three recognized as the go-to solution` |
| 19 | Revenue at scale (>$1M ARR) | Leader | `ARR is million annual revenue run rate crossed million dollar` |
| 20 | Organic growth engine working | Leader | `customers find us without paid ads word of mouth referral came from` |

### Maturity Stage Interpretation for Market Traction & Revenue
- **Concept** (0–4): Has an idea of target market but no revenue
- **Early** (5–8): First customers, initial MRR, basic acquisition channel
- **Validated** (9–13): Growing revenue, known unit economics, repeatable sales
- **Scaling** (14–17): Multi-channel, positive unit economics, predictable revenue
- **Leader** (18–20): Market leader, revenue at scale, organic growth flywheel

`--- END env variable content ---`

---

### `eval_business_model`

`--- BEGIN env variable content ---`

## Business Model & Economics — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Business model described | Concept | `we make money by charging customers for how we monetize revenue comes from` |
| 2 | Pricing approach exists | Concept | `price point is per month per seat per user we charge` |
| 3 | Target customer willingness to pay validated | Concept | `customers told us price is right willing to pay validated found price` |
| 4 | Pricing tiers or packages defined | Early | `plans are starter professional enterprise tiers pricing packages options` |
| 5 | Gross margin calculated | Early | `gross margin is percent cost to deliver service infrastructure` |
| 6 | Cost structure documented | Early | `our costs are fixed variable biggest expenses headcount infrastructure hosting` |
| 7 | Revenue per customer tracked | Early | `average revenue per customer per month ARPU average contract value` |
| 8 | Customer lifetime value estimated | Validated | `average customer stays years lifetime value calculated cohort analysis` |
| 9 | LTV:CAC ratio above 3:1 | Validated | `lifetime value is times what we spend to acquire payback period months` |
| 10 | Gross margins above 60% | Validated | `margins are percent healthy gross profit on each subscription SaaS` |
| 11 | Pricing optimization tested | Validated | `tested different price points at this price conversion improved customers responded` |
| 12 | Path to profitability mapped | Validated | `break even at MRR we reach profitability by quarter timeline` |
| 13 | Contribution margin positive | Scaling | `profitable on each customer after variable costs contribution positive` |
| 14 | Operating leverage demonstrated | Scaling | `revenue grew faster than costs this quarter efficiency ratio improving` |
| 15 | Multi-product or upsell revenue | Scaling | `customers buy add-ons upgrade to higher plan upsell cross-sell expansion` |
| 16 | Pricing power demonstrated | Scaling | `raised prices customers stayed didn't churn at higher price point` |
| 17 | Working capital efficient | Scaling | `customers pay upfront annual billing cash flow positive before delivering` |
| 18 | EBITDA positive or near | Leader | `close to break even nearly profitable operating margin positive` |
| 19 | Business model proven at scale | Leader | `economics hold as we scale proven across cohorts replicable` |
| 20 | Best-in-class unit economics | Leader | `our margins LTV CAC ratio better than industry average benchmark comparison` |

### Maturity Stage Interpretation for Business Model & Economics
- **Concept** (0–4): Basic pricing idea, no validated economics
- **Early** (5–8): Pricing defined, gross margins known, tracking ARPU
- **Validated** (9–13): Healthy LTV:CAC, good margins, path to profitability mapped
- **Scaling** (14–17): Operating leverage, upsell working, pricing power proven
- **Leader** (18–20): Profitable or near, best-in-class economics, model proven at scale

`--- END env variable content ---`

---

### `eval_team_organization`

`--- BEGIN env variable content ---`

## Team & Organization — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Founding team identified | Concept | `the founders are I am cofounder my background previously worked at` |
| 2 | Relevant domain expertise present | Concept | `spent years in this industry worked at domain deep expertise insider` |
| 3 | Technical capability on team | Concept | `CTO cofounder engineer built previously technical background software` |
| 4 | Full-time commitment from founders | Early | `all full time left jobs dedicated working on this not nights and weekends` |
| 5 | Core team of 3+ hired | Early | `team of people hired employees full time staff working with us` |
| 6 | Key roles filled (eng, product, sales) | Early | `hired VP sales director of engineering product manager marketing lead head of` |
| 7 | Compensation structure defined | Early | `salary equity vesting cliff four year schedule options grant` |
| 8 | Team has complementary skills | Validated | `between us cover technical business domain sales I bring he brings` |
| 9 | Prior startup or scaling experience | Validated | `previously founded built scaled early employee at grew from to` |
| 10 | Culture and values articulated | Validated | `our values are company culture we believe in how we work together` |
| 11 | Employee retention healthy | Validated | `team has been here years average tenure no one has left people stay` |
| 12 | Hiring pipeline active | Validated | `actively hiring open roles candidates interviewing recruiting pipeline` |
| 13 | Advisory board established | Scaling | `advisors include former VP at connected to investor industry expert helps` |
| 14 | Management layer in place | Scaling | `VP of director of managers lead each function reports directly to` |
| 15 | Organizational structure documented | Scaling | `org chart reporting structure team organized by function departments` |
| 16 | Succession planning for key roles | Scaling | `if this person left backup can cover documented not dependent on one person` |
| 17 | Remote/hybrid work processes | Scaling | `team distributed remote offices hybrid async Slack documentation` |
| 18 | Industry-recognized team | Leader | `team from Google Facebook Stripe top company well known previously at notable` |
| 19 | Team scaled past 50+ employees | Leader | `grew from to fifty employees headcount scaling hiring rapidly organization` |
| 20 | Board of directors active | Leader | `board meets quarterly directors include independent board member governance` |

### Maturity Stage Interpretation for Team & Organization
- **Concept** (0–4): Founders with an idea, minimal team
- **Early** (5–8): Core team hired, key roles filled, full-time commitment
- **Validated** (9–13): Complementary skills, healthy culture, active hiring
- **Scaling** (14–17): Management layer, advisory board, org structure
- **Leader** (18–20): Industry talent, 50+ employees, active board governance

`--- END env variable content ---`

---

### `eval_go_to_market`

`--- BEGIN env variable content ---`

## Go-to-Market — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Target customer defined | Concept | `ideal customer is company that has these problems decision maker is` |
| 2 | Initial distribution channel identified | Concept | `first customers came from started with direct outreach community network` |
| 3 | First customers acquired manually | Concept | `found first customers by reaching out personally cold outreach direct` |
| 4 | Sales motion defined (PLG/sales-led/hybrid) | Early | `sell through self-serve trial signup product led or direct sales outbound` |
| 5 | Marketing website and materials exist | Early | `website pricing page case studies testimonials content published` |
| 6 | Lead generation active | Early | `generating leads per month inbound outbound pipeline filling` |
| 7 | Conversion funnel measured | Early | `trial to paid conversion is percent demo close rate funnel` |
| 8 | Customer acquisition repeatable | Validated | `predictably acquire customers same process pipeline consistent` |
| 9 | Sales cycle length known | Validated | `average time to close is days weeks months from first contact to signature` |
| 10 | Content or inbound marketing working | Validated | `blog SEO organic traffic content thought leadership customers find us` |
| 11 | Referral or word-of-mouth channel | Validated | `customers tell others referred by existing customer came from word of mouth` |
| 12 | Sales playbook documented | Validated | `sales process documented objection handling how we run demos scripts` |
| 13 | Multi-channel acquisition | Scaling | `customers come from paid SEO events partnerships multiple sources` |
| 14 | Enterprise sales process | Scaling | `enterprise deals six figure procurement legal review security questionnaire` |
| 15 | Partner or channel strategy | Scaling | `partner with resellers distributors integration partners channel agreement` |
| 16 | Brand awareness growing | Scaling | `people recognize us heard of us market awareness name recognition growing` |
| 17 | Demand generation at scale | Scaling | `MQLs per month pipeline volume programs running generating demand` |
| 18 | Market category ownership | Leader | `when people think of this problem they think of us category leader` |
| 19 | Self-sustaining growth engine | Leader | `growth compounds each cohort brings others flywheel growing without spending` |
| 20 | International GTM execution | Leader | `launched in UK Europe international team hiring local market sales` |

### Maturity Stage Interpretation for Go-to-Market
- **Concept** (0–4): Target customer identified, first manual sales
- **Early** (5–8): Sales motion defined, website up, leads coming in
- **Validated** (9–13): Repeatable acquisition, known sales cycle, playbook documented
- **Scaling** (14–17): Multi-channel, enterprise sales, partner strategy
- **Leader** (18–20): Category ownership, self-sustaining growth, international

`--- END env variable content ---`

---

### `eval_financial_health`

`--- BEGIN env variable content ---`

## Financial Health — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Basic financial records exist | Concept | `bookkeeping accounting QuickBooks Xero financial records tracked transactions` |
| 2 | Burn rate known | Concept | `spending per month burn rate monthly cash out going` |
| 3 | Revenue tracked | Concept | `invoices receipts payment revenue coming in dollars per month tracking` |
| 4 | Monthly financial reporting | Early | `P&L income statement balance sheet monthly report reviewed` |
| 5 | Runway calculated | Early | `have months of cash remaining at current burn will last until` |
| 6 | Budget exists | Early | `allocated budget headcount plan spend this year next quarter approved` |
| 7 | Revenue vs expenses tracked | Early | `revenue covers percent of our expenses burn ratio improving` |
| 8 | 12+ months runway | Validated | `twelve months runway cash will last through comfortable position funded` |
| 9 | Cash flow forecast exists | Validated | `modeled cash flow projected inflows outflows over next months model` |
| 10 | Financial projections (3-year) | Validated | `three year financial model revenue projections expenses assumptions forecast` |
| 11 | Revenue covering >30% of expenses | Validated | `revenue covers third of our burn expenses percentage of spend` |
| 12 | Burn rate declining or stable | Validated | `burn came down reduced costs efficiency spending less than before` |
| 13 | 18+ months runway | Scaling | `eighteen months comfortable runway raised enough will last through milestone` |
| 14 | Detailed unit economics tracked | Scaling | `per customer cost to serve margin after delivery unit economics` |
| 15 | Revenue growth outpacing expense growth | Scaling | `revenue growing faster than costs ratio improving efficiency gain` |
| 16 | Financial controls and auditing | Scaling | `audit completed reviewed by accounting firm financial controls process` |
| 17 | Treasury management | Scaling | `cash in treasury short term yield banking relationship managing reserves` |
| 18 | Near break-even or profitable | Leader | `close to breaking even a few months away nearly profitable positive` |
| 19 | Financial operations scaled | Leader | `CFO controller FP&A finance team running numbers reporting` |
| 20 | Capital efficient growth demonstrated | Leader | `grew revenue efficiently low burn multiple capital efficient ratio` |

### Maturity Stage Interpretation for Financial Health
- **Concept** (0–4): Basic tracking, knows burn rate
- **Early** (5–8): Monthly reporting, runway calculated, budget in place
- **Validated** (9–13): 12+ months runway, forecasts exist, revenue growing
- **Scaling** (14–17): 18+ months runway, financial controls, operating leverage
- **Leader** (18–20): Near profitable, scaled finance ops, capital efficient

`--- END env variable content ---`

---

### `eval_fundraising_capital`

`--- BEGIN env variable content ---`

## Fundraising & Capital — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Funding need articulated | Concept | `raising million need capital to hire expand build grow` |
| 2 | Use of funds defined | Concept | `will use the money for spending on hiring product sales market` |
| 3 | Pitch materials exist | Concept | `deck presentation investor materials prepared slides ready to share` |
| 4 | Pre-seed or seed raised | Early | `raised million from closed seed round pre-seed funding investors backed` |
| 5 | Cap table clean | Early | `founders own percent investors own option pool percent shares outstanding` |
| 6 | Investor relationships initiated | Early | `introduced to VC been meeting with investors warm intro through` |
| 7 | Valuation benchmark understood | Early | `comparable companies valued at our valuation based on revenue multiple` |
| 8 | Lead investor secured (or lined up) | Validated | `lead investor committed signed term sheet leading the round` |
| 9 | Due diligence ready | Validated | `data room prepared documents organized financial records contracts ready` |
| 10 | Target round size and valuation set | Validated | `raising at valuation this round post-money pre-money target` |
| 11 | Warm introductions to multiple funds | Validated | `introductions to multiple VCs warm intro through portfolio friend` |
| 12 | Prior round terms clean | Validated | `previous investors standard terms no unusual provisions clean simple` |
| 13 | Series A+ raised or in process | Scaling | `Series A closed institutional investor led the round raised` |
| 14 | Multiple funding options available | Scaling | `venture debt SBIR grant revenue financing in addition to equity` |
| 15 | Investor update cadence established | Scaling | `send monthly update to investors quarterly report keeping informed` |
| 16 | Board governance structured | Scaling | `board seat observer rights quarterly meeting agenda minutes` |
| 17 | Secondary or strategic capital access | Scaling | `strategic investor corporate venture arm secondary sale option` |
| 18 | Growth round raised | Leader | `Series B C growth capital raised institutional scaling round closed` |
| 19 | Strong investor brand association | Leader | `Sequoia Andreessen Y Combinator top tier investor backed portfolio` |
| 20 | Capital markets optionality (IPO/M&A) | Leader | `thinking about IPO acquisition conversations exit options preparing readiness` |

### Maturity Stage Interpretation for Fundraising & Capital
- **Concept** (0–4): Knows funding need, pitch deck exists
- **Early** (5–8): Seed raised, cap table clean, investor network started
- **Validated** (9–13): Lead investor engaged, due diligence ready, target set
- **Scaling** (14–17): Institutional round, board governance, multiple capital options
- **Leader** (18–20): Growth rounds complete, top investors, exit optionality

`--- END env variable content ---`

---

### `eval_competitive_position`

`--- BEGIN env variable content ---`

## Competitive Position — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Competitors identified | Concept | `our competitors are alternatives customers compare us to others in space` |
| 2 | Differentiation articulated | Concept | `unlike X we do Y we are different because unique approach compared to` |
| 3 | Basic competitive awareness | Concept | `we know the landscape what else is out there alternatives exist` |
| 4 | Competitive matrix documented | Early | `comparison versus competitors we win on feature price service` |
| 5 | Unique value proposition clear | Early | `what makes us different is why customers choose us specifically` |
| 6 | Customer preference signals | Early | `customers chose us over X because they said prefer us win deals against` |
| 7 | Switching costs understood | Early | `customers integrate deeply to migrate would have to customers locked in stay` |
| 8 | Technical moat identified | Validated | `proprietary algorithm took years to build technical advantage hard to copy` |
| 9 | Win/loss analysis conducted | Validated | `we win against X when we lose to Y because deals closed against` |
| 10 | Market positioning defined | Validated | `we position as we are known for category we own perceived as` |
| 11 | Barrier to entry assessed | Validated | `hard to replicate because took years data network relationships built up` |
| 12 | First-mover or fast-follower advantage | Validated | `we were first earliest in market ahead timing advantage launched before` |
| 13 | Sustainable competitive advantage demonstrated | Scaling | `advantage grows over time harder to compete as we scale compounds` |
| 14 | Network effects or data advantages | Scaling | `more users makes it better each adds value data improves with scale` |
| 15 | Brand as competitive advantage | Scaling | `customers trust our name brand association recognized trusted reputation` |
| 16 | Pricing power vs competitors | Scaling | `charge more than alternatives customers pay premium we command higher` |
| 17 | Competitive intelligence process | Scaling | `we monitor competitors track what they release watch market moves` |
| 18 | Category defining company | Leader | `we created this category set the standard defined what it means` |
| 19 | Multiple defensible moats | Leader | `combination of technology data network brand all working together` |
| 20 | Competitors benchmark against you | Leader | `competitors mention us in their marketing compare themselves to us reference` |

### Maturity Stage Interpretation for Competitive Position
- **Concept** (0–4): Knows competitors exist, basic differentiation idea
- **Early** (5–8): Competitive matrix, clear UVP, some customer preference
- **Validated** (9–13): Technical moat, market positioning, win/loss data
- **Scaling** (14–17): Sustainable advantage, network effects, pricing power
- **Leader** (18–20): Category definer, multiple moats, competitors benchmark against you

`--- END env variable content ---`

---

### `eval_operations`

`--- BEGIN env variable content ---`

## Operations — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Basic tools and infrastructure in place | Concept | `we use Slack Notion Jira Linear AWS tools set up running` |
| 2 | Communication processes exist | Concept | `daily standup weekly team meeting sync how we communicate process` |
| 3 | Project management approach | Concept | `track in Jira Linear sprints backlog priority planning tickets` |
| 4 | Development process defined | Early | `agile two-week sprints pull request review merge deploy process` |
| 5 | Customer support exists | Early | `support team responds tickets email chat Intercom help desk response time` |
| 6 | Uptime and reliability tracked | Early | `uptime percent availability monitored status page SLA` |
| 7 | Incident response process | Early | `when outage happens on-call runbook escalate post-mortem review` |
| 8 | SLA commitments defined | Validated | `we commit to uptime response time SLA guarantee enterprise contract` |
| 9 | Vendor management in place | Validated | `vendors suppliers contracts procurement negotiate manage relationships` |
| 10 | Quality assurance process | Validated | `QA testing before release review checklist bug tracking regression` |
| 11 | Documentation maintained | Validated | `internal docs wiki Notion Confluence knowledge base written updated` |
| 12 | Onboarding process for employees | Validated | `new hire first week checklist training onboarding ramp up process` |
| 13 | Business continuity plan | Scaling | `if X fails backup plan redundancy disaster recovery we would` |
| 14 | Compliance frameworks adopted | Scaling | `SOC2 ISO 27001 GDPR HIPAA compliance process working toward certification` |
| 15 | Operational metrics dashboarded | Scaling | `dashboard KPIs tracked visible to team operations metrics reviewed` |
| 16 | Support scaling plan | Scaling | `support team grew customers to agent ratio tickets handled per person` |
| 17 | Automation of repetitive processes | Scaling | `automated scripts workflows eliminated manual repetitive saved time` |
| 18 | World-class operational efficiency | Leader | `operations running smoothly efficient team doing more with less` |
| 19 | 99.9%+ uptime demonstrated | Leader | `system has been up nine nines availability demonstrated track record` |
| 20 | Operational playbooks for all key functions | Leader | `runbooks written step by step documented procedures playbook` |

### Maturity Stage Interpretation for Operations
- **Concept** (0–4): Basic tools, ad-hoc processes
- **Early** (5–8): Dev process defined, support exists, uptime tracked
- **Validated** (9–13): SLAs, vendor management, QA, documentation
- **Scaling** (14–17): BCP, compliance, dashboards, automation
- **Leader** (18–20): Operational excellence, 99.9%+ uptime, playbooks for everything

`--- END env variable content ---`

---

### `eval_legal_compliance`

`--- BEGIN env variable content ---`

## Legal & Compliance — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Company incorporated | Concept | `incorporated in Delaware C-corp LLC entity structure formation registered` |
| 2 | Founder agreements signed | Concept | `founder agreement equity split vesting schedule signed between cofounders` |
| 3 | Basic terms of service exist | Concept | `terms of service privacy policy website legal pages published` |
| 4 | Employment agreements in place | Early | `offer letters employment contracts signed all employees have agreements` |
| 5 | Contractor agreements standardized | Early | `contractor NDA independent contractor agreement consultant signed` |
| 6 | IP assignment agreements signed | Early | `employees assigned IP work product invention assignment signed over` |
| 7 | Privacy policy published | Early | `privacy policy data collection handling published GDPR compliant` |
| 8 | Cap table properly maintained | Validated | `founders own percent investors own option pool outstanding shares breakdown` |
| 9 | Data handling compliant (GDPR/CCPA) | Validated | `GDPR CCPA data privacy user data handling processing compliant` |
| 10 | Customer contracts standardized | Validated | `standard MSA SaaS agreement template all customers sign same contract` |
| 11 | Insurance coverage in place | Validated | `D&O liability insurance E&O errors omissions policy coverage` |
| 12 | Regulatory requirements mapped | Validated | `regulations in our industry we must comply with identified mapped` |
| 13 | IP portfolio documented | Scaling | `patents filed trademarks registered trade secrets listed documented` |
| 14 | SOC2 or equivalent compliance | Scaling | `SOC2 Type II report audit passed security certified compliance` |
| 15 | International legal framework | Scaling | `operating in multiple countries EU UK legal entities set up cross-border` |
| 16 | Legal counsel retained | Scaling | `working with law firm attorney outside counsel represents us legal` |
| 17 | Shareholder agreement comprehensive | Scaling | `investor rights agreement voting rights pro-rata information rights` |
| 18 | Full regulatory compliance demonstrated | Leader | `passed regulatory audit approved certified by authority compliance demonstrated` |
| 19 | Patent portfolio active | Leader | `patents granted pending filed portfolio growing protection IP claims` |
| 20 | Legal readiness for exit (M&A/IPO) | Leader | `data room organized diligence ready documents clean exit preparation` |

### Maturity Stage Interpretation for Legal & Compliance
- **Concept** (0–4): Incorporated, basic agreements
- **Early** (5–8): Employment/contractor/IP agreements, privacy policy
- **Validated** (9–13): Data compliance, standardized contracts, insurance
- **Scaling** (14–17): IP portfolio, SOC2, international framework, legal counsel
- **Leader** (18–20): Full regulatory compliance, active patents, exit-ready

`--- END env variable content ---`

---

### Prompt Template

Customize `[CATEGORY_TITLE]`, `[CATEGORY_ID]`, and the input variable/env var references per node. In Dify Studio, each LLM node's system prompt should contain:

```
{{#env.eval_[CATEGORY_ID]#}}

## Company
{{company_name}}

## Available Information
{{#[CONTEXT_NODE_ID].context_[CATEGORY_ID]#}}

## Assessment Instructions

### Step 1: Score each evidence item
For each of the 20 evidence items in the framework above, assess:
- **PROVEN** (1 point): Clear, specific evidence in the available data
- **PARTIAL** (0.5 points): Some indication but incomplete or vague evidence
- **UNPROVEN** (0 points): No evidence found or not addressed

### Step 2: Calculate completeness
completeness = (total_points / 20) × 100, rounded to nearest integer

### Step 3: Derive status
- completeness >= 70 → "proven"
- completeness >= 40 → "partial"
- completeness < 40 → "unproven"

### Step 4: Determine maturity stage
Count total points from Step 1 (PROVEN=1, PARTIAL=0.5). Match against the maturity stage thresholds listed in the framework above:
- Concept: 0–4 proven items
- Early: 5–8 proven items
- Validated: 9–13 proven items
- Scaling: 14–17 proven items
- Leader: 18–20 proven items

The company's maturity stage is the highest gate where their total points fall.

### Step 5: Identify gaps
Using the evidence items table above, note which maturity gate each item belongs to (Concept, Early, Validated, Scaling, Leader).

Identify how this company can demonstrate exceptional progress at its current maturity stage:
1. UNPROVEN or PARTIAL items at the company's CURRENT maturity gate — these are "table_stakes" gaps that must be closed to meet investor expectations at this stage
2. UNPROVEN or PARTIAL items at the NEXT maturity gate up — these are "stretch" goals that signal readiness to advance and stand out to investors

Do NOT include items from gates two or more levels above the current stage — those are not yet relevant.

Consolidate related items into a single actionable recommendation. Frame each gap as a specific action the founder can take that would make an investor confident in the company's progress at this stage. Maximum 5 gaps.

For each gap, include:
- "action": the actionable recommendation
- "type": "table_stakes" (current gate) or "stretch" (next gate up)
- "evidence_items": array of evidence item numbers (1-20) this gap addresses

### Step 6: Build output
- **summary**: 2–3 sentence assessment. Reference concrete evidence from the data. State the determined maturity stage.
- **highlights**: Up to 5 strengths. Cite specific evidence (metrics, facts, quotes) from PROVEN items. Prioritize items that are impressive for the company's maturity stage.
- **gaps**: The consolidated gaps from Step 5 (max 5, as objects with action/type/evidence_items).
- **keyMetrics**: Extract any quantitative metrics mentioned in the data (revenue, users, growth %, etc.). Use empty object {} if none found.
- **deepDivePrompt**: Natural 2–3 sentence follow-up opener that references what was shared and probes the most impactful gap.

### Rules
- category_id must be "[CATEGORY_ID]"
- Do not fabricate data — only reference information present in the context
- If no context is available, set completeness to 0 and note the absence in summary

Output valid JSON only.
```

**Substitution guide** — replace these placeholders per node:

| Placeholder | Example for Product & Technology |
|---|---|
| `[CATEGORY_ID]` | `product_technology` |
| `[CATEGORY_TITLE]` | `Product & Technology` |
| `[CONTEXT_NODE_ID]` | The Dify node ID that provides the context variable (visible in the node's output panel) |

The `{{#env.eval_[CATEGORY_ID]#}}` reference pulls in the category's environment variable (set up in Step 2), which contains the 20 evidence items and maturity stage interpretation.

## API Configuration

After creating the workflow in Dify Studio:

1. **Publish** the workflow
2. Go to **API Access** in Dify Studio
3. Copy the **API Key** (starts with `app-`)
4. Set it as `DIFY_EVALUATION_API_KEY` in your `.env` and Vercel dashboard

## Testing

### Without Dify (mock mode)

When `DIFY_EVALUATION_API_KEY` is not set, the evaluation endpoint automatically uses mock mode — it generates evaluation results from the onboarding summary with simulated delays. This tests the full pipeline (frontend → API → SSE → progressive rendering).

In dev mode (`npm run dev`), the client automatically falls back to client-side mock when the serverless endpoint returns 404.

### With Dify

Once the workflow is configured and the API key is set:
1. Run the app (`npm run dev`)
2. Complete onboarding to get a summary (or click "Use Sample Data")
3. Click "Generate Evaluation" on the evaluation page
4. Watch categories stream in as each LLM branch completes

## SSE Event Flow

What the frontend receives (in order):

```
data: {"type":"status","message":"Retrieving knowledge base context..."}
data: {"type":"status","message":"Starting evaluation workflow..."}
data: {"type":"category_started","category_id":"product_technology"}
data: {"type":"category_complete","category_id":"product_technology","data":{...}}
data: {"type":"category_started","category_id":"market_traction"}
data: {"type":"category_complete","category_id":"market_traction","data":{...}}
... (8 more categories, order depends on LLM completion time)
data: {"type":"workflow_complete","metadata":{"total_tokens":12345,"elapsed_time":8500}}
```

The order of categories in the stream is non-deterministic — it depends on which LLM branch finishes first. The frontend handles this by updating each category card as it arrives.
