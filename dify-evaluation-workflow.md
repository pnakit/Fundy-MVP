# Dify Evaluation Workflow Setup Guide

## Overview

This document describes how to create the evaluation workflow in Dify Studio. The workflow receives pre-retrieved context for each of the 10 evaluation categories and runs 10 parallel LLM branches to produce structured evaluation results.

**Workflow type**: Workflow (not Chatflow) — single-execution automation triggered via API.

## Creating the Workflow in Dify Studio

### Step 1: Create the app
- In Dify Studio, click **Create App** → select **Workflow** (not Chatflow)
- Name it something like "Startup Evaluation"

### Step 2: Configure the Start node
- The **Start** node is already on the canvas — this is the only starting node type for Workflows
- Click the Start node and add the 11 input variables listed in the "Input Variables" section below
- The Start node receives these variables via our API call (`POST /workflows/run`)

### Step 3: Add 10 LLM nodes
- Drag 10 LLM nodes from the Start node — they will run in **parallel**
- Name each node exactly as specified in the "Node Naming Convention" section (e.g., `eval_product_technology`)
- Each LLM node reads its corresponding `context_*` variable from the Start node

### Step 4: Connect to End
- Connect all 10 LLM node outputs directly to the **End** node
- **Do NOT add a Variable Aggregator** — we want each branch to fire `node_finished` independently for streaming

### Trigger
Dify Workflow apps are **API-triggered**. Our serverless function `api/evaluation/generate.js` calls `POST {DIFY_BASE_URL}/workflows/run` with `response_mode: "streaming"` and the input variables. No special trigger configuration needed — the Start node receives variables automatically via the API.

**From the user's perspective**: They click "Generate Evaluation" in the webapp → our API does KB retrieval → calls this Dify workflow → streams results back.

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
