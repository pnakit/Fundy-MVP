# Dify Onboarding Chatflow — Per-Node Configuration Guide

> **How to use:** Each section below maps to a specific node in the Dify onboarding chatflow. Copy the prompt text (between the `` ``` `` blocks) and paste it into the corresponding node's system prompt in Dify Studio.

## Chatflow Architecture

```
USER INPUT
  → IF/ELSE (files uploaded?)
    → FILE EXTRACTOR → LLM IS REVIEWING YOUR RESPONSE → variable assigners
  → ASSIGNER (user_provided_responses, user_last_response)
  → COMBINER USER AND FILES
  → APPEND KEY INFO BY CATE (10 category variables)
  → CODE CONCATENATE CATEG → CODE CURRENT_TOPIC_CON
  → QUESTION CLASSIFIER 2 (5 classes)
    → CLASS 1 (finish): → CODE CONSOLIDATED_CON → ANSWER 3 → GENERATING ONBOARDING → ANSWER (summary)
    → CLASS 2 (skip): → NEXT QUESTION LLM → IF/ELSE (next or dig deeper) → ANSWER
    → CLASS 3 (answer): → RESPONSE PROCESSING LLM → IF/ELSE 4 (follow-up?) → ANSWER 7 or continue
    → CLASS 4 (clarification): → QUESTION CLARIFICATION → ANSWER 6
    → CLASS 5 (off-topic): → ANSWER 5 (redirect)
  → IF/ELSE 2 (current_question_index > 9?) → summary generation path
  → NEXT QUESTION LLM → IF/ELSE (NEXT OR DIG DEEP) → ANSWER 4 or ANSWER 6
```

## Update Order

Apply changes in this order (dependency chain):

1. APPEND KEY INFO BY CATE (foundation — new variable names)
2. LLM IS REVIEWING YOUR RESPONSE (extraction → new category fields)
3. CODE CONCATENATE CATEG + CODE CONSOLIDATED_CON (reference new field names)
4. NEXT QUESTION LLM (10-question bank + escalation)
5. RESPONSE PROCESSING LLM (evidence-aware follow-up)
6. IF/ELSE 2 (threshold: > 8 → > 9)
7. GENERATING ONBOARDING (evidence-aligned summary)

---

## Node: APPEND KEY INFO BY CATE

**Type:** Variable Assigner (code node)
**Purpose:** Aggregates extracted information into per-category conversation variables

### Variable Mapping

Replace the current variables with these 11 variables (10 categories + company_name):

| Variable | Mode | Source Field | Was (old name) |
|----------|------|-------------|----------------|
| `company_name` | OVERWRITE | `extracted_data.company_name` | `company_name` (unchanged) |
| `product_technology` | OVERWRITE | `extracted_data.product_technology` | `problem_and_audience` |
| `market_traction` | OVERWRITE | `extracted_data.market_traction` | `momentum_metrics` |
| `business_model` | OVERWRITE | `extracted_data.business_model` | NEW |
| `team_organization` | OVERWRITE | `extracted_data.team_organization` | `team_info` |
| `go_to_market` | OVERWRITE | `extracted_data.go_to_market` | `gtm_strategy` |
| `financial_health` | OVERWRITE | `extracted_data.financial_health` | NEW |
| `fundraising_capital` | OVERWRITE | `extracted_data.fundraising_capital` | `existing_backers` + `fundraising_status` (merged) |
| `competitive_position` | OVERWRITE | `extracted_data.competitive_position` | `competitive_advantage` |
| `operations` | OVERWRITE | `extracted_data.operations` | NEW (was partially in `key_risks`) |
| `legal_compliance` | OVERWRITE | `extracted_data.legal_compliance` | NEW |

**Remove:** `key_risks`, `context_highlights` (cross-cutting info now captured in relevant categories)

---

## Node: LLM IS REVIEWING YOUR RESPONSE

**Type:** LLM (gpt-4.1)
**Purpose:** Extracts structured information from user responses and uploaded files into 10 evaluation categories

### System Prompt

```
The user has provided information as part of their startup onboarding.

User response:
<user_response>{{#conversation.user_last_response#}}</user_response>
File response:
<file_content>{{#conversation.extracted_file_content#}}</file_content>

Analyze this and extract information relevant to the 10 evaluation categories below. Do not include information that does not appear in the provided user_response or file_content. If there is no relevant information for a category, use "NO_DATA".

Output JSON:
{
  "response_file_type": "<written/pitch deck/financials/cap table/other>",
  "extracted_data": {
    "company_name": "<if present, NO_DATA if not>",
    "product_technology": "<product, problem, tech stack, users, features — NO_DATA if not>",
    "market_traction": "<revenue, customers, growth, channels, retention — NO_DATA if not>",
    "business_model": "<pricing, margins, unit economics, cost structure — NO_DATA if not>",
    "team_organization": "<founders, team, hires, backgrounds, roles — NO_DATA if not>",
    "go_to_market": "<sales motion, distribution, leads, conversion — NO_DATA if not>",
    "financial_health": "<burn rate, runway, reporting, projections — NO_DATA if not>",
    "fundraising_capital": "<funding raised, investors, pipeline, cap table — NO_DATA if not>",
    "competitive_position": "<competitors, differentiation, moat, win/loss — NO_DATA if not>",
    "operations": "<tools, processes, support, uptime, dev process — NO_DATA if not>",
    "legal_compliance": "<incorporation, agreements, IP, compliance — NO_DATA if not>"
  },
  "key_highlights": ["<highlight 1>", "<highlight 2>"],
  "summary": "<2-3 sentence summary of the response>"
}
```

---

## Node: CODE CONCATENATE CATEG + CODE CONSOLIDATED_CON

**Type:** Code nodes
**Purpose:** Concatenate category variables into a single context string for downstream nodes

### Field Reference Updates

Update all references from old variable names to new ones:

| Old Reference | New Reference |
|--------------|--------------|
| `problem_and_audience` | `product_technology` |
| `momentum_metrics` | `market_traction` |
| `gtm_strategy` | `go_to_market` |
| `existing_backers` | `fundraising_capital` |
| `fundraising_status` | (merged into `fundraising_capital`) |
| `competitive_advantage` | `competitive_position` |
| `team_info` | `team_organization` |
| `key_risks` | (removed — captured in relevant categories) |
| `context_highlights` | (removed) |
| — | `business_model` (NEW) |
| — | `financial_health` (NEW) |
| — | `operations` (NEW) |
| — | `legal_compliance` (NEW) |

The concatenated output should include all 10 categories with labeled sections:

```python
# Example structure for the consolidated context
sections = [
    ("Product & Technology", product_technology),
    ("Market Traction & Revenue", market_traction),
    ("Business Model & Economics", business_model),
    ("Team & Organization", team_organization),
    ("Go-to-Market", go_to_market),
    ("Financial Health", financial_health),
    ("Fundraising & Capital", fundraising_capital),
    ("Competitive Position", competitive_position),
    ("Operations", operations),
    ("Legal & Compliance", legal_compliance),
]

result = f"Company: {company_name}\n\n"
for title, content in sections:
    if content and content != "NO_DATA":
        result += f"## {title}\n{content}\n\n"
```

---

## Node: NEXT QUESTION LLM

**Type:** LLM (gpt-5)
**Purpose:** Decides whether the current topic is complete or needs a dig-deeper follow-up, and generates the next question

### System Prompt

```
You are conducting a founder onboarding conversation. Based on what's been collected so far, decide whether to dig deeper into the current topic or move to the next question.

Current question index: {{#conversation.current_question_index#}}
Current question: {{#conversation.current_question_text#}}

Already collected on this topic:
<current_topic>{{#1772125942607.current_topic_context#}}</current_topic>

## Question Bank (10 questions)

1. Tell me about your product — what problem does it solve, who is it for, and where are you in building it?
2. How are you acquiring customers and generating revenue? Walk me through your traction so far.
3. How does your business make money? Tell me about your pricing, costs, and how the economics work.
4. Tell me about your team — who are the founders, what's everyone's background, and who else have you brought on?
5. How do you find and sell to customers? Walk me through your go-to-market approach.
6. What does your financial picture look like — burn rate, runway, and how you track your finances?
7. Where are you in your fundraising journey? Have you raised capital, and what are your plans?
8. Who are your main competitors, and what makes you different? How do customers choose between you and alternatives?
9. How does your team work day-to-day? What tools and processes keep things running?
10. What's your legal setup? Are you incorporated, and do you have key agreements in place?

## Adaptive Escalation Rules

Assess the depth of the founder's response for the current topic:

**Concept-level only** (vague idea, no execution evidence):
- Set topicComplete to true. Move on — the deep-dive phase will handle depth.

**Early-level** (real traction — working product, paying customers, defined processes):
- Set topicComplete to false. Ask ONE dig-deeper question probing the next level:
  - Q1 (Product): "Are you seeing product-market fit signals? How do you know customers are getting measurable value?"
  - Q2 (Market): "What does your revenue growth look like month-over-month? Do you know your customer acquisition cost?"
  - Q3 (Business): "Have you estimated customer lifetime value? What does your LTV:CAC ratio look like?"
  - Q4 (Team): "Do you have prior startup experience on the team? How's retention been?"
  - Q5 (GTM): "Is your customer acquisition repeatable? Do you know your sales cycle length?"
  - Q6 (Financial): "Do you have 12+ months of runway? Any financial projections or cash flow forecasts?"
  - Q7 (Fundraising): "Do you have a lead investor lined up? Is your data room ready for due diligence?"
  - Q8 (Competitive): "Have you done win/loss analysis? What's your technical moat?"
  - Q9 (Operations): "Do you have SLAs defined? How do you handle vendor management and QA?"
  - Q10 (Legal): "Is your cap table properly maintained? Are you tracking data compliance (GDPR/CCPA)?"

**Validated-level or higher** (repeatable success, metrics, systems):
- Set topicComplete to true. They've provided strong signal — move on.

## Rules
- Reference what they've already shared to make the next question feel personalized
- Keep it conversational, 2-3 sentences max
- Maximum 1 dig-deeper per topic

Output strict JSON:
{
  "topicComplete": <true/false>,
  "nextQuestion": "<the next question from the bank above>",
  "digDeeperQuestion": "<a follow-up probing the next maturity level for the current topic>"
}
```

### Output Variables
- `topicComplete` (Boolean) — whether current topic has enough info
- `nextQuestion` (String) — the next question to ask
- `digDeeperQuestion` (String) — dig-deeper follow-up for current topic

---

## Node: RESPONSE PROCESSING LLM

**Type:** LLM (gpt-4.1)
**Purpose:** Processes a founder's response to extract info and decide if a follow-up is needed

### System Prompt

```
You are processing a founder's response to an onboarding question.

Question being answered: <current_question>{{#conversation.current_question_text#}}</current_question>
User's response: <user_response>{{#1772125942607.current_topic_context#}}</user_response>

Review the user's response and extract a concise summary of what they shared, addressed directly to the user. Assess whether the response provides enough foundational information to move on, or if a follow-up would meaningfully improve the evaluation signal.

A response is sufficient (needs_followup = false) if the founder has addressed the core aspects of the question — even at a high level. Do NOT request follow-up just because they didn't provide exhaustive detail; the deep-dive phase handles depth.

A response needs follow-up (needs_followup = true) only if critical foundational information is missing — for example, they described the problem but never mentioned who the target user is, or they discussed revenue but never mentioned how they charge.

Output JSON:
{
  "extracted_info": "<concise summary of what they shared, addressed to the user>",
  "needs_followup": <true/false>,
  "followup_question": "<if needs_followup is true, ask for the specific missing foundational information>"
}
```

### Output Variables
- `extracted_info` (String) — summary of what was shared
- `needs_followup` (Boolean) — whether a follow-up is needed
- `followup_question` (String) — the follow-up question if needed

---

## Node: IF/ELSE 2

**Type:** IF/ELSE condition
**Purpose:** Triggers summary generation when all questions have been asked

### Condition Update

**Old:** `current_question_index > 8`
**New:** `current_question_index > 9`

This ensures all 10 questions are asked before the summary is generated (up from 8).

---

## Node: GENERATING ONBOARDING

**Type:** LLM (gpt-4.1)
**Purpose:** Generates the final structured onboarding summary JSON

### System Prompt

```
You are generating the final onboarding summary for a startup founder.
Analyze the collected conversation data and produce a structured evaluation.

## Input Data

<company_background>
{{#1772817017117.consolidated_context#}}
</company_background>

Use only the information present in <company_background>. Do not infer, hallucinate, or fill gaps with invented data.

## Categories

Output exactly 10 category objects in this order, using these exact id values:

1. id: "product_technology"    — title: "Product & Technology"
2. id: "market_traction"       — title: "Market Traction & Revenue"
3. id: "business_model"        — title: "Business Model & Economics"
4. id: "team_organization"     — title: "Team & Organization"
5. id: "go_to_market"          — title: "Go-to-Market"
6. id: "financial_health"      — title: "Financial Health"
7. id: "fundraising_capital"   — title: "Fundraising & Capital"
8. id: "competitive_position"  — title: "Competitive Position"
9. id: "operations"            — title: "Operations"
10. id: "legal_compliance"     — title: "Legal & Compliance"

## Completeness Scoring (0-100)

Score based on the quality and depth of information provided:

- **80-100**: Detailed, specific information with metrics or evidence
- **60-79**: Good context but missing some specifics or quantitative data
- **40-59**: Mentioned briefly or at a high level only
- **20-39**: Minimal information or only tangentially related details
- **0-19**: Not discussed at all

## Field Rules

**companyName** — Extract from the conversation. Use "Unknown" if not mentioned.

**overallCompleteness** — Integer 0-100. Weighted average of all 10 category scores.

**summary** — 1-2 sentences describing only what was explicitly shared. Reference concrete evidence. Use "Not discussed." if the section was empty.

**highlights** — Concrete strengths or positive signals stated by the founder. Reference specific evidence (metrics, facts, quotes). Empty array [] if none.

**gaps** — The most impactful missing information for this category. Frame as information gaps, not action items (the evaluation phase handles actions). Include at least one entry for every category with completeness < 70. Use ["Not yet discussed"] for empty sections.

**keyMetrics** — Key/value pairs for any specific metrics explicitly stated (numbers, stages, names). All values must be strings. Empty object {} if none. Example: {"mrr": "$50K", "team_size": "8", "stage": "Seed"}

**deepDivePrompt** — A specific, evidence-aware follow-up opener that:
1. References specific information the founder already shared (personalized, not generic)
2. Probes the 2-3 most impactful gaps for this category
3. Feels like a natural conversation continuation, not a checklist

Good example: "You mentioned 3 pilots are using the platform — that's great early traction. I'd love to understand how you're collecting feedback from those pilots. Are they getting measurable value from the regulatory mapping?"

Bad example: "Let's talk more about your product and technology."
```

### Output Format

The node's output is wrapped by the ANSWER 3 node which prepends a conversational closing paragraph and wraps the JSON in delimiters:

```
Thank you for sharing all this information about {{company_name}}! I've compiled everything into a comprehensive evaluation across 10 key dimensions.

[ONBOARDING_SUMMARY]
{...json...}
[/ONBOARDING_SUMMARY]
```

---

## Summary JSON Schema (unchanged)

The output JSON schema is unchanged from the current implementation. The frontend parser (`src/utils/extractSummary.js`) expects this exact format:

```json
{
  "version": "1.0",
  "companyName": "<company name>",
  "generatedAt": "<ISO 8601 timestamp>",
  "overallCompleteness": 0-100,
  "categories": [
    {
      "id": "<category_id>",
      "title": "<category_title>",
      "summary": "<1-2 sentences>",
      "completeness": 0-100,
      "status": "complete|needs_attention|incomplete",
      "highlights": ["..."],
      "gaps": ["..."],
      "keyMetrics": {},
      "deepDivePrompt": "<personalized follow-up opener>"
    }
  ]
}
```

**Status derivation:** `completeness >= 70` → `"complete"`, `>= 40` → `"needs_attention"`, `< 40` → `"incomplete"`

---

## Evidence Item Reference

For context on what the evaluation workflow scores against, each category has 20 evidence items organized by maturity gate (Concept → Early → Validated → Scaling → Leader). The primary onboarding questions target items 1-7 (Concept + Early gates). The adaptive escalation probes items 8-13 (Validated gate) when the founder demonstrates maturity.

Full evidence item tables are in `dify-evaluation-workflow.md` under each category's environment variable section.

### Question-to-Category Mapping

| Q# | Primary Question | Category ID | Evidence Items Targeted |
|----|-----------------|-------------|------------------------|
| 1 | "Tell me about your product..." | `product_technology` | #1-7 (product, problem, users, architecture, customers, features, feedback) |
| 2 | "How are you acquiring customers..." | `market_traction` | #1-7 (market, value prop, first customer, revenue model, MRR, channels, retention) |
| 3 | "How does your business make money..." | `business_model` | #1-7 (model, pricing, WTP, tiers, margins, costs, ARPU) |
| 4 | "Tell me about your team..." | `team_organization` | #1-7 (founders, domain expertise, technical, full-time, hires, roles, compensation) |
| 5 | "How do you find and sell to customers..." | `go_to_market` | #1-7 (ICP, distribution, manual sales, motion, website, leads, conversion) |
| 6 | "What does your financial picture look like..." | `financial_health` | #1-7 (records, burn, revenue, reporting, runway, budget, rev vs expenses) |
| 7 | "Where are you in your fundraising journey..." | `fundraising_capital` | #1-7 (need, use of funds, materials, seed, cap table, relationships, valuation) |
| 8 | "Who are your main competitors..." | `competitive_position` | #1-7 (competitors, differentiation, awareness, matrix, UVP, preference, switching costs) |
| 9 | "How does your team work day-to-day..." | `operations` | #1-7 (tools, communication, PM, dev process, support, uptime, incidents) |
| 10 | "What's your legal setup..." | `legal_compliance` | #1-7 (incorporated, founder agreements, ToS, employment, contractor, IP, privacy) |

### Adaptive Escalation Dig-Deeper Questions

| Q# | Dig-Deeper (probes Validated gate, items 9-13) |
|----|------------------------------------------------|
| 1 | "Are you seeing product-market fit signals? How do you know customers are getting measurable value?" |
| 2 | "What does your revenue growth look like month-over-month? Do you know your customer acquisition cost?" |
| 3 | "Have you estimated customer lifetime value? What does your LTV:CAC ratio look like?" |
| 4 | "Do you have prior startup experience on the team? How's retention been?" |
| 5 | "Is your customer acquisition repeatable? Do you know your sales cycle length?" |
| 6 | "Do you have 12+ months of runway? Any financial projections or cash flow forecasts?" |
| 7 | "Do you have a lead investor lined up? Is your data room ready for due diligence?" |
| 8 | "Have you done win/loss analysis? What's your technical moat?" |
| 9 | "Do you have SLAs defined? How do you handle vendor management and QA?" |
| 10 | "Is your cap table properly maintained? Are you tracking data compliance (GDPR/CCPA)?" |
