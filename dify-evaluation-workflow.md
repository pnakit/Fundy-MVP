# Dify Evaluation Workflow Setup Guide

## Overview

This document describes how to create the evaluation workflow in Dify Studio. The workflow receives pre-retrieved context for each of the 10 evaluation categories and runs 10 parallel LLM branches to produce structured evaluation results.

**Workflow type**: Workflow (not Chatflow) — single-execution automation triggered via API.

## Creating the Workflow in Dify Studio

### Step 1: Create the app
- In Dify Studio, click **Create App** → select **Workflow** (not Chatflow)
- Name it something like "Startup Evaluation"

### Step 2: Set up the evaluation framework as an Environment Variable
- Go to **Settings** (gear icon) → **Environment Variables**
- Create `EVALUATION_FRAMEWORK` (type: String)
- Paste the full evaluation framework text (scorecard items, scoring rules, maturity thresholds — see "Evaluation Framework" section below)
- This is where you edit evaluation criteria — all 10 LLM nodes reference it via `{{EVALUATION_FRAMEWORK}}`

### Step 3: Configure the Start node
- The **Start** node is already on the canvas
- Add **12 input variables**: `company_name`, `user_id`, and 10 `context_*` variables
- See "Input Variables" section below for the full list
- The Start node receives these via our API call (`POST /workflows/run`)

### Step 4: Add IF/ELSE context fallback
- Add an **IF/ELSE** node after Start
- Condition: check if `context_product_technology` is empty/blank
- **IF empty** → route to an **HTTP Request** node:
  - Method: POST
  - URL: `https://fundy.nusuai.com/api/knowledge/context`
  - Headers: `X-Webhook-Secret: {{DIFY_WEBHOOK_SECRET}}` (add as Dify env var)
  - Body: `{ "user_id": "{{user_id}}" }`
  - This fetches all 10 context blocks from our API
- **IF not empty** → route directly to the LLM nodes (context already provided)

This means:
- **Testing in Dify Studio**: leave context_* inputs blank → HTTP fallback fetches real context
- **Production (from app)**: context_* inputs are pre-filled → HTTP fallback is skipped

### Step 5: Add 10 LLM nodes (parallel)
- Drag 10 LLM nodes — they will run in **parallel**
- Name each node exactly as specified in the "Node Naming Convention" section
- Each LLM node reads: `{{EVALUATION_FRAMEWORK}}` (env var) + its `context_*` variable

### Step 6: Connect to End
- Connect all 10 LLM node outputs directly to the **End** node
- **Do NOT add a Variable Aggregator** — we want each branch to fire `node_finished` independently for streaming

### Trigger
Dify Workflow apps are **API-triggered**. Our serverless function `api/evaluation/generate.js` calls `POST {DIFY_BASE_URL}/workflows/run` with `response_mode: "streaming"`.

**From the user's perspective**: They click "Generate Evaluation" in the webapp → our API does KB retrieval → calls this Dify workflow → streams results back.

### Where things live (single source of truth)

| Component | Location | How to edit |
|-----------|----------|-------------|
| Evaluation criteria (scorecard, scoring rules) | Dify env var `EVALUATION_FRAMEWORK` | Dify Studio → Settings → Environment Variables |
| Search queries for KB retrieval | Supabase `app_config` table, key `evaluation_search_queries` | Supabase Dashboard → Table Editor |
| KB retrieval logic | `api/knowledge/context.js` + `api/evaluation/_categoryContext.js` | Code (serverless functions) |
| LLM prompts | Dify LLM nodes (reference `{{EVALUATION_FRAMEWORK}}`) | Dify Studio → node editor |

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

> **NOTE — Deferred**: The current Dify onboarding chatflow only tracks 8 questions/variables, not 10. The onboarding prompt and variable extraction need to be expanded to cover all 10 dimensions (adding dedicated questions for Operations and Legal & Compliance). This should be done **after** the Evaluation and Investment workflows are developed and tested.

