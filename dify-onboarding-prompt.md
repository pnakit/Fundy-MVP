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
  → ONBOARDING PROCESSOR LLM (single node — classifies, processes, generates response)
  → IF/ELSE: intent == "finish"
    → YES: CODE CONSOLIDATED_CON → ANSWER 3 → GENERATING ONBOARDING → ANSWER (summary)
    → NO: IF/ELSE: topicComplete == true
      → YES: increment current_question_index variable
        → IF/ELSE 2 (current_question_index > 9?) → summary generation path
        → ANSWER (show response)
      → NO: ANSWER (show response — follow-up, dig-deeper, clarification, or redirect)
```

### Nodes removed (merged into ONBOARDING PROCESSOR)
- ~~QUESTION CLASSIFIER 2~~ (5-class intent routing)
- ~~RESPONSE PROCESSING LLM~~ (answer extraction + follow-up decision)
- ~~NEXT QUESTION LLM~~ (next question / dig-deeper decision)
- ~~QUESTION CLARIFICATION~~ (clarification LLM)

This reduces sequential LLM calls from 3-4 to 1-2 per message (~15-20s savings).

## Migration Steps

1. Delete: QUESTION CLASSIFIER 2, RESPONSE PROCESSING LLM, NEXT QUESTION LLM, QUESTION CLARIFICATION
2. Add: ONBOARDING PROCESSOR LLM node (paste prompt below)
3. Wire: CODE CURRENT_TOPIC_CON → ONBOARDING PROCESSOR → IF/ELSE (intent == "finish")
4. Wire: IF/ELSE YES → CODE CONSOLIDATED_CON → existing summary path
5. Wire: IF/ELSE NO → IF/ELSE (topicComplete == true) → increment index + IF/ELSE 2 / ANSWER
6. ANSWER nodes: bind `response` output from ONBOARDING PROCESSOR as the answer text

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

## Node: CODE CURRENT_TOPIC_CON

**Type:** Code node
**Purpose:** Selects the current topic's accumulated data by question index and outputs as a clean string for downstream LLM nodes

### Code

```python
def main(**kwargs):
    idx = int(kwargs.get("current_topic_index") or 0)

    mapping = {
        1: kwargs.get("product_technology") or [],
        2: kwargs.get("market_traction") or [],
        3: kwargs.get("business_model") or [],
        4: kwargs.get("team_organization") or [],
        5: kwargs.get("go_to_market") or [],
        6: kwargs.get("financial_health") or [],
        7: kwargs.get("fundraising_capital") or [],
        8: kwargs.get("competitive_position") or [],
        9: kwargs.get("operations") or [],
        10: kwargs.get("legal_compliance") or [],
    }

    selected = mapping.get(idx, [])

    if selected is None:
        selected = []
    if isinstance(selected, str):
        selected = [selected]
    if not isinstance(selected, list):
        selected = [str(selected)]
    selected = [str(x) for x in selected]
    selected = "\n".join(selected)

    return {"current_topic_context": selected}
```

**Output variable:** `current_topic_context` (type: `string`)

---

## Node: CODE CONSOLIDATED_CON

**Type:** Code node
**Purpose:** Concatenates all 10 category variables into a single XML-tagged context string for the summary generation LLM

### Code

```python
def main(
    company_name: str,
    product_technology: str,
    market_traction: str,
    business_model: str,
    team_organization: str,
    go_to_market: str,
    financial_health: str,
    fundraising_capital: str,
    competitive_position: str,
    operations: str,
    legal_compliance: str,
) -> dict:

    def section(tag: str, title: str, value: str) -> str:
        value = (value or "").strip()
        if not value:
            return ""
        return f"<{tag}>\n{title}\n{value}\n</{tag}>"

    parts = [
        section("company",              "## Company",                    company_name),
        section("product_technology",    "## Product & Technology",       product_technology),
        section("market_traction",       "## Market Traction & Revenue",  market_traction),
        section("business_model",        "## Business Model & Economics", business_model),
        section("team_organization",     "## Team & Organization",        team_organization),
        section("go_to_market",          "## Go-to-Market",               go_to_market),
        section("financial_health",      "## Financial Health",           financial_health),
        section("fundraising_capital",   "## Fundraising & Capital",      fundraising_capital),
        section("competitive_position",  "## Competitive Position",       competitive_position),
        section("operations",            "## Operations",                 operations),
        section("legal_compliance",      "## Legal & Compliance",         legal_compliance),
    ]

    consolidated = "\n\n".join(p for p in parts if p)
    return {"consolidated_context": consolidated}
