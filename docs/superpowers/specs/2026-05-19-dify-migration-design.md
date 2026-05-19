# Dify Migration Design Spec

**Date:** 2026-05-19
**Status:** Draft
**Goal:** Remove Dify as a dependency by replacing all 4 Dify workflows with direct LLM calls via Vercel AI SDK, eliminating hosting costs while preserving feature parity.

---

## Table of Contents

1. [Context & Motivation](#1-context--motivation)
2. [Constraints](#2-constraints)
3. [Provider Abstraction Layer](#3-provider-abstraction-layer)
4. [Onboarding Chat Replacement](#4-onboarding-chat-replacement)
5. [Deep-Dive Chat Replacement](#5-deep-dive-chat-replacement)
6. [Evaluation Pipeline Replacement](#6-evaluation-pipeline-replacement)
7. [Investment Matching Replacement](#7-investment-matching-replacement)
8. [File Handling](#8-file-handling)
9. [Migration Strategy](#9-migration-strategy)
10. [Testing Strategy](#10-testing-strategy)
11. [Files Added / Modified / Deleted](#11-files-added--modified--deleted)
12. [Environment Variable Changes](#12-environment-variable-changes)

---

## 1. Context & Motivation

Fundy MVP currently uses Dify to host 4 AI workflows:

| Workflow | Dify Type | Purpose |
|----------|-----------|---------|
| Onboarding | Chatflow (multi-turn) | Conversational company profile collection across 10 categories |
| Deep-Dive | Chatflow (multi-turn) | Per-category follow-up conversations |
| Evaluation | Workflow (single-shot) | 10-dimension maturity + performance scoring |
| Investment | Workflow (single-shot) | Investment type matching + recommendations |

Dify hosting is a significant ongoing cost. The workflows are well-documented in the codebase (`dify-evaluation-workflow.md`, `dify-onboarding-prompt.md`, `DifyTactics.md`, `datastructure.md`) and our serverless functions already do the heavy lifting (JWT auth, KB retrieval, context assembly, SSE streaming, persistence). Dify's actual contribution is orchestrating LLM calls — which Vercel AI SDK handles natively.

---

## 2. Constraints

- **Vercel Hobby plan**: 60-second function timeout, 12 serverless function limit.
- **Provider-agnostic**: Must support swapping LLM providers (OpenAI, Anthropic, etc.) via config, not code changes.
- **Frontend unchanged**: SSE event contract stays identical — no frontend changes during migration.
- **Feature parity**: All existing capabilities must work post-migration: streaming, file uploads, summary extraction, evaluation scoring, investment recommendations, action item generation, knowledge base retrieval.

---

## 3. Provider Abstraction Layer

**Replaces:** Dify model configuration + `api/_shared.js` API key routing.

### New module: `api/_llm.js`

Uses Vercel AI SDK's `createProviderRegistry` to create a centralized, provider-agnostic model registry.

```js
import { createProviderRegistry } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

const registry = createProviderRegistry({
  openai: createOpenAI(),       // reads OPENAI_API_KEY from env
  anthropic: createAnthropic(), // reads ANTHROPIC_API_KEY from env
});

export function getModel(envVar) {
  const spec = process.env[envVar]; // e.g. 'openai:gpt-4o-mini'
  if (!spec) throw new Error(`${envVar} not configured`);
  return registry.languageModel(spec);
}
```

### Model configuration via env vars

Each workflow gets its own `provider:model` env var, allowing independent provider/model selection per workflow:

| Env Var | Example Value | Used By |
|---------|--------------|---------|
| `LLM_CHAT_MODEL` | `openai:gpt-4o-mini` | Onboarding + deep-dive chat |
| `LLM_EVAL_MODEL` | `openai:gpt-4o` | 10-category evaluation |
| `LLM_INVESTMENT_MODEL` | `openai:gpt-4o` | Investment recommendations |
| `LLM_ANALYSIS_MODEL` | `openai:gpt-4o-mini` | Action item refresh |

Provider API keys use the SDK's standard env var conventions (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`). Only the provider packages in use need to be installed.

### What gets deleted

- `api/_shared.js` (entire file — `resolveApiKey()` and `getDifyBaseUrl()`)
- All `DIFY_*` env vars (see Section 12 for full list)

### Action item refresh migration

`api/action-items/_analyze.js` currently uses raw `fetch()` to the OpenAI chat completions API. This migrates to use `getModel('LLM_ANALYSIS_MODEL')` + AI SDK's `generateObject()` for provider-agnostic structured output. Same system prompt, same response schema.

### New dependencies

- `ai` (Vercel AI SDK core)
- `@ai-sdk/openai` (OpenAI provider)
- `@ai-sdk/anthropic` (Anthropic provider — install when needed)

---

## 4. Onboarding Chat Replacement

**Replaces:** Dify onboarding chatflow (6+ nodes, 2-3 LLM calls per user message).

### Current Dify architecture (per message turn)

1. "LLM IS REVIEWING YOUR RESPONSE" — extracts structured info into 10 category variables
2. "APPEND KEY INFO BY CATE" — appends to running per-category accumulators
3. "CODE CURRENT_TOPIC_CON" — selects current topic's accumulated data
4. "CODE CONSOLIDATED_CON" — joins all 10 category accumulators into XML-tagged context
5. "RESPONSE PROCESSING LLM" — decides if follow-up is needed
6. "NEXT QUESTION LLM" — generates the next conversational message
7. "GENERATING ONBOARDING" (final turn only) — produces `[ONBOARDING_SUMMARY]` JSON

### New architecture: single LLM call per turn

Replace the entire multi-node pipeline with one `streamText()` call per user message. The system prompt contains:

- The 10-question bank (one per evaluation category)
- Adaptive escalation rules (Concept -> move on, Early -> dig deeper to Validated, Validated -> move on)
- Evidence-aware follow-up logic
- Summary generation instructions (triggered when question count >= 10 or user says "finish")

Full conversation history is passed as the `messages` array. The LLM tracks what's been covered naturally from the conversation context.

**Rationale for single-LLM approach:**
- The onboarding conversation is 10-15 turns (~3-4K tokens of history) — well within any model's context window.
- Eliminates the per-category accumulator state management entirely.
- Halves LLM cost per turn (1 call instead of 2-3).
- Modern models handle 10-turn conversation steering trivially.
- The accumulation pattern existed because Dify's node-based architecture required it — without Dify, it's unnecessary complexity.

### New file: `api/_prompts/onboarding.js`

- Exports `ONBOARDING_SYSTEM_PROMPT` — extracted and consolidated from all 6 Dify node prompts in `dify-onboarding-prompt.md`
- Exports `buildOnboardingMessages(conversationHistory, questionCount)` — assembles the messages array from conversation history

### Modified file: `api/chat.js`

Currently proxies to Dify `/chat-messages`. Changes to:

- For `workflow='onboarding'`: call `streamText()` with `getModel('LLM_CHAT_MODEL')` + system prompt + message history
- Stream response back to client as SSE in the same `data: {...}` format the frontend expects
- Summary detection stays client-side in `extractSummary.js` (no change)

### SSE event format (unchanged)

```
data: {"event":"message","answer":"token text","conversation_id":"..."}
data: {"event":"message_end","message_id":"..."}
```

The server produces these events from the AI SDK's `streamText()` token stream instead of forwarding Dify's SSE.

### What stays the same

- `extractSummary.js` parsing — `[ONBOARDING_SUMMARY]` markers are in the system prompt
- Message persistence to Supabase (fire-and-forget)
- Summary embedding pipeline (`POST /api/summary`)
- Client-side `difyApi.js` SSE handling

### What gets removed

- `DIFY_ONBOARDING_API_KEY`
- Dify conversation ID tracking (`dify_conversation_id` column becomes unused)
- Dify proxy logic in `api/chat.js`

---

## 5. Deep-Dive Chat Replacement

**Replaces:** Dify deep-dive chatflow (separate app with its own API key).

### Architecture

Same pattern as onboarding — single `streamText()` call per message — but with a category-specific system prompt.

### New file: `api/_prompts/deepdive.js`

- Exports `buildDeepDiveSystemPrompt(categoryId, onboardingSummary)` — generates a system prompt scoped to one category
- Includes: the category's summary, highlights, gaps, and `deepDivePrompt` from onboarding
- Instructs the LLM to probe deeper on the specific category, ask for evidence, help fill gaps

### Modified file: `api/chat.js`

- For `workflow='deepdive'`: loads onboarding summary from Supabase, builds category-scoped system prompt, calls `streamText()`
- File handling: extracts text server-side, includes in message (same as onboarding — see Section 8)
- File embedding: same post-response chunk + embed pipeline, triggered from our code instead of Dify's "File Text Relay" node

### What stays the same

- Client-side `difyApi.js` SSE handling
- Per-category conversation state in `categoryConversations`
- `deepDivePrompt` as first assistant message (client-side)
- Message persistence per category

### What gets removed

- `DIFY_DEEPDIVE_API_KEY`
- Deep-dive Dify conversation ID tracking

### Simplification

Currently deep-dive always streams (hardcoded, not gated on `VITE_DIFY_STREAMING`). With AI SDK, `streamText()` is the default for both workflows — the blocking vs streaming branching in `api/chat.js` is eliminated entirely.

---

## 6. Evaluation Pipeline Replacement

**Replaces:** Dify Workflow app (Phase 1: 10 parallel LLM evaluations + maturity/matrix Code nodes).

### Current Dify architecture

```
START -> define_categories (Code) -> context_retrieval (Iteration, 10 parallel)
  -> [build_query -> HTTP callback to our API -> format_context] per category
-> route_to_llms (Code) -> 10 parallel eval_* LLM nodes
-> Variable Aggregator -> calculate_maturity (Code) -> generate_matrix (Code)
-> investment_recommendations (LLM) -> END
```

### Key insight

Most of this pipeline already lives in our code:
- Context retrieval: `api/evaluation/_categoryContext.js` (unchanged)
- Category definitions + scorecards: documented in `dify-evaluation-workflow.md` (extract to code)
- Maturity calculation + investment matrix: deterministic Python Code nodes (port to JS)

Dify's only real contribution is orchestrating the 10 parallel LLM calls and the investment LLM call.

### Modified file: `api/evaluation/generate.js`

Steps 1-2 stay the same (JWT auth, build category contexts). Steps 3-4 change:

1. Build 10 category contexts via `_categoryContext.js` (unchanged)
2. Fire 10 parallel `streamText()` calls (one per category)
   - System prompt: per-category scorecard (20-item evidence checklist + maturity gates + scoring methodology)
   - User message: assembled category context
   - On completion: parse structured JSON, emit SSE `category_complete` event
3. After all 10 complete: run `calculateMaturity()` (JS, deterministic)
4. Emit `maturity_calculated` SSE event
5. Fire 1 investment LLM call with evaluation results (see Section 7)
6. Emit `investment_recommendations_complete` SSE event
7. Emit `workflow_complete`

### New file: `api/_prompts/evaluation.js`

- Exports `EVALUATION_SCORECARDS` — the 10 per-category scorecards, currently stored as Dify environment variables (`eval_product_technology`, `eval_market_traction`, etc.)
- Each contains: 20-item evidence checklist, maturity gate assignments, scoring methodology (PROVEN/PARTIAL/UNPROVEN), maturity inference rules (Step 1b), stage-aware gap scoping (max 5 per category)
- Exports `buildEvalPrompt(categoryId, context)` — assembles system prompt + user message per category

### New file: `api/evaluation/_maturity.js`

JS ports of the Dify Python Code nodes:

- `calculateMaturity(categoryResults)` — weighted average of 10 category scores, stage derivation (1-5), overall performance level
- `generateInvestmentMatrix(categoryResults, maturity)` — scores each of 6 investment types against the evaluation dimensions

Pure functions with no LLM calls — deterministic, fully unit-testable.

### Structured output via Zod

AI SDK's `generateObject()` enforces output schemas at parse time. Each eval category gets a Zod schema:

```js
const EvalCategorySchema = z.object({
  category_id: z.string(),
  category_title: z.string(),
  summary: z.string(),
  completeness: z.number().min(0).max(100),
  status: z.enum(['complete', 'needs_attention', 'incomplete']),
  highlights: z.array(z.string()),
  gaps: z.array(z.object({
    action: z.string(),
    type: z.enum(['table_stakes', 'stretch']),
    evidence_items: z.array(z.number()),
  })),
  keyMetrics: z.object({
    perItemAssessment: z.record(z.enum(['PROVEN', 'PARTIAL', 'UNPROVEN'])),
    provenCount: z.number(),
    partialCount: z.number(),
    unprovenCount: z.number(),
  }).passthrough(),
  deepDivePrompt: z.string(),
});
```

This replaces the current pattern of "hope the LLM returns valid JSON, strip markdown fences, parse, validate."

### SSE event contract (unchanged)

```
data: {"type":"category_complete","category_id":"...","data":{...}}
data: {"type":"maturity_calculated","data":{...}}
data: {"type":"investment_recommendations_complete","data":{...}}
data: {"type":"status","message":"..."}
data: {"type":"workflow_complete"}
data: {"type":"error","message":"..."}
```

Frontend `evaluationApi.js` parses the same events — no changes needed.

### Vercel 60s timeout

- 10 parallel LLM calls: ~10-15s (each is a single structured output call)
- Investment LLM call: ~5-10s
- Total: ~15-25s, well within 60s
- Dify keepalive nodes (`workflow_kickstart`, `workflow_evaluating`) are no longer needed
- If needed, emit SSE keepalive comments from our code on a timer

### What gets deleted

- `api/evaluation/_difyWorkflow.js` (entire file — Dify SSE event transformation, node title parsing, markdown fence stripping)
- `api/knowledge/context.js` (Dify callback endpoint — context is now assembled directly, no HTTP callback needed)
- `DIFY_EVALUATION_API_KEY`

---

## 7. Investment Matching Replacement

**Replaces:** Phase 2 of the Dify Workflow (4 nodes after the 10 eval LLM nodes).

### Current Dify architecture (Phase 2)

```
Variable Aggregator (10 eval outputs)
-> calculate_maturity (Code)
-> generate_matrix (Code)
-> investment_recommendations (LLM)
```

### New architecture

After the 10 eval calls complete in `generate.js`:

1. `calculateMaturity()` runs (JS port — see Section 6)
2. `generateInvestmentMatrix()` runs (JS port)
3. One `generateObject()` call with `getModel('LLM_INVESTMENT_MODEL')` + Zod schema

### New file: `api/_prompts/investment.js`

- Exports `buildInvestmentPrompt(evaluationResults, maturityData, matrix)` — system prompt + context for the investment LLM
- Exports `InvestmentOutputSchema` — Zod schema matching the current output contract:

```js
const InvestmentOutputSchema = z.object({
  investment_readiness_summary: z.object({
    assessment: z.string(),
    primary_recommendation: z.string(),
    readiness_score: z.enum(['Low', 'Moderate', 'High']),
  }),
  recommended_funding: z.array(z.object({
    investment_type: z.string(),
    rating: z.enum(['ideal', 'strong_fit', 'acceptable']),
    fit_explanation: z.string(),
  })),
  conditional_options: z.array(z.object({
    investment_type: z.string(),
    conditions_for_fit: z.string(),
    improvements_needed: z.array(z.object({
      category: z.string(),
      current_state: z.string(),
      target_state: z.string(),
      actions: z.array(z.string()),
    })),
  })),
  improvement_roadmap: z.array(z.object({
    priority: z.number(),
    category: z.string(),
    current_score: z.number(),
    target_score: z.number(),
    unlocks: z.array(z.string()),
    specific_actions: z.array(z.string()),
    timeline: z.string(),
  })),
  not_recommended: z.array(z.object({
    investment_type: z.string(),
    reason: z.string(),
  })),
  next_steps: z.array(z.object({
    priority: z.number(),
    action: z.string(),
    timeline: z.string(),
    expected_outcome: z.string(),
  })),
});
```

### What stays the same

- Frontend investment rendering logic
- Rating -> suitability mapping (`ideal`->95, `strong_fit`->80, etc.)
- Action item generation from `next_steps[]`
- Persistence via `POST /api/evaluation/save`

### What gets removed

- `DIFY_INVESTMENT_API_KEY`

---

## 8. File Handling

**Replaces:** Dify's File Extractor node + `api/upload.js` (Dify file upload proxy).

### Current flow

1. Client uploads file via `POST /api/upload` -> proxy to Dify `/files/upload`
2. Dify stores the file and returns a `file_id`
3. Chat message includes `file_id` reference
4. Dify's File Extractor node extracts text internally
5. "File Text Relay" Code node emits extracted text in SSE
6. Server captures text + embeds into pgvector

### New flow

1. Client uploads file via `POST /api/upload` -> server extracts text directly
2. Extracted text returned to client as upload response
3. Chat message includes extracted text as context (prepended to user message)
4. Server also chunks + embeds text into pgvector (same pipeline)

### Text extraction library

`officeparser` — supports PDF, DOCX, PPTX, XLSX (~400KB). Covers pitch decks (PDF, PPTX) which are the primary upload type.

### Modified file: `api/upload.js`

- Remove Dify proxy logic
- Accept multipart file upload
- Extract text via `officeparser`
- Return `{ extracted_text, file_name, file_size }` to client
- Optionally store file in Supabase Storage (existing `file_metadata` table)

### Embedding pipeline

After text extraction in `api/chat.js` (post-response):
- Chunk with `chunkFileText()` from `api/_chunking.js` (unchanged)
- Embed with OpenAI `text-embedding-3-small` (unchanged)
- Upsert to `document_embeddings` with `source_type='file'` (unchanged)

---

## 9. Migration Strategy

### Phased rollout with feature flags

Each workflow migrates independently. Feature flag pattern in `api/chat.js`:

```js
const useLLMDirect = !!process.env.LLM_CHAT_MODEL;
if (useLLMDirect) {
  // New path: AI SDK streamText()
} else {
  // Old path: proxy to Dify
}
```

Set `LLM_CHAT_MODEL` in Vercel env vars to activate. Unset to revert — no code deploy needed.

### Phase order

| Phase | What | Risk | Validation |
|-------|------|------|------------|
| 0a | Generate 50 synthetic golden fixtures | Low | Diversity matrix coverage, fixture format valid |
| 0b | Capture Dify baselines (feed fixtures through current Dify pipeline) | Low | All 50 fixtures have `difyBaseline` populated |
| 1 | Onboarding chat | Low | Conversation quality, summary extraction, persistence |
| 2 | Deep-dive chat | Low | Per-category conversations, file upload + extraction + embedding |
| 3 | Evaluation pipeline | Medium | 10-category parallel execution within 60s, SSE events, progressive rendering |
| 4 | Investment matching | Medium | Recommendations quality, action item generation, persistence |
| 5 | Cleanup | Low | Remove all Dify code, env vars, docs |

**Phase 0 must complete before any migration code is written.** Once Dify is replaced, there is no way to regenerate the baselines.

### SSE contract preservation

The frontend (`evaluationApi.js`, `difyApi.js`) parses specific SSE event shapes. The server emits identical shapes from the new AI SDK code — zero frontend changes required during migration.

### Vercel function count impact

| Change | Functions |
|--------|-----------|
| Remove `api/knowledge/context.js` (Dify callback) | -1 |
| Remove `api/upload.js` and fold file handling into `api/chat.js` | -1 |
| Net change | -2 (10 total, 2 under limit) |

Note: `api/upload.js` can alternatively stay as a standalone endpoint with the Dify proxy replaced by direct text extraction. In that case net change is -1. Decision deferred to implementation.

---

## 10. Testing Strategy

### 10.1 Golden Dataset: 50 Fixtures

**Composition:**

| Source | Count | Purpose |
|--------|-------|---------|
| Supabase production exports | 2-3 (available real users) | Anchor fixtures — ground truth from real Dify pipeline |
| Lumio AI demo data | 1 (already exists in `seed-demo-data.js`) | Ready-made fixture |
| Synthetic company profiles | 46-47 | Breadth + edge case coverage |

**Total: 50 fixtures**, each containing the full chain: onboarding conversation -> summary -> evaluation contexts -> evaluation output -> investment recommendations.

### 10.2 Synthetic Generation

**New script: `scripts/generate-golden-fixtures.js`**

Takes a JSON spec of company archetypes and uses an LLM to generate realistic onboarding conversations + expected outputs.

**Diversity matrix (50 fixtures covering these axes):**

| Axis | Variations |
|------|-----------|
| Stage | Concept (10), Early (15), Validated (15), Scaling (10) |
| Industry | SaaS, fintech, healthtech, hardware, marketplace, edtech, climate, AI/ML, consumer, biotech |
| Team size | Solo (5), 2-5 (15), 6-20 (20), 20+ (10) |
| Answer quality | Sparse/vague (10), Mixed (25), Detailed/data-rich (15) |
| Revenue | Pre-revenue (15), <$10K MRR (10), $10-100K MRR (15), $100K+ MRR (10) |

**Fixture format:**

```
src/test/fixtures/golden/
  real-001.json         # Production export
  real-002.json
  demo-lumio-ai.json    # From seed-demo-data.js
  synthetic-001.json    # Generated
  ...
  synthetic-047.json
```

Each fixture file:

```json
{
  "id": "synthetic-001",
  "archetype": { "stage": "early", "industry": "fintech", "teamSize": 5, "answerStyle": "mixed" },
  "onboarding": {
    "messages": [{ "role": "user", "content": "..." }, ...],
    "summary": { "version": "1.0", "categories": [...] }
  },
  "evaluation": {
    "categoryContexts": { "product_technology": "...", ... },
    "categoryOutputs": { "product_technology": {...}, ... },
    "maturity": { "level": 2, "name": "Early" },
    "performance": { "score": 2.1, "label": "Fair" }
  },
  "investment": {
    "recommendations": {...}
  },
  "difyBaseline": {
    "evaluation": { "categoryOutputs": {...}, "maturity": {...} },
    "investment": { "recommendations": {...} }
  }
}
```

### 10.3 Baseline Capture Flow

1. Generate 50 synthetic company profiles + onboarding conversations
2. Feed each through the current Dify pipeline (automated via existing `api/chat.js` proxy)
3. Capture Dify outputs as `difyBaseline` in each fixture
4. After migration, feed same inputs through new AI SDK pipeline
5. Compare new outputs against `difyBaseline`

**New script: `scripts/capture-dify-baselines.js`** — automates step 2-3.

### 10.4 Test Layers

**Layer 1: Deterministic Unit Tests**

No LLM involved — pure functions that must produce identical output:

- `_maturity.js` — `calculateMaturity()`, `generateInvestmentMatrix()` tested against golden dataset inputs, assert exact numeric matches against Dify Code node outputs
- `_prompts/*.js` — snapshot tests to catch accidental prompt changes
- SSE event emission — assert `generate.js` emits events matching the exact schema `evaluationApi.js` expects
- `extractSummary.js` — add golden session summaries as additional test cases

**Layer 2: Structural Validation (automated, CI)**

Run all 50 fixtures through the new pipeline. Assert:

- Evaluation output matches Zod schema (correct fields, types, ranges)
- Maturity level is 1-5, performance score is 1-5
- All 10 category IDs present
- Gaps have `action`, `type`, `evidence_items` fields
- Investment output has all required sections
- Completeness scores are 0-100
- Per-item assessments are PROVEN/PARTIAL/UNPROVEN only
- **100% pass rate required (non-negotiable)**

**Layer 3: Score Comparison (automated with human review)**

For each fixture, compare new pipeline output against `difyBaseline`:

```
Category: product_technology
  Dify maturity: 3    | New maturity: 3    | MATCH
  Dify performance: 2 | New performance: 3 | WITHIN 1
  Dify completeness: 55 | New completeness: 60 | WITHIN 15
  Dify gaps: 4        | New gaps: 3        | REVIEW
```

**Thresholds (across all 50 runs):**
- Maturity/performance: within +/-1 of Dify output on 80%+ of categories
- Completeness: within +/-15 points on 80%+ of categories
- Any single run with 3+ categories diverging by >1 maturity level flagged for manual review

**New script: `scripts/compare-evaluation.js`** — runs comparison, outputs aggregate summary + per-run details.

**Layer 4: Conversation Quality (onboarding)**

Automated checks on the 50 onboarding conversations:
- All 10 categories addressed (summary completeness > 0 for each)
- Conversation length is 10-15 turns
- Summary JSON passes `extractSummary.js` validation
- No repeated questions (string similarity check between consecutive assistant messages)

Manual review protocol for 5 selected conversations:
- Diverse profiles: early-stage sparse, growth detailed, pre-revenue vague, hardware mixed, solo founder
- Checklist: adaptive follow-ups, topic coverage, summary accuracy

**Layer 5: Integration Tests with Mock LLM**

Uses AI SDK's `MockLanguageModelV1` to return deterministic responses from golden fixtures.

**New file: `src/test/helpers/mockLlm.js`**

Tests full orchestration without real LLM costs:
- 10 parallel eval calls complete -> correct SSE event sequence
- One eval call fails -> error event emitted, other 9 still complete
- Investment LLM returns malformed JSON -> graceful error, evaluation results still delivered
- All calls complete within simulated time budget
- File upload -> text extracted -> included in LLM message -> embedded in pgvector

**Layer 6: Regression Suite (ongoing, post-migration)**

- CI job runs evaluation pipeline against 50 golden inputs with `temperature: 0`
- Alerts if structural validation fails
- Alerts if score drift exceeds thresholds
- New golden fixtures added over time

### 10.5 Test File Additions

```
src/test/
  fixtures/golden/                    # 50 fixture files
  helpers/mockLlm.js                  # AI SDK mock wrapper
api/
  evaluation/_maturity.test.js        # Pure math port tests
  _prompts/onboarding.test.js         # Prompt snapshot tests
  _prompts/deepdive.test.js           # Prompt snapshot tests
  _prompts/evaluation.test.js         # Prompt snapshot tests
  _prompts/investment.test.js         # Prompt snapshot tests
scripts/
  generate-golden-fixtures.js         # Synthetic company profile generator
  capture-dify-baselines.js           # Runs fixtures through Dify, captures output
  compare-evaluation.js               # A/B comparison report generator
```

---

## 11. Files Added / Modified / Deleted

### New files

| File | Purpose |
|------|---------|
| `api/_llm.js` | Provider registry + `getModel()` helper |
| `api/_prompts/onboarding.js` | Onboarding system prompt + message builder |
| `api/_prompts/deepdive.js` | Deep-dive system prompt builder (category-scoped) |
| `api/_prompts/evaluation.js` | 10 per-category scorecards + eval prompt builder |
| `api/_prompts/investment.js` | Investment prompt builder + Zod output schema |
| `api/evaluation/_maturity.js` | JS ports of maturity calculation + investment matrix |
| `api/evaluation/_maturity.test.js` | Unit tests for maturity/matrix functions |
| `api/_prompts/onboarding.test.js` | Prompt snapshot tests |
| `api/_prompts/deepdive.test.js` | Prompt snapshot tests |
| `api/_prompts/evaluation.test.js` | Prompt snapshot tests |
| `api/_prompts/investment.test.js` | Prompt snapshot tests |
| `src/test/fixtures/golden/*.json` | 50 golden dataset fixtures |
| `src/test/helpers/mockLlm.js` | AI SDK mock wrapper for integration tests |
| `scripts/generate-golden-fixtures.js` | Synthetic fixture generator |
| `scripts/capture-dify-baselines.js` | Dify baseline capture automation |
| `scripts/compare-evaluation.js` | A/B comparison report |

### Modified files

| File | Change |
|------|--------|
| `api/chat.js` | Replace Dify proxy with direct `streamText()` calls for onboarding + deep-dive |
| `api/upload.js` | Replace Dify file upload proxy with direct text extraction via `officeparser` |
| `api/evaluation/generate.js` | Replace Dify `/workflows/run` with 10 parallel `streamText()` + maturity calc + investment LLM |
| `api/action-items/_analyze.js` | Replace raw `fetch()` to OpenAI with `getModel('LLM_ANALYSIS_MODEL')` + `generateObject()` |
| `api/evaluation/save.js` | No change (already receives processed data) |
| `.env.example` | Remove `DIFY_*` vars, add `LLM_*` vars |

### Deleted files

| File | Reason |
|------|--------|
| `api/_shared.js` | Dify API key routing — no longer needed |
| `api/evaluation/_difyWorkflow.js` | Dify SSE event transformation — replaced by direct event emission |
| `api/evaluation/_difyWorkflow.test.js` | Tests for deleted file |
| `api/knowledge/context.js` | Dify callback endpoint — context assembled directly now |

### Documentation updates (Phase 5 cleanup)

| File | Change |
|------|--------|
| `CLAUDE.md` | Update architecture, env vars, file list, remove Dify references |
| `projectmemory.md` | Add v5.0 section documenting the migration |
| `DifyTactics.md` | Archive or delete |
| `dify-evaluation-workflow.md` | Archive (keep as historical reference for prompt extraction) |
| `dify-onboarding-prompt.md` | Archive (prompts extracted to `api/_prompts/`) |
| `dify-api-spec.md` | Delete |
| `.env.example` | Updated (see Section 12) |

---

## 12. Environment Variable Changes

### Removed

| Variable | Was Used By |
|----------|-------------|
| `DIFY_BASE_URL` | Dify API base URL |
| `DIFY_ONBOARDING_API_KEY` | Onboarding chatflow |
| `DIFY_DEEPDIVE_API_KEY` | Deep-dive chatflow |
| `DIFY_EVALUATION_API_KEY` | Evaluation workflow |
| `DIFY_INVESTMENT_API_KEY` | Investment matching |
| `DIFY_WEBHOOK_SECRET` | Dify -> Vercel callback auth |
| `VITE_DIFY_MOCK` | Client-side mock toggle |
| `VITE_DIFY_STREAMING` | Client-side streaming toggle |

### Added

| Variable | Example Value | Purpose |
|----------|--------------|---------|
| `LLM_CHAT_MODEL` | `openai:gpt-4o-mini` | Onboarding + deep-dive LLM |
| `LLM_EVAL_MODEL` | `openai:gpt-4o` | 10-category evaluation LLM |
| `LLM_INVESTMENT_MODEL` | `openai:gpt-4o` | Investment recommendations LLM |
| `LLM_ANALYSIS_MODEL` | `openai:gpt-4o-mini` | Action item refresh LLM |
| `VITE_LLM_MOCK` | `true` | Client-side mock toggle (renamed) |

### Unchanged

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Embeddings + OpenAI LLM provider |
| `ANTHROPIC_API_KEY` | Anthropic LLM provider (add when needed) |
| `VITE_SUPABASE_URL` | Supabase client URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_URL` | Server-side Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase admin key |
| `ACTIVE_KNOWLEDGE_BASE` | KB selection |
