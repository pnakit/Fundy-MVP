# Investment Matching Workflow — Ground-Up Rebuild Guide

## Overview

This document is the authoritative setup guide for the **Investment Matching** Dify workflow (Phase 2 of the evaluation pipeline).

**No repo code changes are needed.** `api/evaluation/_difyWorkflow.js` already handles this workflow correctly:
- `calculate_maturity` node_started → fires `investment_matching_started` event
- `calculate_maturity` node_finished → fires `maturity_calculated` event
- `generate_matrix` node_finished → fires `status "Matching investment profiles..."` keepalive
- Any node_finished with `outputs.investment_readiness_summary` → fires `investment_recommendations_complete`
- `workflow_finished` → fires `workflow_complete`

---

## Workflow Architecture

```
START → Variable Aggregator → calculate_maturity → generate_matrix → investment_recommendations (LLM) → parse_recommendations
```

---

## Step 1 — Create a New Dify Workflow

1. Open Dify Studio → **Create Workflow** → name it **"Investment Matching v2"**
2. After publishing and confirming it works, update `DIFY_INVESTMENT_API_KEY` in Vercel to the new key
3. The old workflow can remain inactive until the new one is confirmed working

---

## Step 2 — Configure the START Node

Add these input variables:

| Variable | Type |
|---|---|
| `eval_product_technology` | Object |
| `eval_market_traction` | Object |
| `eval_business_model` | Object |
| `eval_team_organization` | Object |
| `eval_go_to_market` | Object |
| `eval_financial_health` | Object |
| `eval_fundraising_capital` | Object |
| `eval_competitive_position` | Object |
| `eval_operations` | Object |
| `eval_legal_compliance` | Object |
| `user_id` | String |

---

## Step 3 — Variable Aggregator

- Add a **Variable Aggregator** node after START
- Add all 10 `eval_*` inputs from the START node as inputs
- Leave the output variable name as the default (usually `output`)
- This produces a single aggregated variable passed to `calculate_maturity`

---

## Step 4 — `calculate_maturity` (Code Node)

- **Node title:** `calculate_maturity` (exact, lowercase)
- **Input variable:** bind to the Variable Aggregator output — name the input parameter `aggregated_evaluations`
- **Python code:** copy exactly from `dify-phase2-nodes/calculate_maturity.py`

### Output variables to declare in Dify

| Output | Type |
|---|---|
| `maturity_score` | Number |
| `maturity_stage` | String |
| `maturity_label` | String |
| `overall_completeness` | Number |
| `performance_level` | String |
| `performance_label` | String |
| `category_scores` | String |
| `category_details` | String |
| `strongest_categories` | String |
| `weakest_categories` | String |

### Critical note

The code handles all three input forms and filters out non-dict items:
```python
if isinstance(aggregated_evaluations, str):
    aggregated_evaluations = json.loads(aggregated_evaluations)
if isinstance(aggregated_evaluations, dict):
    aggregated_evaluations = list(aggregated_evaluations.values())
aggregated_evaluations = [item for item in aggregated_evaluations if isinstance(item, dict)]
```

- **String** → `json.loads` first (Dify test panel passes pasted JSON as text)
- **Dict** → `.values()` to extract the 10 eval objects (Variable Aggregator Object mode)
- **List** → already correct (Variable Aggregator Array mode)
- **Filter** → removes any scalar values (e.g. `user_id: "test-user-123"` if present in the input)

---

## Step 5 — `generate_matrix` (Code Node)

- **Node title:** `generate_matrix` (exact, lowercase)
- **Input variables** (bind from `calculate_maturity` outputs):
  - `maturity_stage` → String
  - `performance_level` → String
  - `category_scores` → String
  - `category_details` → String
- **Python code:** copy exactly from `dify-phase2-nodes/generate_matrix.py`

### Output variables to declare

| Output | Type |
|---|---|
| `recommendations_json` | String |
| `suitable_types` | String |
| `conditional_types` | String |
| `not_suitable_types` | String |
| `suitable_count` | Number |
| `conditional_count` | Number |

---

## Step 6 — `investment_recommendations` (LLM Node)

- **Node title:** `investment_recommendations` (any name — detection is by output shape, not title)
- **Model:** GPT-4o or Claude 3.5 Sonnet
- **Output variable:** single text output (default `text`)

### System prompt

```
You are an expert startup investment advisor. Generate detailed, actionable investment recommendations in valid JSON only — no markdown, no explanation, no code fences.
```

### User prompt