```

**Output variable:** `consolidated_context` (type: `string`)
**Removed:** `context_highlights` parameter (cross-cutting info now captured in relevant categories)

---

## Node: ONBOARDING PROCESSOR LLM

**Type:** LLM (gpt-4.1)
**Purpose:** Single node that classifies intent, processes the response, and generates the conversational reply. Replaces the old QUESTION CLASSIFIER + RESPONSE PROCESSING + NEXT QUESTION chain.

### System Prompt

```
You are conducting a startup founder onboarding conversation. Classify the user's message, process their response, and generate the next conversational message — all in one step.

Current question index: {{#conversation.current_question_index#}}
Current question: {{#conversation.current_question_text#}}

User's message: <user_message>{{#conversation.user_last_response#}}</user_message>

Already collected on this topic:
<current_topic>{{#1772125942607.current_topic_context#}}</current_topic>

IMPORTANT: When the user shares a document (pitch deck, financials, etc.), the text content is automatically extracted and included in the context above. You already have the document content — do NOT ask the user to paste or re-share it.

## Step 1: Classify Intent

Determine the user's intent:
- **"answer"** — the user is answering the current question (most common)
- **"skip"** — the user wants to skip this question or doesn't have information ("I don't know", "skip", "next")
- **"finish"** — the user wants to end onboarding and generate their summary ("that's all", "finish", "summary", "done")
- **"clarification"** — the user is asking what you mean or needs help understanding the question
- **"off_topic"** — the user is asking something unrelated to their startup onboarding

## Step 2: Process (only for "answer" intent)

If the intent is "answer", assess the response:

**Is critical foundational information missing?** (needs_followup = true)
- They described the problem but never mentioned the target user
- They discussed revenue but never mentioned how they charge
- They talked about the team but didn't identify any founders
- Only set needs_followup = true for genuinely missing core information. The deep-dive phase handles depth — don't ask for exhaustive detail here.

**If no follow-up needed, assess maturity depth** (adaptive escalation):
- **Concept-level** (vague idea, no execution evidence): topicComplete = true. Move on.
- **Early-level** (working product, paying customers, defined processes): topicComplete = false. Ask ONE dig-deeper question (see list below).
- **Validated or higher** (repeatable success, metrics, systems): topicComplete = true. Move on.

## Step 3: Generate Response

Write a conversational reply (2-3 sentences max) based on the classification:

- **"answer" + needs_followup**: Acknowledge what they shared, then ask for the specific missing information.
- **"answer" + topicComplete=false**: Acknowledge what they shared, then ask the dig-deeper question for the current topic.
- **"answer" + topicComplete=true**: Acknowledge what they shared, then transition naturally to the next question from the bank.
- **"skip"**: Briefly acknowledge, then move to the next question from the bank. Set topicComplete = true.
- **"finish"**: Respond with exactly: "Great, let me compile everything you've shared into your onboarding summary." Set topicComplete = true.
- **"clarification"**: Rephrase the current question in simpler terms. Set topicComplete = false.
- **"off_topic"**: Gently redirect back to the current question. Set topicComplete = false.

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

## Dig-Deeper Questions (one per topic, for Early-level responses)

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

## Rules
- Reference what they've already shared to make the response feel personalized
- Keep it conversational, 2-3 sentences max
- Maximum 1 dig-deeper per topic
- When transitioning to the next question, use the exact question text from the bank above

Output strict JSON:
{
  "intent": "<answer|skip|finish|clarification|off_topic>",
  "topicComplete": <true/false>,
  "response": "<the conversational message to show the user>"
}
```

### Output Variables
- `intent` (String) — classified intent, used for IF/ELSE routing ("finish" → summary path)
- `topicComplete` (Boolean) — whether current topic is done (used to increment question index)
- `response` (String) — the message shown to the user via ANSWER node

### Downstream Routing

```
ONBOARDING PROCESSOR output
  → IF/ELSE: intent == "finish"
    → YES: CODE CONSOLIDATED_CON → GENERATING ONBOARDING → ANSWER (summary)
    → NO: IF/ELSE: topicComplete == true
      → YES: increment current_question_index
        → IF/ELSE 2: current_question_index > 9?
          → YES: summary generation path
          → NO: ANSWER (show response)
      → NO: ANSWER (show response)
```

The ANSWER nodes should output `{{#ONBOARDING_PROCESSOR.response#}}` (bind to the `response` variable from this node).

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