| Evaluation Dimension | Category ID | Onboarding Question Focus | Context Variable |
|---------------------|-------------|--------------------------|------------------|
| Product & Technology | `product_technology` | Product features, tech stack, IP, technical debt | `context_product_technology` |
| Market Traction & Revenue | `market_traction` | Revenue metrics, growth, customer acquisition, TAM | `context_market_traction` |
| Business Model & Economics | `business_model` | Pricing, unit economics, margins, LTV | `context_business_model` |
| Team & Organization | `team_organization` | Founders, team size, key hires, advisory | `context_team_organization` |
| Go-to-Market | `go_to_market` | Sales channels, distribution, GTM motion | `context_go_to_market` |
| Financial Health | `financial_health` | Runway, burn rate, revenue coverage, projections | `context_financial_health` |
| Fundraising & Capital | `fundraising_capital` | Funding history, target raise, investor pipeline | `context_fundraising_capital` |
| Competitive Position | `competitive_position` | Moat, differentiation, competitive matrix | `context_competitive_position` |
| Operations | `operations` | Processes, infrastructure, uptime, support scaling | `context_operations` |
| Legal & Compliance | `legal_compliance` | Entity structure, IP protection, regulatory, GDPR | `context_legal_compliance` |

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

```
                              START
                                │
  ┌─────┬─────┬─────┬─────┬────┴────┬─────┬─────┬─────┬─────┐
  ▼     ▼     ▼     ▼     ▼         ▼     ▼     ▼     ▼     ▼
┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐    ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐
│LLM│ │LLM│ │LLM│ │LLM│ │LLM│    │LLM│ │LLM│ │LLM│ │LLM│ │LLM│
│   │ │   │ │   │ │   │ │   │    │   │ │   │ │   │ │   │ │   │
│P&T│ │Mkt│ │Biz│ │Tm │ │GTM│    │Fin│ │Cap│ │Cmp│ │Ops│ │Lgl│
└─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘    └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘
  │     │     │     │     │        │     │     │     │     │
  └─────┴─────┴─────┴─────┴────┬───┴─────┴─────┴─────┴─────┘
                               │
                              END
```