```
## Startup Maturity Assessment
Stage: {{#calculate_maturity.maturity_label#}}
Score: {{#calculate_maturity.maturity_score#}}/1000
Performance: {{#calculate_maturity.performance_label#}} ({{#calculate_maturity.overall_completeness#}}%)

## Investment Type Analysis
{{#generate_matrix.recommendations_json#}}

Suitable types ({{#generate_matrix.suitable_count#}}): {{#generate_matrix.suitable_types#}}
Conditional types ({{#generate_matrix.conditional_count#}}): {{#generate_matrix.conditional_types#}}
Not suitable: {{#generate_matrix.not_suitable_types#}}

## Output Format
Return ONLY this JSON structure (no markdown, no extra text):
{
  "investment_readiness_summary": {
    "assessment": "2-3 sentence overall investment readiness assessment",
    "primary_recommendation": "Name of the single best-fit investment type",
    "readiness_score": "Low|Moderate|High"
  },
  "recommended_funding": [
    {
      "investment_type": "type_id",
      "rating": "ideal|strong_fit|acceptable",
      "fit_explanation": "2-3 sentences explaining fit",
      "typical_terms": "Size and valuation range",
      "investor_expectations": ["expectation 1", "expectation 2", "expectation 3"],
      "prepare_for_objections": ["objection 1", "objection 2"]
    }
  ],
  "conditional_options": [
    {
      "investment_type": "type_id",
      "conditions_for_fit": "Specific milestone that unlocks this",
      "improvements_needed": [
        {
          "category": "category_id",
          "current_state": "Current situation",
          "target_state": "Required state",
          "actions": ["action 1", "action 2", "action 3"]
        }
      ]
    }
  ],
  "improvement_roadmap": [
    {
      "priority": 1,
      "category": "category_id",
      "current_score": 45,
      "target_score": 70,
      "unlocks": ["investment_type_id"],
      "specific_actions": ["action 1", "action 2", "action 3"],
      "timeline": "2-3 months"
    }
  ],
  "not_recommended": [
    {
      "investment_type": "type_id",
      "reason": "Concise reason why not suitable now"
    }
  ],
  "next_steps": [
    {
      "priority": 1,
      "action": "Specific actionable next step",
      "timeline": "X weeks",
      "expected_outcome": "What this unlocks"
    }
  ]
}

Rules:
- recommended_funding: only types with rating "ideal", "strong_fit", or "acceptable"
- conditional_options: only types with rating "conditional" or "marginal"
- not_recommended: only types rated "not_suitable"
- improvement_roadmap: top 3 categories with lowest scores that matter for recommended/conditional types
- next_steps: exactly 5 steps ordered by impact
- Valid investment_type IDs: grant_funding, pre_seed, seed, series_a, venture_debt, revenue_based_financing
- readiness_score: "Low" if score < 300, "Moderate" if 300-600, "High" if > 600
```

---

## Step 7 — `parse_recommendations` (Code Node)

- **Node title:** `parse_recommendations` (any name)
- **Input variable:** `investment_json` bound to the LLM node's `text` output

### Python code

```python
import json
import re
import ast

def main(investment_json) -> dict:
    # Dify may auto-parse the LLM JSON string into a Python dict before passing it here
    if isinstance(investment_json, dict):
        data = investment_json
    else:
        text = investment_json.strip()
        # Strip markdown code fences if the LLM wraps with ```json ... ```
        match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
        if match:
            text = match.group(1).strip()
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            # Dify may have str()'d a Python dict (single-quoted), use ast as fallback
            data = ast.literal_eval(text)

    return {
        "investment_readiness_summary": data.get("investment_readiness_summary", {}),
        "recommended_funding": data.get("recommended_funding", []),
        "conditional_options": data.get("conditional_options", []),
        "improvement_roadmap": data.get("improvement_roadmap", []),
        "not_recommended": data.get("not_recommended", []),
        "next_steps": data.get("next_steps", []),
    }
```

### Output variables to declare

| Output | Type |
|---|---|
| `investment_readiness_summary` | Object |
| `recommended_funding` | Array |
| `conditional_options` | Array |
| `improvement_roadmap` | Array |
| `not_recommended` | Array |
| `next_steps` | Array |

**Why this node matters:** `_difyWorkflow.js` detects `investment_recommendations_complete` by checking `if (outputs.investment_readiness_summary)` on `node_finished` events. This Code node creates that output variable reliably, and also handles LLMs that wrap their output in markdown code fences.

---

## Step 8 — Connect Nodes and Publish

```
START → Variable Aggregator → calculate_maturity → generate_matrix → investment_recommendations (LLM) → parse_recommendations → END
```

Publish the workflow, copy the API key, update `DIFY_INVESTMENT_API_KEY` in Vercel.

---

## Step 9 — Test in Dify Studio First

Before updating Vercel, run the workflow in Dify Studio using the **Run** button. The Run panel shows each input variable as a separate labelled field — paste **only the value** into each field (not `"key": value` pairs).

### Values to paste per field

**`eval_product_technology`**
```json
{"category_id": "product_technology", "completeness": 65, "status": "partial", "highlights": ["MVP built"], "gaps": ["No scalability plan"], "summary": "Early stage product"}
```

**`eval_market_traction`**
```json
{"category_id": "market_traction", "completeness": 40, "status": "partial", "highlights": ["10 customers"], "gaps": ["No ARR data"], "summary": "Limited traction"}
```

**`eval_business_model`**
```json
{"category_id": "business_model", "completeness": 55, "status": "partial", "highlights": [], "gaps": [], "summary": ""}
```

**`eval_team_organization`**
```json
{"category_id": "team_organization", "completeness": 70, "status": "proven", "highlights": [], "gaps": [], "summary": ""}
```

**`eval_go_to_market`**
```json
{"category_id": "go_to_market", "completeness": 50, "status": "partial", "highlights": [], "gaps": [], "summary": ""}
```

**`eval_financial_health`**
```json
{"category_id": "financial_health", "completeness": 35, "status": "unproven", "highlights": [], "gaps": [], "summary": ""}
```

**`eval_fundraising_capital`**
```json
{"category_id": "fundraising_capital", "completeness": 30, "status": "unproven", "highlights": [], "gaps": [], "summary": ""}
```

**`eval_competitive_position`**
```json
{"category_id": "competitive_position", "completeness": 45, "status": "partial", "highlights": [], "gaps": [], "summary": ""}
```

**`eval_operations`**
```json
{"category_id": "operations", "completeness": 60, "status": "partial", "highlights": [], "gaps": [], "summary": ""}
```

**`eval_legal_compliance`**
```json
{"category_id": "legal_compliance", "completeness": 80, "status": "proven", "highlights": [], "gaps": [], "summary": ""}
```

**`user_id`**
```
test-user-123
```

Confirm that `parse_recommendations` outputs contain `investment_readiness_summary` before updating Vercel.