**No Variable Aggregator** — branches go directly to END. Each branch fires a `node_finished` SSE event independently, which our API transforms into a `category_complete` event for the frontend.

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
  "summary": "2-3 sentence assessment of this dimension",
  "completeness": 85,
  "status": "proven",
  "highlights": ["Key strength 1", "Key strength 2"],
  "gaps": ["Gap or area for improvement 1"],
  "keyMetrics": { "metricName": "value" },
  "deepDivePrompt": "2-3 sentence natural follow-up opener referencing what was shared"
}
```

**Field rules:**
- `category_id`: Must exactly match the dimension ID (e.g., `product_technology`)
- `category_title`: Human-readable name
- `completeness`: Integer 0-100 based on scoring guidelines below
- `status`: Derived from completeness — `>= 70` = `"proven"`, `>= 40` = `"partial"`, `< 40` = `"unproven"`
- `highlights`: Array of strings, specific to actual information provided
- `gaps`: Array of strings, actionable areas to explore
- `keyMetrics`: Object of key-value pairs (string values)
- `deepDivePrompt`: Natural conversation opener for follow-up

---

## Evaluation Framework — Category Scorecards

Each category has 20 evidence items. For each item, the evaluator determines whether it is **proven** (clear evidence), **partial** (some evidence, gaps remain), or **unproven** (no evidence or not addressed).

### Maturity Stage Thresholds

The maturity stage is derived from how many items are proven across the scorecard:

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated, gaps in secondary areas |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

---

### Category 1: Product & Technology (`product_technology`)

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Working product exists | Concept | `working product demo prototype MVP functional` |
| 2 | Core problem clearly defined | Concept | `problem statement pain point customer need being solved` |
| 3 | Target user identified | Concept | `target user persona ideal customer profile` |
| 4 | Technical architecture documented | Early | `technical architecture system design stack infrastructure` |
| 5 | Product used by real customers | Early | `active users customers using product DAU MAU usage` |
| 6 | Core feature set complete | Early | `core features functionality product capabilities shipped` |
| 7 | User feedback collected systematically | Early | `user feedback surveys NPS customer interviews insights` |
| 8 | Product solves problem measurably | Validated | `customer outcomes metrics impact ROI before after` |
| 9 | Product-market fit signals present | Validated | `product market fit Sean Ellis organic growth retention` |
| 10 | Technical scalability demonstrated | Validated | `scalability load testing concurrent users performance under load` |
| 11 | Development velocity sustainable | Validated | `release cadence sprint velocity deployment frequency CI CD` |
| 12 | Technical debt managed | Validated | `technical debt refactoring code quality maintainability` |
| 13 | Security practices in place | Scaling | `security audit penetration testing vulnerability management encryption` |
| 14 | IP protection strategy exists | Scaling | `intellectual property patents trade secrets IP filings provisional` |
| 15 | Platform/API extensibility | Scaling | `API integrations platform extensibility third party ecosystem` |
| 16 | Data infrastructure mature | Scaling | `data pipeline analytics infrastructure monitoring observability` |
| 17 | Multi-environment deployment | Scaling | `staging production environments deployment pipeline blue green` |
| 18 | Product roadmap driven by data | Leader | `data driven roadmap prioritization metrics usage analytics decisions` |
| 19 | Industry-recognized technical excellence | Leader | `technical awards recognition benchmarks industry comparison` |
| 20 | Innovation pipeline active | Leader | `R&D innovation pipeline research new capabilities emerging technology` |

**Maturity stage interpretation for Product & Technology:**
- **Concept** (0–4): Has an idea or early prototype but no real users
- **Early** (5–8): Working product with initial users, basic architecture in place
- **Validated** (9–13): Product-market fit signals, customers getting measurable value, scalable architecture
- **Scaling** (14–17): Enterprise-ready security, IP protected, extensible platform, data-driven development
- **Leader** (18–20): Industry-recognized technology, active innovation pipeline, comprehensive technical excellence

---

### Category 2: Market Traction & Revenue (`market_traction`)

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Target market identified | Concept | `target market segment addressable audience` |
| 2 | Value proposition articulated | Concept | `value proposition unique selling point customer benefit` |
| 3 | First paying customer acquired | Concept | `first customer paying revenue initial sale` |
| 4 | Revenue model defined | Early | `revenue model pricing monetization strategy` |
| 5 | Monthly recurring revenue established | Early | `MRR monthly recurring revenue subscription` |
| 6 | Customer acquisition channel identified | Early | `customer acquisition channel source marketing` |
| 7 | Customer retention measured | Early | `customer retention churn rate renewal` |
| 8 | Revenue growth rate documented | Validated | `revenue growth rate month over month year over year` |
| 9 | Net revenue retention above 100% | Validated | `net revenue retention expansion NRR` |
| 10 | Customer acquisition cost known | Validated | `CAC customer acquisition cost payback period` |
| 11 | Total addressable market sized | Validated | `TAM SAM SOM total addressable market size` |
| 12 | Repeatable sales process exists | Validated | `repeatable sales process pipeline conversion` |
| 13 | Multiple revenue streams active | Scaling | `multiple revenue streams diversification` |
| 14 | Unit economics positive | Scaling | `unit economics LTV CAC ratio positive` |
| 15 | Market share measured | Scaling | `market share percentage competitive position` |
| 16 | International or multi-market revenue | Scaling | `international expansion multi market geography` |
| 17 | Revenue predictability demonstrated | Scaling | `revenue predictability forecast accuracy cohort` |
| 18 | Category leader position | Leader | `market leader category leadership top position` |
| 19 | Revenue at scale (>$1M ARR) | Leader | `ARR annual recurring revenue million scale` |
| 20 | Organic growth engine working | Leader | `organic growth viral referral word of mouth network effects` |

**Maturity stage interpretation for Market Traction & Revenue:**
- **Concept** (0–4): Has an idea of target market but no revenue
- **Early** (5–8): First customers, initial MRR, basic acquisition channel
- **Validated** (9–13): Growing revenue, known unit economics, repeatable sales
- **Scaling** (14–17): Multi-channel, positive unit economics, predictable revenue
- **Leader** (18–20): Market leader, revenue at scale, organic growth flywheel

---

### Category 3: Business Model & Economics (`business_model`)

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Business model described | Concept | `business model how company makes money` |
| 2 | Pricing approach exists | Concept | `pricing approach strategy price point` |
| 3 | Target customer willingness to pay validated | Concept | `willingness to pay validation customer interviews` |
| 4 | Pricing tiers or packages defined | Early | `pricing tiers packages plans subscription` |
| 5 | Gross margin calculated | Early | `gross margin cost of goods revenue percentage` |
| 6 | Cost structure documented | Early | `cost structure fixed variable operating expenses` |
| 7 | Revenue per customer tracked | Early | `ARPU average revenue per user customer` |
| 8 | Customer lifetime value estimated | Validated | `LTV lifetime value customer cohort retention` |
| 9 | LTV:CAC ratio above 3:1 | Validated | `LTV CAC ratio payback period unit economics` |
| 10 | Gross margins above 60% | Validated | `gross margin above 60 percent healthy SaaS` |
| 11 | Pricing optimization tested | Validated | `pricing optimization testing A/B experiment` |
| 12 | Path to profitability mapped | Validated | `path to profitability break even timeline` |
| 13 | Contribution margin positive | Scaling | `contribution margin unit level profitability` |
| 14 | Operating leverage demonstrated | Scaling | `operating leverage revenue growth exceeds cost growth` |
| 15 | Multi-product or upsell revenue | Scaling | `upsell cross-sell expansion revenue multi-product` |
| 16 | Pricing power demonstrated | Scaling | `pricing power increase retention premium` |
| 17 | Working capital efficient | Scaling | `working capital cash conversion cycle efficiency` |
| 18 | EBITDA positive or near | Leader | `EBITDA positive operating profit margin` |
| 19 | Business model proven at scale | Leader | `business model scale proven economics replicable` |
| 20 | Best-in-class unit economics | Leader | `best in class unit economics benchmark comparison` |

**Maturity stage interpretation for Business Model & Economics:**
- **Concept** (0–4): Basic pricing idea, no validated economics
- **Early** (5–8): Pricing defined, gross margins known, tracking ARPU
- **Validated** (9–13): Healthy LTV:CAC, good margins, path to profitability mapped
- **Scaling** (14–17): Operating leverage, upsell working, pricing power proven
- **Leader** (18–20): Profitable or near, best-in-class economics, model proven at scale

---

### Category 4: Team & Organization (`team_organization`)

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Founding team identified | Concept | `founding team cofounders background` |
| 2 | Relevant domain expertise present | Concept | `domain expertise industry experience relevant` |
| 3 | Technical capability on team | Concept | `technical capability CTO engineering build` |
| 4 | Full-time commitment from founders | Early | `full time founders dedicated committed` |
| 5 | Core team of 3+ hired | Early | `team size employees hired core team` |
| 6 | Key roles filled (eng, product, sales) | Early | `key hires engineering product sales marketing roles` |
| 7 | Compensation structure defined | Early | `compensation salary equity vesting structure` |
| 8 | Team has complementary skills | Validated | `complementary skills diverse backgrounds strengths` |
| 9 | Prior startup or scaling experience | Validated | `prior startup experience scaling previous venture` |
| 10 | Culture and values articulated | Validated | `culture values company mission team alignment` |
| 11 | Employee retention healthy | Validated | `employee retention turnover satisfaction` |
| 12 | Hiring pipeline active | Validated | `hiring pipeline recruiting talent acquisition` |
| 13 | Advisory board established | Scaling | `advisory board mentors strategic advisors` |
| 14 | Management layer in place | Scaling | `management layer VP director leadership team` |
| 15 | Organizational structure documented | Scaling | `organizational structure org chart reporting` |
| 16 | Succession planning for key roles | Scaling | `succession planning key person risk backup` |
| 17 | Remote/hybrid work processes | Scaling | `remote hybrid distributed team processes tools` |
| 18 | Industry-recognized team | Leader | `industry recognized team awards reputation` |
| 19 | Team scaled past 50+ employees | Leader | `team size scaled 50 employees growth organization` |
| 20 | Board of directors active | Leader | `board of directors governance oversight independent` |

**Maturity stage interpretation for Team & Organization:**
- **Concept** (0–4): Founders with an idea, minimal team
- **Early** (5–8): Core team hired, key roles filled, full-time commitment
- **Validated** (9–13): Complementary skills, healthy culture, active hiring
- **Scaling** (14–17): Management layer, advisory board, org structure
- **Leader** (18–20): Industry talent, 50+ employees, active board governance

---

### Category 5: Go-to-Market (`go_to_market`)

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Target customer defined | Concept | `target customer ideal buyer persona segment` |
| 2 | Initial distribution channel identified | Concept | `distribution channel go to market initial` |
| 3 | First customers acquired manually | Concept | `first customers manual outreach sales` |
| 4 | Sales motion defined (PLG/sales-led/hybrid) | Early | `sales motion product led growth sales led hybrid` |
| 5 | Marketing website and materials exist | Early | `marketing website content materials messaging` |
| 6 | Lead generation active | Early | `lead generation pipeline inbound outbound` |
| 7 | Conversion funnel measured | Early | `conversion funnel metrics trial signup demo` |
| 8 | Customer acquisition repeatable | Validated | `customer acquisition repeatable scalable channel` |
| 9 | Sales cycle length known | Validated | `sales cycle length time to close deal velocity` |
| 10 | Content or inbound marketing working | Validated | `content marketing inbound SEO thought leadership` |
| 11 | Referral or word-of-mouth channel | Validated | `referral word of mouth organic viral customer` |
| 12 | Sales playbook documented | Validated | `sales playbook process methodology documented` |
| 13 | Multi-channel acquisition | Scaling | `multi channel acquisition marketing diversified` |
| 14 | Enterprise sales process | Scaling | `enterprise sales process large accounts deal size` |
| 15 | Partner or channel strategy | Scaling | `partner channel reseller distributor strategy` |
| 16 | Brand awareness growing | Scaling | `brand awareness recognition market visibility` |
| 17 | Demand generation at scale | Scaling | `demand generation scale pipeline volume` |
| 18 | Market category ownership | Leader | `market category leadership brand dominance` |
| 19 | Self-sustaining growth engine | Leader | `self sustaining growth engine flywheel` |
| 20 | International GTM execution | Leader | `international go to market global expansion` |

**Maturity stage interpretation for Go-to-Market:**
- **Concept** (0–4): Target customer identified, first manual sales
- **Early** (5–8): Sales motion defined, website up, leads coming in
- **Validated** (9–13): Repeatable acquisition, known sales cycle, playbook documented
- **Scaling** (14–17): Multi-channel, enterprise sales, partner strategy
- **Leader** (18–20): Category ownership, self-sustaining growth, international

---

### Category 6: Financial Health (`financial_health`)

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Basic financial records exist | Concept | `financial records bookkeeping accounting` |
| 2 | Burn rate known | Concept | `burn rate monthly spend expenses` |
| 3 | Revenue tracked | Concept | `revenue tracking income receipts` |
| 4 | Monthly financial reporting | Early | `monthly financial report P&L balance sheet` |
| 5 | Runway calculated | Early | `runway months cash remaining funding` |
| 6 | Budget exists | Early | `budget plan spending allocation` |
| 7 | Revenue vs expenses tracked | Early | `revenue vs expenses ratio coverage` |
| 8 | 12+ months runway | Validated | `twelve months runway cash position` |
| 9 | Cash flow forecast exists | Validated | `cash flow forecast projection model` |
| 10 | Financial projections (3-year) | Validated | `financial projections three year model forecast` |
| 11 | Revenue covering >30% of expenses | Validated | `revenue covering expenses percentage` |
| 12 | Burn rate declining or stable | Validated | `burn rate trend declining stable improving` |
| 13 | 18+ months runway | Scaling | `eighteen months runway comfortable cash` |
| 14 | Detailed unit economics tracked | Scaling | `unit economics detailed tracking per customer` |
| 15 | Revenue growth outpacing expense growth | Scaling | `revenue growth outpacing expenses operating leverage` |
| 16 | Financial controls and auditing | Scaling | `financial controls audit compliance SOX` |
| 17 | Treasury management | Scaling | `treasury management cash investment banking` |
| 18 | Near break-even or profitable | Leader | `break even profitable profitability timeline` |
| 19 | Financial operations scaled | Leader | `financial operations FP&A controller CFO` |
| 20 | Capital efficient growth demonstrated | Leader | `capital efficient growth burn multiple efficiency` |

**Maturity stage interpretation for Financial Health:**
- **Concept** (0–4): Basic tracking, knows burn rate
- **Early** (5–8): Monthly reporting, runway calculated, budget in place
- **Validated** (9–13): 12+ months runway, forecasts exist, revenue growing
- **Scaling** (14–17): 18+ months runway, financial controls, operating leverage
- **Leader** (18–20): Near profitable, scaled finance ops, capital efficient

---

### Category 7: Fundraising & Capital (`fundraising_capital`)

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Funding need articulated | Concept | `funding need capital requirements how much raise` |
| 2 | Use of funds defined | Concept | `use of funds allocation deployment milestones` |
| 3 | Pitch materials exist | Concept | `pitch deck investor presentation materials` |
| 4 | Pre-seed or seed raised | Early | `pre-seed seed round raised funding closed` |
| 5 | Cap table clean | Early | `cap table ownership structure equity distribution` |
| 6 | Investor relationships initiated | Early | `investor relationships introductions networking VCs` |
| 7 | Valuation benchmark understood | Early | `valuation benchmark comparable multiples` |
| 8 | Lead investor secured (or lined up) | Validated | `lead investor term sheet committed` |
| 9 | Due diligence ready | Validated | `due diligence data room documents ready` |
| 10 | Target round size and valuation set | Validated | `target round size valuation raise amount` |
| 11 | Warm introductions to multiple funds | Validated | `warm introductions funds VCs pipeline` |
| 12 | Prior round terms clean | Validated | `prior round terms clean no toxic provisions` |
| 13 | Series A+ raised or in process | Scaling | `Series A raised process institutional funding` |
| 14 | Multiple funding options available | Scaling | `multiple funding options venture debt grants` |
| 15 | Investor update cadence established | Scaling | `investor updates cadence reporting monthly quarterly` |
| 16 | Board governance structured | Scaling | `board governance structure meetings rights` |
| 17 | Secondary or strategic capital access | Scaling | `secondary strategic capital options access` |
| 18 | Growth round raised | Leader | `growth round Series B C raised scaled funding` |
| 19 | Strong investor brand association | Leader | `top tier investors brand name fund portfolio` |
| 20 | Capital markets optionality (IPO/M&A) | Leader | `IPO M&A exit optionality capital markets readiness` |

**Maturity stage interpretation for Fundraising & Capital:**
- **Concept** (0–4): Knows funding need, pitch deck exists
- **Early** (5–8): Seed raised, cap table clean, investor network started
- **Validated** (9–13): Lead investor engaged, due diligence ready, target set
- **Scaling** (14–17): Institutional round, board governance, multiple capital options
- **Leader** (18–20): Growth rounds complete, top investors, exit optionality

---

### Category 8: Competitive Position (`competitive_position`)

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Competitors identified | Concept | `competitors identified landscape alternatives` |
| 2 | Differentiation articulated | Concept | `differentiation unique advantage what makes different` |
| 3 | Basic competitive awareness | Concept | `competitive awareness market knowledge` |
| 4 | Competitive matrix documented | Early | `competitive matrix comparison feature analysis` |
| 5 | Unique value proposition clear | Early | `unique value proposition clear distinct` |
| 6 | Customer preference signals | Early | `customer preference why choose us over competitors` |
| 7 | Switching costs understood | Early | `switching costs lock-in migration barriers` |
| 8 | Technical moat identified | Validated | `technical moat proprietary technology advantage` |
| 9 | Win/loss analysis conducted | Validated | `win loss analysis competitive deals outcomes` |
| 10 | Market positioning defined | Validated | `market positioning brand perception category` |
| 11 | Barrier to entry assessed | Validated | `barrier to entry defensibility competitive response` |
| 12 | First-mover or fast-follower advantage | Validated | `first mover advantage early entrant timing` |
| 13 | Sustainable competitive advantage demonstrated | Scaling | `sustainable competitive advantage durable moat` |
| 14 | Network effects or data advantages | Scaling | `network effects data advantage platform ecosystem` |
| 15 | Brand as competitive advantage | Scaling | `brand reputation trust competitive advantage` |
| 16 | Pricing power vs competitors | Scaling | `pricing power premium discount competitive pricing` |
| 17 | Competitive intelligence process | Scaling | `competitive intelligence monitoring tracking process` |
| 18 | Category defining company | Leader | `category defining market maker standard setter` |
| 19 | Multiple defensible moats | Leader | `multiple moats defensible technology brand network data` |
| 20 | Competitors benchmark against you | Leader | `competitors benchmark against reference standard` |

**Maturity stage interpretation for Competitive Position:**
- **Concept** (0–4): Knows competitors exist, basic differentiation idea
- **Early** (5–8): Competitive matrix, clear UVP, some customer preference
- **Validated** (9–13): Technical moat, market positioning, win/loss data
- **Scaling** (14–17): Sustainable advantage, network effects, pricing power
- **Leader** (18–20): Category definer, multiple moats, competitors benchmark against you

---

### Category 9: Operations (`operations`)

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Basic tools and infrastructure in place | Concept | `tools infrastructure setup basic operations` |
| 2 | Communication processes exist | Concept | `communication process team meetings standup` |
| 3 | Project management approach | Concept | `project management approach methodology tracking` |
| 4 | Development process defined | Early | `development process agile sprint methodology` |
| 5 | Customer support exists | Early | `customer support help desk ticketing response` |
| 6 | Uptime and reliability tracked | Early | `uptime reliability monitoring SLA availability` |
| 7 | Incident response process | Early | `incident response process outage handling` |
| 8 | SLA commitments defined | Validated | `SLA service level agreement commitments guarantees` |
| 9 | Vendor management in place | Validated | `vendor management procurement suppliers contracts` |
| 10 | Quality assurance process | Validated | `quality assurance QA testing process standards` |
| 11 | Documentation maintained | Validated | `documentation internal external maintained current` |
| 12 | Onboarding process for employees | Validated | `employee onboarding process training ramp up` |
| 13 | Business continuity plan | Scaling | `business continuity disaster recovery BCP DR plan` |
| 14 | Compliance frameworks adopted | Scaling | `compliance framework SOC2 ISO GDPR certification` |
| 15 | Operational metrics dashboarded | Scaling | `operational metrics dashboard KPI monitoring` |
| 16 | Support scaling plan | Scaling | `customer support scaling plan growth capacity` |
| 17 | Automation of repetitive processes | Scaling | `automation workflow efficiency repetitive tasks` |
| 18 | World-class operational efficiency | Leader | `operational excellence efficiency best practices` |
| 19 | 99.9%+ uptime demonstrated | Leader | `uptime 99.9 percent high availability demonstrated` |
| 20 | Operational playbooks for all key functions | Leader | `operational playbooks runbooks standard procedures` |

**Maturity stage interpretation for Operations:**
- **Concept** (0–4): Basic tools, ad-hoc processes
- **Early** (5–8): Dev process defined, support exists, uptime tracked
- **Validated** (9–13): SLAs, vendor management, QA, documentation
- **Scaling** (14–17): BCP, compliance, dashboards, automation
- **Leader** (18–20): Operational excellence, 99.9%+ uptime, playbooks for everything

---

### Category 10: Legal & Compliance (`legal_compliance`)

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Company incorporated | Concept | `company incorporated entity formation legal` |
| 2 | Founder agreements signed | Concept | `founder agreements vesting equity split` |
| 3 | Basic terms of service exist | Concept | `terms of service privacy policy legal basics` |
| 4 | Employment agreements in place | Early | `employment agreements contracts offer letters` |
| 5 | Contractor agreements standardized | Early | `contractor agreements independent consultant NDA` |
| 6 | IP assignment agreements signed | Early | `IP assignment intellectual property agreements signed` |
| 7 | Privacy policy published | Early | `privacy policy data handling published GDPR` |
| 8 | Cap table properly maintained | Validated | `cap table maintained clean accurate equity` |
| 9 | Data handling compliant (GDPR/CCPA) | Validated | `data handling GDPR CCPA compliance privacy regulation` |
| 10 | Customer contracts standardized | Validated | `customer contracts MSA SaaS agreement standardized` |
| 11 | Insurance coverage in place | Validated | `insurance coverage D&O liability E&O` |
| 12 | Regulatory requirements mapped | Validated | `regulatory requirements mapped industry compliance` |
| 13 | IP portfolio documented | Scaling | `IP portfolio patents trademarks trade secrets documented` |
| 14 | SOC2 or equivalent compliance | Scaling | `SOC2 compliance audit certification security` |
| 15 | International legal framework | Scaling | `international legal framework cross-border compliance` |
| 16 | Legal counsel retained | Scaling | `legal counsel retained attorney law firm` |
| 17 | Shareholder agreement comprehensive | Scaling | `shareholder agreement rights obligations governance` |
| 18 | Full regulatory compliance demonstrated | Leader | `regulatory compliance demonstrated certified approved` |
| 19 | Patent portfolio active | Leader | `patent portfolio filed granted IP protection` |
| 20 | Legal readiness for exit (M&A/IPO) | Leader | `legal readiness exit M&A IPO due diligence ready` |

**Maturity stage interpretation for Legal & Compliance:**
- **Concept** (0–4): Incorporated, basic agreements
- **Early** (5–8): Employment/contractor/IP agreements, privacy policy
- **Validated** (9–13): Data compliance, standardized contracts, insurance
- **Scaling** (14–17): IP portfolio, SOC2, international framework, legal counsel
- **Leader** (18–20): Full regulatory compliance, active patents, exit-ready

---

### Prompt Template

Customize `[CATEGORY_TITLE]`, `[CATEGORY_ID]`, and the input variable reference per node:

```
You are evaluating a startup's [CATEGORY_TITLE] based on available information.

## Company
{{company_name}}

## Available Information for [CATEGORY_TITLE]
{{context_[CATEGORY_ID]}}

## Evaluation Task

Analyze the information and produce a structured assessment.

### Scoring Guidelines
- 80-100: Specific metrics, strong evidence, multiple data points
- 60-79: Good qualitative info, some gaps in specifics
- 40-59: High-level overview only, significant gaps
- 20-39: Brief mentions, needs follow-up
- 0-19: Not addressed or insufficient

### Status Derivation
- completeness >= 70 → "proven"
- completeness >= 40 → "partial"
- completeness < 40 → "unproven"

### Requirements
- category_id must be "[CATEGORY_ID]"
- category_title must be "[CATEGORY_TITLE]"
- Be specific — reference actual information from the context
- Do not fabricate data
- highlights should reference concrete information shared
- gaps should be actionable areas to explore in a deep-dive
- deepDivePrompt should be a natural 2-3 sentence follow-up opener

Output valid JSON only, no markdown or explanation.
```

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
