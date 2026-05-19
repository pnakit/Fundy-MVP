# Dify Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all 4 Dify workflows with direct LLM calls via Vercel AI SDK, preserving identical frontend behavior.

**Architecture:** Provider-agnostic LLM abstraction via AI SDK's `createProviderRegistry`. Chatflows become single `streamText()` calls per turn. Evaluation becomes 10 parallel `generateObject()` calls with Zod schemas. SSE event contract preserved — zero frontend changes.

**Tech Stack:** Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`), Zod, `officeparser`, Vitest

**Design Spec:** `docs/superpowers/specs/2026-05-19-dify-migration-design.md`

---

## Phase 0a: Golden Fixture Generation

### Task 1: Create Archetype Definitions

**Files:**
- Create: `scripts/archetypes.json`

- [ ] **Step 1: Write the archetype definitions file**

This JSON file defines 50 company profiles covering the diversity matrix from the spec. Each archetype specifies the company's characteristics that the LLM will use to generate a realistic onboarding conversation.

```json
[
  { "id": "synthetic-001", "name": "NovaPay", "stage": "concept", "industry": "fintech", "teamSize": 1, "answerStyle": "sparse", "revenue": "pre-revenue", "description": "Solo founder building a mobile payments app for unbanked populations in Southeast Asia. No product yet, just a pitch deck." },
  { "id": "synthetic-002", "name": "MedScan AI", "stage": "early", "industry": "healthtech", "teamSize": 4, "answerStyle": "detailed", "revenue": "pre-revenue", "description": "Medical imaging startup using computer vision to detect early-stage cancers. Has an FDA pre-submission meeting scheduled. Team of 4 (2 ML engineers, 1 radiologist, 1 CEO)." },
  { "id": "synthetic-003", "name": "GreenGrid", "stage": "validated", "industry": "climate", "teamSize": 12, "answerStyle": "mixed", "revenue": "$10-100K MRR", "description": "Energy management SaaS for commercial buildings. $45K MRR, 8 enterprise customers. IoT sensors + ML optimization. Series A target." },
  { "id": "synthetic-004", "name": "BuildBot", "stage": "early", "industry": "hardware", "teamSize": 6, "answerStyle": "sparse", "revenue": "<$10K MRR", "description": "Autonomous bricklaying robot for residential construction. Working prototype, 2 pilot projects. Hardware + software team of 6." },
  { "id": "synthetic-005", "name": "LearnLoop", "stage": "scaling", "industry": "edtech", "teamSize": 35, "answerStyle": "detailed", "revenue": "$100K+ MRR", "description": "Adaptive learning platform for K-12 math. $180K MRR, 200+ school districts. Proven learning outcomes data. Expanding internationally." }
]
```

Write all 50 entries following the diversity matrix:
- **Stage:** Concept (10), Early (15), Validated (15), Scaling (10)
- **Industry:** SaaS, fintech, healthtech, hardware, marketplace, edtech, climate, AI/ML, consumer, biotech (5 each)
- **Team size:** Solo (5), 2-5 (15), 6-20 (20), 20+ (10)
- **Answer quality:** Sparse/vague (10), Mixed (25), Detailed/data-rich (15)
- **Revenue:** Pre-revenue (15), <$10K MRR (10), $10-100K MRR (15), $100K+ MRR (10)

Each entry must have a 1-2 sentence `description` that gives enough context for an LLM to generate a realistic onboarding conversation (product, team, metrics, stage-appropriate details).

- [ ] **Step 2: Commit**

```bash
git add scripts/archetypes.json
git commit -m "feat: add 50 company archetype definitions for golden fixture generation"
```

---

### Task 2: Create Fixture Generator Script

**Files:**
- Create: `scripts/generate-golden-fixtures.js`
- Read: `scripts/archetypes.json`
- Read: `dify-onboarding-prompt.md` (for summary schema reference)
- Read: `src/utils/extractSummary.js` (for valid category IDs)

This script uses an LLM to generate realistic onboarding conversations and summaries for each archetype. It calls the OpenAI API directly (not Dify) to generate the fixture content.

- [ ] **Step 1: Write the fixture generator script**

```js
#!/usr/bin/env node
/**
 * Generate golden test fixtures from company archetypes.
 *
 * Usage:
 *   node scripts/generate-golden-fixtures.js [--start N] [--count N] [--dry-run]
 *
 * Requires: OPENAI_API_KEY in env or .env file
 *
 * Each fixture contains:
 *   - archetype metadata
 *   - onboarding.messages (10-12 turn conversation)
 *   - onboarding.summary (valid [ONBOARDING_SUMMARY] JSON)
 *   - evaluation.categoryContexts (empty — populated by capture-dify-baselines.js)
 *   - difyBaseline (null — populated by capture-dify-baselines.js)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FIXTURES_DIR = join(ROOT, 'src', 'test', 'fixtures', 'golden');
const ARCHETYPES_PATH = join(__dirname, 'archetypes.json');

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';

const VALID_CATEGORY_IDS = [
  'product_technology', 'market_traction', 'business_model', 'team_organization',
  'go_to_market', 'financial_health', 'fundraising_capital', 'competitive_position',
  'operations', 'legal_compliance',
];

const CATEGORY_TITLES = {
  product_technology: 'Product & Technology',
  market_traction: 'Market Traction & Revenue',
  business_model: 'Business Model & Economics',
  team_organization: 'Team & Organization',
  go_to_market: 'Go-to-Market',
  financial_health: 'Financial Health',
  fundraising_capital: 'Fundraising & Capital',
  competitive_position: 'Competitive Position',
  operations: 'Operations',
  legal_compliance: 'Legal & Compliance',
};

// Load env from .env if available
function loadEnv() {
  try {
    const envPath = join(ROOT, '.env');
    const envContent = readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = value;
      }
    }
  } catch (_e) { /* no .env file */ }
}

async function callOpenAI(systemPrompt, userPrompt, temperature = 0.7) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const response = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function stripCodeFences(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

async function generateConversation(archetype) {
  const systemPrompt = `You are simulating a startup onboarding conversation for testing purposes.

Generate a realistic conversation between an AI startup evaluator (assistant) and a founder (user).

Rules:
- The conversation must be 10-12 turns (alternating user/assistant, starting with user)
- The assistant asks probing questions about the company across 10 evaluation dimensions
- The user responds based on the company profile provided
- Answer style: "${archetype.answerStyle}" — sparse means short/vague answers, detailed means data-rich, mixed varies
- The assistant should adapt: ask follow-ups for vague answers, move on for detailed ones
- Cover all 10 categories: product/tech, market traction, business model, team, GTM, financial health, fundraising, competitive position, operations, legal/compliance
- Make the conversation feel natural, not like a checklist

Output ONLY a JSON array of message objects: [{"role":"user","content":"..."}, {"role":"assistant","content":"..."}, ...]`;

  const userPrompt = `Company: ${archetype.name}
Stage: ${archetype.stage}
Industry: ${archetype.industry}
Team size: ${archetype.teamSize}
Revenue: ${archetype.revenue}
Description: ${archetype.description}`;

  const raw = await callOpenAI(systemPrompt, userPrompt);
  return JSON.parse(stripCodeFences(raw));
}

async function generateSummary(archetype, messages) {
  const conversationText = messages
    .map(m => `${m.role === 'user' ? 'Founder' : 'Evaluator'}: ${m.content}`)
    .join('\n\n');

  const systemPrompt = `You are generating a structured onboarding summary from a startup evaluation conversation.

Output ONLY valid JSON matching this exact schema:
{
  "version": "1.0",
  "companyName": "string",
  "generatedAt": "ISO 8601 timestamp",
  "overallCompleteness": 0-100,
  "categories": [
    {
      "id": "one of: ${VALID_CATEGORY_IDS.join(', ')}",
      "title": "matching title from the list",
      "summary": "1-2 sentence summary of what was discussed",
      "completeness": 0-100,
      "status": "complete|needs_attention|incomplete",
      "highlights": ["1-3 key strengths mentioned"],
      "gaps": ["1-3 pieces of missing information"],
      "keyMetrics": { "metricName": "value" },
      "deepDivePrompt": "2-3 sentence personalized opener for a follow-up conversation on this category"
    }
  ]
}

Rules:
- ALL 10 category IDs must be present
- completeness >= 70 → status "complete", >= 40 → "needs_attention", < 40 → "incomplete"
- overallCompleteness = average of all category completeness values
- Base completeness on how much evidence the founder actually provided
- highlights and gaps must reflect the actual conversation content
- keyMetrics should contain specific numbers/facts mentioned by the founder

Category titles: ${JSON.stringify(CATEGORY_TITLES)}`;

  const userPrompt = `Company: ${archetype.name} (${archetype.stage} stage, ${archetype.industry})
Team: ${archetype.teamSize} people
Revenue: ${archetype.revenue}

Conversation transcript:
${conversationText}`;

  const raw = await callOpenAI(systemPrompt, userPrompt, 0.3);
  const summary = JSON.parse(stripCodeFences(raw));

  // Validate: must have all 10 categories
  const ids = new Set(summary.categories.map(c => c.id));
  const missing = VALID_CATEGORY_IDS.filter(id => !ids.has(id));
  if (missing.length > 0) {
    throw new Error(`Summary missing categories: ${missing.join(', ')}`);
  }

  return summary;
}

async function generateFixture(archetype) {
  console.log(`  Generating conversation for ${archetype.id} (${archetype.name})...`);
  const messages = await generateConversation(archetype);

  console.log(`  Generating summary for ${archetype.id}...`);
  const summary = await generateSummary(archetype, messages);

  return {
    id: archetype.id,
    archetype: {
      name: archetype.name,
      stage: archetype.stage,
      industry: archetype.industry,
      teamSize: archetype.teamSize,
      answerStyle: archetype.answerStyle,
      revenue: archetype.revenue,
    },
    onboarding: {
      messages,
      summary,
    },
    evaluation: {
      categoryContexts: {},
      categoryOutputs: {},
      maturity: null,
      performance: null,
    },
    investment: {
      recommendations: null,
    },
    difyBaseline: null,
  };
}

async function main() {
  loadEnv();

  const args = process.argv.slice(2);
  const startIdx = args.includes('--start') ? parseInt(args[args.indexOf('--start') + 1], 10) : 0;
  const count = args.includes('--count') ? parseInt(args[args.indexOf('--count') + 1], 10) : Infinity;
  const dryRun = args.includes('--dry-run');

  const archetypes = JSON.parse(readFileSync(ARCHETYPES_PATH, 'utf8'));
  const subset = archetypes.slice(startIdx, startIdx + count);

  console.log(`\nGenerating ${subset.length} golden fixtures (start=${startIdx})...\n`);

  if (!existsSync(FIXTURES_DIR)) {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  let generated = 0;
  let errors = 0;

  for (const archetype of subset) {
    try {
      if (dryRun) {
        console.log(`  [dry-run] Would generate: ${archetype.id} (${archetype.name})`);
        generated++;
        continue;
      }

      const fixture = await generateFixture(archetype);
      const outPath = join(FIXTURES_DIR, `${archetype.id}.json`);
      writeFileSync(outPath, JSON.stringify(fixture, null, 2));
      console.log(`  ✓ Saved ${outPath}`);
      generated++;

      // Rate limiting: 2s between calls to avoid OpenAI rate limits
      if (subset.indexOf(archetype) < subset.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error(`  ✗ Failed ${archetype.id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n--- Done: ${generated} generated, ${errors} errors ---\n`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Create the fixtures directory**

```bash
mkdir -p src/test/fixtures/golden
```

- [ ] **Step 3: Dry-run to verify the script loads archetypes**

Run: `node scripts/generate-golden-fixtures.js --dry-run`

Expected: List of 50 `[dry-run] Would generate: ...` lines.

- [ ] **Step 4: Generate a small batch to verify quality**

Run: `node scripts/generate-golden-fixtures.js --count 3`

Expected: 3 fixture files in `src/test/fixtures/golden/`. Open one and verify:
- `onboarding.messages` has 10-12 alternating user/assistant turns
- `onboarding.summary` has all 10 category IDs
- `evaluation` and `difyBaseline` are null/empty (populated later)

- [ ] **Step 5: Generate remaining fixtures**

Run: `node scripts/generate-golden-fixtures.js --start 3`

Expected: 47 more fixture files. Total: 50 files in `src/test/fixtures/golden/`.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-golden-fixtures.js src/test/fixtures/golden/
git commit -m "feat: generate 50 golden test fixtures from company archetypes"
```

---

### Task 3: Convert Lumio AI Demo Data to Golden Fixture

**Files:**
- Read: `scripts/seed-demo-data.js` (lines 74-326 — ONBOARDING_MESSAGES, ONBOARDING_SUMMARY, EVALUATION_DATA, INVESTMENT_DATA)
- Create: `src/test/fixtures/golden/demo-lumio-ai.json`

- [ ] **Step 1: Create the Lumio AI fixture file**

Extract the existing demo data from `scripts/seed-demo-data.js` and format it as a golden fixture. The ONBOARDING_MESSAGES, ONBOARDING_SUMMARY, EVALUATION_DATA, and INVESTMENT_DATA constants are already in the exact format needed.

```json
{
  "id": "demo-lumio-ai",
  "archetype": {
    "name": "Lumio AI",
    "stage": "early",
    "industry": "SaaS",
    "teamSize": 10,
    "answerStyle": "detailed",
    "revenue": "$10-100K MRR"
  },
  "onboarding": {
    "messages": [ /* copy ONBOARDING_MESSAGES from seed-demo-data.js lines 74-115 */ ],
    "summary": { /* copy ONBOARDING_SUMMARY from seed-demo-data.js lines 140-257 */ }
  },
  "evaluation": {
    "categoryContexts": {},
    "categoryOutputs": {},
    "maturity": null,
    "performance": null
  },
  "investment": {
    "recommendations": null
  },
  "difyBaseline": null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/test/fixtures/golden/demo-lumio-ai.json
git commit -m "feat: add Lumio AI demo data as golden fixture"
```

---

## Phase 0b: Capture Dify Baselines

### Task 4: Create Baseline Capture Script

**Files:**
- Create: `scripts/capture-dify-baselines.js`
- Read: `src/test/fixtures/golden/*.json`

This script feeds each fixture's onboarding summary through the current Dify evaluation pipeline and captures the outputs. It must run while Dify is still active.

- [ ] **Step 1: Write the baseline capture script**

```js
#!/usr/bin/env node
/**
 * Capture Dify evaluation baselines for all golden fixtures.
 *
 * For each fixture:
 *   1. POST /api/evaluation/generate with the fixture's onboarding summary
 *   2. Parse the SSE stream, collect category outputs + maturity + investment
 *   3. Write results back to the fixture's difyBaseline field
 *
 * Usage:
 *   node scripts/capture-dify-baselines.js --base-url https://fundy.nusuai.com --token <JWT>
 *   node scripts/capture-dify-baselines.js --base-url http://localhost:5173 --token <JWT>
 *
 * Requires:
 *   --base-url: The app URL (production or local)
 *   --token: A valid JWT from a logged-in session (copy from browser devtools)
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FIXTURES_DIR = join(ROOT, 'src', 'test', 'fixtures', 'golden');

function parseArgs() {
  const args = process.argv.slice(2);
  const baseUrl = args.includes('--base-url') ? args[args.indexOf('--base-url') + 1] : null;
  const token = args.includes('--token') ? args[args.indexOf('--token') + 1] : null;
  const fixtureId = args.includes('--fixture') ? args[args.indexOf('--fixture') + 1] : null;
  if (!baseUrl || !token) {
    console.error('Usage: node scripts/capture-dify-baselines.js --base-url <url> --token <jwt> [--fixture <id>]');
    process.exit(1);
  }
  return { baseUrl, token, fixtureId };
}

async function captureEvaluation(baseUrl, token, companyName, onboardingSummary) {
  const url = `${baseUrl}/api/evaluation/generate`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyName, onboardingSummary }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Evaluation API error (${response.status}): ${text}`);
  }

  const categoryOutputs = {};
  let maturity = null;
  let performance = null;
  let investmentRecommendations = null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));
        switch (event.type) {
          case 'category_complete':
            categoryOutputs[event.category_id || event.data?.category_id] = event.data;
            break;
          case 'maturity_calculated':
            maturity = event.data;
            break;
          case 'investment_recommendations_complete':
            investmentRecommendations = event.data;
            break;
          case 'error':
            console.error(`    SSE error: ${event.message}`);
            break;
        }
      } catch (_e) { /* skip unparseable lines */ }
    }
  }

  return { categoryOutputs, maturity, investmentRecommendations };
}

async function main() {
  const { baseUrl, token, fixtureId } = parseArgs();

  const files = readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.json'))
    .filter(f => !fixtureId || f.includes(fixtureId))
    .sort();

  console.log(`\nCapturing Dify baselines for ${files.length} fixtures from ${baseUrl}\n`);

  let captured = 0;
  let errors = 0;

  for (const file of files) {
    const filePath = join(FIXTURES_DIR, file);
    const fixture = JSON.parse(readFileSync(filePath, 'utf8'));

    if (fixture.difyBaseline) {
      console.log(`  ⏭ ${fixture.id}: already has baseline, skipping`);
      continue;
    }

    try {
      console.log(`  ⏳ ${fixture.id}: capturing evaluation...`);
      const result = await captureEvaluation(
        baseUrl,
        token,
        fixture.archetype.name,
        fixture.onboarding.summary,
      );

      fixture.difyBaseline = {
        evaluation: {
          categoryOutputs: result.categoryOutputs,
          maturity: result.maturity,
        },
        investment: {
          recommendations: result.investmentRecommendations,
        },
      };

      writeFileSync(filePath, JSON.stringify(fixture, null, 2));
      console.log(`  ✓ ${fixture.id}: captured ${Object.keys(result.categoryOutputs).length} categories`);
      captured++;

      // Rate limit: 5s between calls to avoid overloading
      await new Promise(r => setTimeout(r, 5000));
    } catch (err) {
      console.error(`  ✗ ${fixture.id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n--- Done: ${captured} captured, ${errors} errors ---\n`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run baseline capture against production**

This is a manual step. You need a valid JWT from a logged-in session:
1. Log in to `https://fundy.nusuai.com`
2. Open browser devtools → Application → Local Storage → find the Supabase auth token
3. Run:

```bash
node scripts/capture-dify-baselines.js \
  --base-url https://fundy.nusuai.com \
  --token <paste-jwt-here>
```

Expected: Each fixture file updated with `difyBaseline` populated. Some may error if the evaluation pipeline has issues with certain company profiles — that's OK, re-run individual fixtures with `--fixture <id>`.

- [ ] **Step 3: Verify baseline coverage**

```bash
node -e "
const fs = require('fs');
const dir = 'src/test/fixtures/golden';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
let withBaseline = 0;
let without = 0;
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8'));
  if (d.difyBaseline) withBaseline++; else without++;
}
console.log('With baseline:', withBaseline, '| Without:', without, '| Total:', files.length);
"
```

Expected: At least 40 of 50 fixtures should have baselines. Fixtures without baselines can still be used for structural validation (Layer 2) but not score comparison (Layer 3).

- [ ] **Step 4: Commit**

```bash
git add scripts/capture-dify-baselines.js src/test/fixtures/golden/
git commit -m "feat: capture Dify baselines for golden fixtures"
```

---

## Phase 1: Provider Abstraction + Onboarding Chat

### Task 5: Install AI SDK Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Vercel AI SDK + OpenAI provider + Zod**

```bash
bun add ai @ai-sdk/openai zod
```

Expected: `ai`, `@ai-sdk/openai`, and `zod` added to `dependencies` in `package.json`. `bun.lock` updated.

- [ ] **Step 2: Install officeparser for file text extraction**

```bash
bun add officeparser
```

- [ ] **Step 3: Verify tests still pass**

Run: `bun run test:run`

Expected: All 203 existing tests pass. New dependencies should not break anything.

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock
git commit -m "deps: add Vercel AI SDK, Zod, and officeparser"
```

---

### Task 6: Create Provider Abstraction Layer

**Files:**
- Create: `api/_llm.js`
- Test: `api/_llm.test.js`

- [ ] **Step 1: Write the failing test**

```js
// api/_llm.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('_llm', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('getModel returns a model for a valid provider:model spec', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.LLM_CHAT_MODEL = 'openai:gpt-4o-mini';
    const { getModel } = await import('./_llm.js');
    const model = getModel('LLM_CHAT_MODEL');
    expect(model).toBeDefined();
    expect(model.modelId).toBe('gpt-4o-mini');
  });

  it('getModel throws when env var is not set', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.LLM_CHAT_MODEL;
    const { getModel } = await import('./_llm.js');
    expect(() => getModel('LLM_CHAT_MODEL')).toThrow('LLM_CHAT_MODEL not configured');
  });

  it('getModel supports different env vars for different workflows', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.LLM_CHAT_MODEL = 'openai:gpt-4o-mini';
    process.env.LLM_EVAL_MODEL = 'openai:gpt-4o';
    const { getModel } = await import('./_llm.js');
    const chatModel = getModel('LLM_CHAT_MODEL');
    const evalModel = getModel('LLM_EVAL_MODEL');
    expect(chatModel.modelId).toBe('gpt-4o-mini');
    expect(evalModel.modelId).toBe('gpt-4o');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run api/_llm.test.js`

Expected: FAIL — `_llm.js` does not exist.

- [ ] **Step 3: Write the implementation**

```js
// api/_llm.js
import { createProviderRegistry } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Add provider imports here as needed:
// import { createAnthropic } from '@ai-sdk/anthropic';

const registry = createProviderRegistry({
  openai: createOpenAI(), // reads OPENAI_API_KEY from env automatically
  // anthropic: createAnthropic(), // reads ANTHROPIC_API_KEY from env
});

/**
 * Get a language model from the provider registry.
 * @param {string} envVar - Environment variable name (e.g., 'LLM_CHAT_MODEL')
 * @returns {LanguageModelV1} AI SDK model instance
 * @throws {Error} if the env var is not set
 */
export function getModel(envVar) {
  const spec = process.env[envVar];
  if (!spec) throw new Error(`${envVar} not configured`);
  return registry.languageModel(spec);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run api/_llm.test.js`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_llm.js api/_llm.test.js
git commit -m "feat: add provider-agnostic LLM abstraction via Vercel AI SDK"
```

---

### Task 7: Create Onboarding System Prompt

**Files:**
- Create: `api/_prompts/onboarding.js`
- Create: `api/_prompts/onboarding.test.js`
- Read: `dify-onboarding-prompt.md` (extract and consolidate the 6 node prompts)

- [ ] **Step 1: Write the snapshot test**

```js
// api/_prompts/onboarding.test.js
import { describe, it, expect } from 'vitest';
import { ONBOARDING_SYSTEM_PROMPT, buildOnboardingMessages } from './onboarding.js';

describe('onboarding prompt', () => {
  it('system prompt contains all 10 category names', () => {
    const categories = [
      'Product & Technology', 'Market Traction', 'Business Model', 'Team',
      'Go-to-Market', 'Financial Health', 'Fundraising', 'Competitive Position',
      'Operations', 'Legal',
    ];
    for (const cat of categories) {
      expect(ONBOARDING_SYSTEM_PROMPT).toContain(cat);
    }
  });

  it('system prompt contains summary generation instructions', () => {
    expect(ONBOARDING_SYSTEM_PROMPT).toContain('[ONBOARDING_SUMMARY]');
    expect(ONBOARDING_SYSTEM_PROMPT).toContain('[/ONBOARDING_SUMMARY]');
  });

  it('system prompt contains adaptive escalation rules', () => {
    expect(ONBOARDING_SYSTEM_PROMPT.toLowerCase()).toContain('concept');
    expect(ONBOARDING_SYSTEM_PROMPT.toLowerCase()).toContain('validated');
  });

  it('buildOnboardingMessages returns system + conversation messages', () => {
    const history = [
      { role: 'user', content: 'We are a fintech startup' },
      { role: 'assistant', content: 'Tell me more about your product' },
    ];
    const messages = buildOnboardingMessages(history);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe(ONBOARDING_SYSTEM_PROMPT);
    expect(messages.slice(1)).toEqual(history);
  });

  it('buildOnboardingMessages works with empty history', () => {
    const messages = buildOnboardingMessages([]);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('system');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run api/_prompts/onboarding.test.js`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the onboarding prompt module**

Read `dify-onboarding-prompt.md` thoroughly. Extract and consolidate prompts from:
- "NEXT QUESTION LLM" (10-question bank, adaptive escalation rules)
- "RESPONSE PROCESSING LLM" (evidence-aware follow-up logic)
- "GENERATING ONBOARDING" (summary generation with `[ONBOARDING_SUMMARY]` markers)

Merge into a single system prompt that handles all three roles in one LLM call:

```js
// api/_prompts/onboarding.js

export const ONBOARDING_SYSTEM_PROMPT = `You are an AI startup evaluator conducting an onboarding conversation with a founder. Your goal is to collect a comprehensive company profile across 10 evaluation dimensions through natural conversation.

## Your Approach

Ask questions one at a time, adapting based on the founder's responses. Be conversational — acknowledge what they share, then ask the next relevant question. You are an expert startup advisor, not a form.

## 10 Evaluation Dimensions

Each dimension has specific information you need to gather:

1. **Product & Technology** — What they're building, technical differentiation, development stage, IP, scalability
2. **Market Traction & Revenue** — MRR, growth rate, retention, customers, CAC, TAM/SAM
3. **Business Model & Economics** — Revenue model, pricing, gross margins, unit economics, LTV
4. **Team & Organization** — Founders, key hires, gaps, domain expertise, advisors
5. **Go-to-Market** — Distribution channels, sales motion (PLG/outbound/enterprise), marketing, partnerships
6. **Financial Health** — Runway, burn rate, revenue coverage, financial projections
7. **Fundraising & Capital** — Prior raises, current round target, investors, valuation, use of funds
8. **Competitive Position** — Competitors, differentiation, moat, win/loss patterns
9. **Operations** — Support, infrastructure, processes, scaling plan, QA
10. **Legal & Compliance** — Entity structure, IP assignments, data privacy (GDPR/SOC2), regulatory

## Adaptive Escalation Rules

After each response, assess the company's apparent maturity for that topic:
- **Concept stage** (no evidence, just an idea) → acknowledge and move to the next category
- **Early stage** (some basic evidence) → ask 1 follow-up to probe for Validated-level evidence
- **Validated stage** (concrete metrics, documented processes) → acknowledge strength and move on
- **Scaling stage** (comprehensive evidence, growth data) → acknowledge and move on

## Conversation Flow

1. Start with an open-ended question about what they're building
2. Let the founder's first answer guide your next question naturally
3. Cover all 10 dimensions across ~10 questions (combine related dimensions when natural)
4. After ~10 exchanges OR when the founder says "done", "finish", "summary", or "end", generate the summary

## Follow-Up Rules

Only ask a follow-up when:
- The founder gave a vague answer about a critical dimension (product, market, team, or financial)
- Specific numbers were hinted at but not stated (e.g., "we have some revenue" → "What's your current MRR?")

Do NOT follow up when:
- The dimension is clearly at Concept stage (no evidence to dig into)
- The founder gave a complete answer with specific data
- You've already asked about this dimension

## Summary Generation

When it's time to generate the summary (after ~10 exchanges or when the founder requests it), output the summary wrapped in markers:

[ONBOARDING_SUMMARY]
{
  "version": "1.0",
  "companyName": "<extracted from conversation>",
  "generatedAt": "<current ISO 8601 timestamp>",
  "overallCompleteness": <0-100, average of all category completeness values>,
  "categories": [
    {
      "id": "<one of the 10 category IDs>",
      "title": "<full category title>",
      "summary": "<1-2 sentence summary of what was discussed>",
      "completeness": <0-100>,
      "status": "<complete|needs_attention|incomplete>",
      "highlights": ["<1-3 key strengths mentioned>"],
      "gaps": ["<1-3 pieces of missing information>"],
      "keyMetrics": { "<metricName>": "<value>" },
      "deepDivePrompt": "<2-3 sentence personalized opener for a follow-up conversation>"
    }
  ]
}
[/ONBOARDING_SUMMARY]

Category IDs: product_technology, market_traction, business_model, team_organization, go_to_market, financial_health, fundraising_capital, competitive_position, operations, legal_compliance

Completeness scoring:
- 80-100: Detailed data with specific numbers and evidence
- 60-79: Good coverage with some specifics
- 40-59: Brief mention, lacks detail
- 20-39: Minimal information, mostly inferred
- 0-19: Not discussed at all

Status derivation: completeness >= 70 → "complete", >= 40 → "needs_attention", < 40 → "incomplete"

Before the summary JSON, write a brief natural-language closing message to the founder (1-2 sentences). After the summary, do not add any additional text.`;

/**
 * Build the messages array for a streamText() call.
 * @param {Array<{role: string, content: string}>} conversationHistory
 * @returns {Array<{role: string, content: string}>}
 */
export function buildOnboardingMessages(conversationHistory) {
  return [
    { role: 'system', content: ONBOARDING_SYSTEM_PROMPT },
    ...conversationHistory,
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run api/_prompts/onboarding.test.js`

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_prompts/onboarding.js api/_prompts/onboarding.test.js
git commit -m "feat: add consolidated onboarding system prompt"
```

---

### Task 8: Replace Dify Proxy in api/chat.js (Onboarding Path)

**Files:**
- Modify: `api/chat.js`
- Read: `api/_auth.js` (auth pattern)
- Read: `api/_llm.js` (getModel)
- Read: `api/_prompts/onboarding.js` (prompt)
- Read: `src/api/difyApi.js` (SSE event format the frontend expects)

- [ ] **Step 1: Add the direct LLM onboarding path to api/chat.js**

The key change: when `LLM_CHAT_MODEL` is set, route onboarding messages through AI SDK's `streamText()` instead of proxying to Dify. Emit SSE events in the same format the frontend expects.

Read the current `api/chat.js` first. Then add the new path alongside the existing Dify proxy (feature flag pattern from the spec).

Add these imports at the top of `api/chat.js`:

```js
import { streamText } from 'ai';
import { getModel } from './_llm.js';
import { buildOnboardingMessages } from './_prompts/onboarding.js';
```

Add a new handler function before the existing `handler`:

```js
async function handleOnboardingDirect(req, res, { query, conversationHistory, userId }) {
  const model = getModel('LLM_CHAT_MODEL');
  const messages = buildOnboardingMessages([
    ...conversationHistory,
    { role: 'user', content: query },
  ]);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  try {
    const result = streamText({
      model,
      messages,
      temperature: 0.7,
    });

    const conversationId = `local-${Date.now()}`;
    const messageId = `msg-${Date.now()}`;

    for await (const chunk of result.textStream) {
      const event = {
        event: 'message',
        answer: chunk,
        conversation_id: conversationId,
      };
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    // Send message_end event
    const endEvent = {
      event: 'message_end',
      conversation_id: conversationId,
      message_id: messageId,
    };
    res.write(`data: ${JSON.stringify(endEvent)}\n\n`);
  } catch (err) {
    const errorEvent = { event: 'error', message: err.message };
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
  } finally {
    res.end();
  }
}
```

In the main `handler` function, add the feature flag check before the Dify proxy path:

```js
// After auth verification and body parsing, before the Dify proxy:
const useLLMDirect = !!process.env.LLM_CHAT_MODEL;

if (useLLMDirect && workflow === 'onboarding') {
  return handleOnboardingDirect(req, res, {
    query,
    conversationHistory: inputs?.conversation_history || [],
    userId,
  });
}

// Existing Dify proxy path continues below...
```

Note: The `conversation_history` field needs to be passed from the client. Check how `src/api/difyApi.js` sends messages — currently it sends `query` (the latest message) and `conversation_id` (Dify manages history). For the direct LLM path, the client needs to send the full conversation history. This may require a client-side change in `difyApi.js` to include `conversation_history` in the request body when `VITE_LLM_MOCK` is not set.

**Important:** The frontend `difyApi.js` sends messages in the body as `{ query, conversation_id, ... }`. For the direct LLM path, we need the full conversation history. The simplest approach: have `api/chat.js` load the conversation history from Supabase using the existing `conversation_id` or `conversationDbId`. Read the conversation messages from the `messages` table.

Update `handleOnboardingDirect` to load history from Supabase instead of expecting it in the request:

```js
async function handleOnboardingDirect(req, res, { query, userId }) {
  const model = getModel('LLM_CHAT_MODEL');
  const supabase = getSupabaseAdmin();

  // Load existing conversation history from Supabase
  const { data: convRow } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('workflow', 'onboarding')
    .maybeSingle();

  let conversationHistory = [];
  if (convRow) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', convRow.id)
      .order('created_at', { ascending: true });
    if (msgs) conversationHistory = msgs;
  }

  const messages = buildOnboardingMessages([
    ...conversationHistory,
    { role: 'user', content: query },
  ]);

  // ... rest of streaming logic unchanged
}
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `bun run test:run`

Expected: All existing tests pass. The new code path is only activated when `LLM_CHAT_MODEL` is set, so existing behavior is unchanged.

- [ ] **Step 3: Commit**

```bash
git add api/chat.js
git commit -m "feat: add direct LLM onboarding chat path (feature-flagged via LLM_CHAT_MODEL)"
```

---

### Task 9: Replace File Upload Proxy

**Files:**
- Modify: `api/upload.js`
- Read: `api/_chunking.js` (chunkFileText)
- Read: `api/knowledge/_embeddings.js` (generateEmbeddings)

- [ ] **Step 1: Replace Dify proxy with direct text extraction**

Read the current `api/upload.js` (59 lines). Replace the Dify proxy logic with `officeparser` text extraction. Keep the same response format so the client doesn't need changes.

```js
// api/upload.js
import { verifyAuth } from './_auth.js';
import { parseOfficeAsync } from 'officeparser';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    // Buffer the raw request body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    // Parse multipart form data to extract the file
    // The client sends: FormData with 'file' field
    const boundary = req.headers['content-type']?.split('boundary=')[1];
    if (!boundary) {
      return res.status(400).json({ error: 'Missing multipart boundary' });
    }

    const { fileName, fileBuffer } = parseMultipart(body, boundary);

    // Extract text using officeparser
    const extractedText = await parseOfficeAsync(fileBuffer);

    return res.status(200).json({
      id: `file-${Date.now()}`,
      name: fileName,
      size: fileBuffer.length,
      extracted_text: extractedText || '',
    });
  } catch (err) {
    console.error('[upload] Error:', err.message);
    return res.status(500).json({ error: 'File processing failed' });
  }
}

function parseMultipart(body, boundary) {
  const boundaryBytes = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = body.indexOf(boundaryBytes) + boundaryBytes.length;

  while (start < body.length) {
    const nextBoundary = body.indexOf(boundaryBytes, start);
    if (nextBoundary === -1) break;

    const part = body.slice(start, nextBoundary);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) { start = nextBoundary + boundaryBytes.length; continue; }

    const headers = part.slice(0, headerEnd).toString('utf8');
    const content = part.slice(headerEnd + 4, part.length - 2); // trim trailing \r\n

    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);

    if (nameMatch && filenameMatch) {
      parts.push({ name: nameMatch[1], fileName: filenameMatch[1], buffer: content });
    }
    start = nextBoundary + boundaryBytes.length;
  }

  const filePart = parts.find(p => p.name === 'file');
  if (!filePart) throw new Error('No file field in multipart body');
  return { fileName: filePart.fileName, fileBuffer: filePart.buffer };
}
```

- [ ] **Step 2: Verify the upload endpoint works**

This requires manual testing with a file upload. The client-side code in `src/utils/fileUpload.js` sends a FormData with a `file` field. The new endpoint returns `{ id, name, size, extracted_text }` instead of Dify's `{ id }`.

- [ ] **Step 3: Commit**

```bash
git add api/upload.js
git commit -m "feat: replace Dify file upload proxy with direct text extraction via officeparser"
```

---

## Phase 2: Deep-Dive Chat

### Task 10: Create Deep-Dive System Prompt

**Files:**
- Create: `api/_prompts/deepdive.js`
- Create: `api/_prompts/deepdive.test.js`

- [ ] **Step 1: Write the failing test**

```js
// api/_prompts/deepdive.test.js
import { describe, it, expect } from 'vitest';
import { buildDeepDiveSystemPrompt, buildDeepDiveMessages } from './deepdive.js';

const mockSummary = {
  companyName: 'TestCo',
  categories: [
    {
      id: 'product_technology',
      title: 'Product & Technology',
      summary: 'Building an ML platform',
      completeness: 60,
      highlights: ['Strong technical team'],
      gaps: ['No IP protection strategy'],
      deepDivePrompt: 'Let us explore your product architecture in detail.',
    },
  ],
};

describe('deepdive prompt', () => {
  it('builds a system prompt scoped to the specified category', () => {
    const prompt = buildDeepDiveSystemPrompt('product_technology', mockSummary);
    expect(prompt).toContain('Product & Technology');
    expect(prompt).toContain('Building an ML platform');
    expect(prompt).toContain('Strong technical team');
    expect(prompt).toContain('No IP protection strategy');
  });

  it('throws for an unknown category ID', () => {
    expect(() => buildDeepDiveSystemPrompt('nonexistent', mockSummary)).toThrow();
  });

  it('buildDeepDiveMessages returns system + history', () => {
    const history = [{ role: 'user', content: 'Hello' }];
    const prompt = buildDeepDiveSystemPrompt('product_technology', mockSummary);
    const messages = buildDeepDiveMessages(prompt, history);
    expect(messages[0].role).toBe('system');
    expect(messages.slice(1)).toEqual(history);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run api/_prompts/deepdive.test.js`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```js
// api/_prompts/deepdive.js

/**
 * Build a category-scoped system prompt for deep-dive conversations.
 * @param {string} categoryId - One of the 10 evaluation category IDs
 * @param {object} onboardingSummary - The full onboarding summary object
 * @returns {string} System prompt
 */
export function buildDeepDiveSystemPrompt(categoryId, onboardingSummary) {
  const category = onboardingSummary.categories?.find(c => c.id === categoryId);
  if (!category) {
    throw new Error(`Category '${categoryId}' not found in onboarding summary`);
  }

  const highlightsList = (category.highlights || []).map(h => `- ${h}`).join('\n');
  const gapsList = (category.gaps || []).map(g => `- ${g}`).join('\n');
  const metricsText = category.keyMetrics
    ? Object.entries(category.keyMetrics).map(([k, v]) => `- ${k}: ${v}`).join('\n')
    : 'None recorded yet.';

  return `You are an AI startup advisor conducting a deep-dive conversation about ${category.title} for ${onboardingSummary.companyName || 'this company'}.

## Context from Onboarding

**Summary:** ${category.summary}

**Completeness:** ${category.completeness}% — ${category.status === 'complete' ? 'well-covered' : category.status === 'needs_attention' ? 'needs more detail' : 'significant gaps remain'}

**Known Strengths:**
${highlightsList || '- None identified yet'}

**Information Gaps:**
${gapsList || '- None identified'}

**Key Metrics:**
${metricsText}

## Your Role

Help the founder provide the missing evidence and detail for ${category.title}. Your goals:

1. **Fill gaps** — Ask specific questions about the identified information gaps above
2. **Deepen strengths** — Get concrete numbers, dates, and evidence for claimed strengths
3. **Probe for evidence** — Look for documentation, metrics, processes, or third-party validation
4. **Be practical** — Suggest what investors/evaluators typically want to see for this dimension

## Conversation Style

- Ask one focused question at a time
- Acknowledge new information before asking the next question
- If the founder uploads a file, reference its contents in your follow-up
- Be specific — ask for numbers, timelines, and concrete examples
- If the founder gives vague answers, ask for specifics once, then move on

Do not generate a summary or structured output. This is a free-form conversation to gather deeper evidence.`;
}

/**
 * Build the messages array for a deep-dive streamText() call.
 * @param {string} systemPrompt - From buildDeepDiveSystemPrompt()
 * @param {Array<{role: string, content: string}>} conversationHistory
 * @returns {Array<{role: string, content: string}>}
 */
export function buildDeepDiveMessages(systemPrompt, conversationHistory) {
  return [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run api/_prompts/deepdive.test.js`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_prompts/deepdive.js api/_prompts/deepdive.test.js
git commit -m "feat: add deep-dive category-scoped system prompt"
```

---

### Task 11: Add Deep-Dive Path to api/chat.js

**Files:**
- Modify: `api/chat.js`

- [ ] **Step 1: Add the deep-dive direct LLM handler**

Add import at top of `api/chat.js`:

```js
import { buildDeepDiveSystemPrompt, buildDeepDiveMessages } from './_prompts/deepdive.js';
```

Add a new handler function:

```js
async function handleDeepDiveDirect(req, res, { query, categoryId, userId }) {
  const model = getModel('LLM_CHAT_MODEL');
  const supabase = getSupabaseAdmin();

  // Load onboarding summary
  const { data: summaryRow } = await supabase
    .from('onboarding_summaries')
    .select('summary_data')
    .eq('user_id', userId)
    .maybeSingle();

  if (!summaryRow?.summary_data) {
    return res.status(400).json({ error: 'No onboarding summary found. Complete onboarding first.' });
  }

  const systemPrompt = buildDeepDiveSystemPrompt(categoryId, summaryRow.summary_data);

  // Load existing deep-dive conversation history for this category
  const { data: convRow } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('workflow', 'deepdive')
    .eq('category_id', categoryId)
    .maybeSingle();

  let conversationHistory = [];
  if (convRow) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', convRow.id)
      .order('created_at', { ascending: true });
    if (msgs) conversationHistory = msgs;
  }

  const messages = buildDeepDiveMessages(systemPrompt, [
    ...conversationHistory,
    { role: 'user', content: query },
  ]);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  try {
    const result = streamText({ model, messages, temperature: 0.7 });
    const conversationId = `local-${Date.now()}`;
    const messageId = `msg-${Date.now()}`;

    for await (const chunk of result.textStream) {
      const event = { event: 'message', answer: chunk, conversation_id: conversationId };
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    const endEvent = { event: 'message_end', conversation_id: conversationId, message_id: messageId };
    res.write(`data: ${JSON.stringify(endEvent)}\n\n`);
  } catch (err) {
    const errorEvent = { event: 'error', message: err.message };
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
  } finally {
    res.end();
  }
}
```

In the main `handler`, extend the feature flag check:

```js
if (useLLMDirect && workflow === 'onboarding') {
  return handleOnboardingDirect(req, res, { query, userId });
}
if (useLLMDirect && workflow === 'deepdive') {
  const categoryId = inputs?.category_id;
  if (!categoryId) return res.status(400).json({ error: 'category_id required for deep-dive' });
  return handleDeepDiveDirect(req, res, { query, categoryId, userId });
}
```

- [ ] **Step 2: Add file text embedding to the direct handlers**

After the streaming completes in both `handleOnboardingDirect` and `handleDeepDiveDirect`, add the file text embedding pipeline (same pattern as the existing Dify path). Check if `files` were included in the request body. If so, the extracted text was already returned by `api/upload.js` — embed it:

```js
// After streaming completes, before res.end():
if (files?.length > 0) {
  // Fire-and-forget embedding
  embedFileText(userId, files).catch(err =>
    console.error('[chat] File embedding error:', err.message)
  );
}
```

Where `embedFileText` is a helper that chunks and embeds extracted text (reusing the existing pattern from the current `api/chat.js` lines 230-250).

- [ ] **Step 3: Verify existing tests still pass**

Run: `bun run test:run`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add api/chat.js
git commit -m "feat: add direct LLM deep-dive chat path with category-scoped prompts"
```

---

## Phase 3: Evaluation Pipeline

### Task 12: Create Evaluation Scorecards + Prompt

**Files:**
- Create: `api/_prompts/evaluation.js`
- Create: `api/_prompts/evaluation.test.js`
- Read: `dify-evaluation-workflow.md` (extract all 10 per-category scorecards)

- [ ] **Step 1: Write the failing test**

```js
// api/_prompts/evaluation.test.js
import { describe, it, expect } from 'vitest';
import { EVALUATION_SCORECARDS, buildEvalPrompt, EvalCategorySchema } from './evaluation.js';

describe('evaluation prompts', () => {
  const VALID_IDS = [
    'product_technology', 'market_traction', 'business_model', 'team_organization',
    'go_to_market', 'financial_health', 'fundraising_capital', 'competitive_position',
    'operations', 'legal_compliance',
  ];

  it('has scorecards for all 10 categories', () => {
    expect(Object.keys(EVALUATION_SCORECARDS)).toHaveLength(10);
    for (const id of VALID_IDS) {
      expect(EVALUATION_SCORECARDS[id]).toBeDefined();
      expect(EVALUATION_SCORECARDS[id]).toContain('PROVEN');
    }
  });

  it('buildEvalPrompt returns system + user messages for a valid category', () => {
    const { system, user } = buildEvalPrompt('product_technology', 'Some context about the product');
    expect(system).toContain('Product & Technology');
    expect(system).toContain('PROVEN');
    expect(system).toContain('PARTIAL');
    expect(system).toContain('UNPROVEN');
    expect(user).toContain('Some context about the product');
  });

  it('buildEvalPrompt throws for unknown category', () => {
    expect(() => buildEvalPrompt('nonexistent', 'ctx')).toThrow();
  });

  it('EvalCategorySchema validates a correct output', () => {
    const valid = {
      category_id: 'product_technology',
      category_title: 'Product & Technology',
      summary: 'Strong technical foundation.',
      completeness: 75,
      status: 'complete',
      highlights: ['ML pipeline'],
      gaps: [{ action: 'File patents', type: 'stretch', evidence_items: [15, 16] }],
      keyMetrics: {
        perItemAssessment: { item1: 'PROVEN', item2: 'PARTIAL' },
        provenCount: 12,
        partialCount: 5,
        unprovenCount: 3,
      },
      deepDivePrompt: 'Let us explore your technical architecture.',
    };
    expect(() => EvalCategorySchema.parse(valid)).not.toThrow();
  });

  it('EvalCategorySchema rejects invalid completeness', () => {
    const invalid = {
      category_id: 'product_technology',
      category_title: 'Product & Technology',
      summary: 'test',
      completeness: 150,
      status: 'complete',
      highlights: [],
      gaps: [],
      keyMetrics: { perItemAssessment: {}, provenCount: 0, partialCount: 0, unprovenCount: 0 },
      deepDivePrompt: 'test',
    };
    expect(() => EvalCategorySchema.parse(invalid)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run api/_prompts/evaluation.test.js`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

Read `dify-evaluation-workflow.md` to extract the 10 per-category scorecards. Each scorecard contains 20 evidence items with maturity gate assignments. Store them in `EVALUATION_SCORECARDS` as a plain object keyed by category ID.

```js
// api/_prompts/evaluation.js
import { z } from 'zod';

const CATEGORY_TITLES = {
  product_technology: 'Product & Technology',
  market_traction: 'Market Traction & Revenue',
  business_model: 'Business Model & Economics',
  team_organization: 'Team & Organization',
  go_to_market: 'Go-to-Market',
  financial_health: 'Financial Health',
  fundraising_capital: 'Fundraising & Capital',
  competitive_position: 'Competitive Position',
  operations: 'Operations',
  legal_compliance: 'Legal & Compliance',
};

export const EvalCategorySchema = z.object({
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

// Extract these from dify-evaluation-workflow.md — each is the per-category
// scorecard content that was previously stored in Dify env vars.
// The full content must be copied from the workflow doc.
export const EVALUATION_SCORECARDS = {
  product_technology: `/* PASTE SCORECARD FROM dify-evaluation-workflow.md eval_product_technology section */`,
  market_traction: `/* PASTE SCORECARD FROM dify-evaluation-workflow.md eval_market_traction section */`,
  business_model: `/* PASTE SCORECARD FROM dify-evaluation-workflow.md eval_business_model section */`,
  team_organization: `/* PASTE SCORECARD FROM dify-evaluation-workflow.md eval_team_organization section */`,
  go_to_market: `/* PASTE SCORECARD FROM dify-evaluation-workflow.md eval_go_to_market section */`,
  financial_health: `/* PASTE SCORECARD FROM dify-evaluation-workflow.md eval_financial_health section */`,
  fundraising_capital: `/* PASTE SCORECARD FROM dify-evaluation-workflow.md eval_fundraising_capital section */`,
  competitive_position: `/* PASTE SCORECARD FROM dify-evaluation-workflow.md eval_competitive_position section */`,
  operations: `/* PASTE SCORECARD FROM dify-evaluation-workflow.md eval_operations section */`,
  legal_compliance: `/* PASTE SCORECARD FROM dify-evaluation-workflow.md eval_legal_compliance section */`,
};

const EVAL_SYSTEM_TEMPLATE = `You are evaluating a startup across the dimension: {{CATEGORY_TITLE}}.

## Scoring Methodology

Score each of the 20 evidence items below as:
- **PROVEN** (1.0) — Clear, specific evidence provided
- **PARTIAL** (0.5) — Some evidence but incomplete or vague
- **UNPROVEN** (0.0) — No evidence found

## Step 1a: Initial Scoring
Score each item based on the provided context.

## Step 1b: Maturity Inference
After initial scoring, check for maturity inference:
- If a PROVEN item is 2+ maturity gates above an UNPROVEN item → upgrade UNPROVEN to PROVEN
- If a PROVEN item is exactly 1 gate above an UNPROVEN item → upgrade UNPROVEN to PARTIAL
- Only PROVEN items trigger inference; only UNPROVEN items get promoted

## Step 2: Calculate Completeness
completeness = (sum of all scores / 20) * 100

## Step 3: Derive Status
- completeness >= 70 → "complete"
- completeness >= 40 → "needs_attention"
- completeness < 40 → "incomplete"

## Step 4: Determine Maturity Stage
Based on which maturity gates have the most PROVEN items.

## Step 5: Identify Gaps (max 5)
Only include UNPROVEN/PARTIAL items at:
- Current maturity gate (type: "table_stakes")
- Next gate up (type: "stretch")
Exclude inferred items from gap recommendations.

## Step 6: Build Output
Respond with ONLY valid JSON matching the required schema. No markdown fences, no explanation.

## Evidence Scorecard
{{SCORECARD}}`;

/**
 * Build the system and user prompts for an evaluation category.
 * @param {string} categoryId
 * @param {string} context - Pre-retrieved KB + onboarding context
 * @returns {{ system: string, user: string }}
 */
export function buildEvalPrompt(categoryId, context) {
  const title = CATEGORY_TITLES[categoryId];
  const scorecard = EVALUATION_SCORECARDS[categoryId];
  if (!title || !scorecard) {
    throw new Error(`Unknown evaluation category: ${categoryId}`);
  }

  const system = EVAL_SYSTEM_TEMPLATE
    .replace('{{CATEGORY_TITLE}}', title)
    .replace('{{SCORECARD}}', scorecard);

  const user = `## Company Context for ${title}\n\n${context}`;

  return { system, user };
}
```

**IMPORTANT:** The implementer MUST read `dify-evaluation-workflow.md` and extract the actual scorecard content for each of the 10 categories. Search for sections like `### eval_product_technology` or `BEGIN eval_product_technology` in that file. Each scorecard contains 20 evidence items with maturity gate assignments (e.g., "Gate 1: Concept", "Gate 2: Early", etc.).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run api/_prompts/evaluation.test.js`

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_prompts/evaluation.js api/_prompts/evaluation.test.js
git commit -m "feat: add evaluation scorecards and Zod schema for 10-category evaluation"
```

---

### Task 13: Port Maturity Calculation + Investment Matrix to JS

**Files:**
- Create: `api/evaluation/_maturity.js`
- Create: `api/evaluation/_maturity.test.js`
- Read: `dify-evaluation-workflow.md` (find the `calculate_maturity` and `generate_matrix` Python Code node implementations)

- [ ] **Step 1: Write the failing test**

```js
// api/evaluation/_maturity.test.js
import { describe, it, expect } from 'vitest';
import { calculateMaturity, generateInvestmentMatrix } from './_maturity.js';

describe('calculateMaturity', () => {
  it('returns Concept stage for all-low scores', () => {
    const results = {};
    const ids = [
      'product_technology', 'market_traction', 'business_model', 'team_organization',
      'go_to_market', 'financial_health', 'fundraising_capital', 'competitive_position',
      'operations', 'legal_compliance',
    ];
    for (const id of ids) {
      results[id] = { completeness: 15, keyMetrics: { provenCount: 3, partialCount: 2, unprovenCount: 15 } };
    }
    const maturity = calculateMaturity(results);
    expect(maturity.level).toBe(1);
    expect(maturity.name).toBe('Concept');
    expect(maturity.score).toBeGreaterThan(0);
  });

  it('returns Validated stage for mid-range scores', () => {
    const results = {};
    const ids = [
      'product_technology', 'market_traction', 'business_model', 'team_organization',
      'go_to_market', 'financial_health', 'fundraising_capital', 'competitive_position',
      'operations', 'legal_compliance',
    ];
    for (const id of ids) {
      results[id] = { completeness: 65, keyMetrics: { provenCount: 12, partialCount: 4, unprovenCount: 4 } };
    }
    const maturity = calculateMaturity(results);
    expect(maturity.level).toBe(3);
    expect(maturity.name).toBe('Validated');
  });

  it('returns overall performance score and label', () => {
    const results = {};
    const ids = [
      'product_technology', 'market_traction', 'business_model', 'team_organization',
      'go_to_market', 'financial_health', 'fundraising_capital', 'competitive_position',
      'operations', 'legal_compliance',
    ];
    for (const id of ids) {
      results[id] = { completeness: 80, keyMetrics: { provenCount: 16, partialCount: 2, unprovenCount: 2 } };
    }
    const maturity = calculateMaturity(results);
    expect(maturity.performance.score).toBeGreaterThanOrEqual(1);
    expect(maturity.performance.score).toBeLessThanOrEqual(5);
    expect(['Poor', 'Fair', 'Average', 'Good', 'Exceptional']).toContain(maturity.performance.label);
  });
});

describe('generateInvestmentMatrix', () => {
  it('returns scores for all 6 investment types', () => {
    const results = {};
    const ids = [
      'product_technology', 'market_traction', 'business_model', 'team_organization',
      'go_to_market', 'financial_health', 'fundraising_capital', 'competitive_position',
      'operations', 'legal_compliance',
    ];
    for (const id of ids) {
      results[id] = { completeness: 50, keyMetrics: { provenCount: 10, partialCount: 5, unprovenCount: 5 } };
    }
    const maturity = { level: 2, name: 'Early', score: 300 };
    const matrix = generateInvestmentMatrix(results, maturity);
    expect(Object.keys(matrix)).toEqual(
      expect.arrayContaining(['pre_seed', 'seed', 'series_a', 'venture_debt', 'grants', 'crowdfunding'])
    );
    for (const score of Object.values(matrix)) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run api/evaluation/_maturity.test.js`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

Port the Python Code node logic from `dify-evaluation-workflow.md`. Search for the `calculate_maturity` and `generate_matrix` code blocks in that file.

```js
// api/evaluation/_maturity.js

const MATURITY_STAGES = [
  { level: 1, name: 'Concept', minScore: 0 },
  { level: 2, name: 'Early', minScore: 200 },
  { level: 3, name: 'Validated', minScore: 400 },
  { level: 4, name: 'Scaling', minScore: 650 },
  { level: 5, name: 'Leader', minScore: 850 },
];

const PERFORMANCE_LABELS = [
  { min: 0, max: 1.5, label: 'Poor' },
  { min: 1.5, max: 2.5, label: 'Fair' },
  { min: 2.5, max: 3.5, label: 'Average' },
  { min: 3.5, max: 4.5, label: 'Good' },
  { min: 4.5, max: 5.1, label: 'Exceptional' },
];

const INVESTMENT_TYPES = ['pre_seed', 'seed', 'series_a', 'venture_debt', 'grants', 'crowdfunding'];

/**
 * Calculate overall maturity stage from 10 category evaluation results.
 * Port of the Dify `calculate_maturity` Python Code node.
 *
 * @param {Object} categoryResults - Map of categoryId → { completeness, keyMetrics: { provenCount, partialCount, unprovenCount } }
 * @returns {{ level: number, name: string, score: number, performance: { score: number, label: string } }}
 */
export function calculateMaturity(categoryResults) {
  const categories = Object.values(categoryResults);
  if (categories.length === 0) {
    return { level: 1, name: 'Concept', score: 0, performance: { score: 1, label: 'Poor' } };
  }

  // Weighted score: completeness contributes to a 0-1000 scale
  const totalCompleteness = categories.reduce((sum, c) => sum + (c.completeness || 0), 0);
  const score = Math.round((totalCompleteness / categories.length) * 10);

  // Derive maturity level
  let stage = MATURITY_STAGES[0];
  for (const s of MATURITY_STAGES) {
    if (score >= s.minScore) stage = s;
  }

  // Performance: average completeness mapped to 1-5 scale
  const avgCompleteness = totalCompleteness / categories.length;
  const performanceScore = Math.round(((avgCompleteness / 100) * 4 + 1) * 10) / 10; // 1.0 - 5.0
  const perfLabel = PERFORMANCE_LABELS.find(p => performanceScore >= p.min && performanceScore < p.max)?.label || 'Average';

  return {
    level: stage.level,
    name: stage.name,
    score,
    performance: { score: performanceScore, label: perfLabel },
  };
}

/**
 * Score each investment type against the evaluation dimensions.
 * Port of the Dify `generate_matrix` Python Code node.
 *
 * @param {Object} categoryResults - Same as calculateMaturity input
 * @param {{ level: number, name: string, score: number }} maturity
 * @returns {Object} Map of investmentType → suitabilityScore (0-100)
 */
export function generateInvestmentMatrix(categoryResults, maturity) {
  const avgCompleteness = Object.values(categoryResults)
    .reduce((sum, c) => sum + (c.completeness || 0), 0) / Object.keys(categoryResults).length;

  const matrix = {};
  for (const type of INVESTMENT_TYPES) {
    let score;
    switch (type) {
      case 'pre_seed':
        score = Math.min(100, avgCompleteness * 1.2);
        break;
      case 'seed':
        score = maturity.level >= 2 ? Math.min(100, avgCompleteness * 1.1) : avgCompleteness * 0.5;
        break;
      case 'series_a':
        score = maturity.level >= 3 ? Math.min(100, avgCompleteness * 1.0) : avgCompleteness * 0.3;
        break;
      case 'venture_debt':
        score = maturity.level >= 3 ? Math.min(100, avgCompleteness * 0.9) : avgCompleteness * 0.2;
        break;
      case 'grants':
        score = Math.min(100, avgCompleteness * 0.8 + 20);
        break;
      case 'crowdfunding':
        score = Math.min(100, avgCompleteness * 0.7 + 15);
        break;
      default:
        score = avgCompleteness * 0.5;
    }
    matrix[type] = Math.round(score);
  }

  return matrix;
}
```

**IMPORTANT:** The implementer MUST read the actual `calculate_maturity` and `generate_matrix` Python Code node implementations from `dify-evaluation-workflow.md` and port the exact formulas. The code above is a reasonable approximation but the specific weights, thresholds, and scoring formulas must match the Dify implementation exactly for deterministic unit tests to pass against golden fixtures.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run api/evaluation/_maturity.test.js`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/evaluation/_maturity.js api/evaluation/_maturity.test.js
git commit -m "feat: port maturity calculation and investment matrix from Dify Python to JS"
```

---

### Task 14: Rewrite api/evaluation/generate.js

**Files:**
- Modify: `api/evaluation/generate.js`
- Read: `api/evaluation/_categoryContext.js` (stays unchanged)
- Read: `api/_prompts/evaluation.js`
- Read: `api/evaluation/_maturity.js`

This is the core task — replacing the Dify workflow call with 10 parallel `generateObject()` calls.

- [ ] **Step 1: Rewrite the evaluation orchestration**

Read the current `api/evaluation/generate.js` (263 lines). The structure stays the same:
1. JWT auth ✓
2. Build category contexts via `_categoryContext.js` ✓
3. **Replace:** Dify `/workflows/run` call → 10 parallel `generateObject()` calls
4. **Replace:** Dify SSE event transformation → direct SSE event emission
5. SSE response stream ✓

Add new imports:

```js
import { generateObject } from 'ai';
import { getModel } from '../_llm.js';
import { buildEvalPrompt, EvalCategorySchema } from '../_prompts/evaluation.js';
import { calculateMaturity, generateInvestmentMatrix } from './_maturity.js';
```

Replace the Dify workflow call section with:

```js
// Inside the ReadableStream start() function:

const CATEGORY_IDS = [
  'product_technology', 'market_traction', 'business_model', 'team_organization',
  'go_to_market', 'financial_health', 'fundraising_capital', 'competitive_position',
  'operations', 'legal_compliance',
];

const evalModel = getModel('LLM_EVAL_MODEL');

// Phase 1: 10 parallel evaluation calls
sendEvent({ type: 'status', message: 'Evaluating across 10 dimensions...' });

const evalPromises = CATEGORY_IDS.map(async (categoryId) => {
  sendEvent({ type: 'category_started', category_id: categoryId });

  const context = categoryContexts[categoryId] || '';
  const { system, user } = buildEvalPrompt(categoryId, context);

  try {
    const { object } = await generateObject({
      model: evalModel,
      schema: EvalCategorySchema,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
    });

    // Override category_id to ensure it matches (LLM might include eval_ prefix)
    object.category_id = categoryId;
    object.category_title = CATEGORY_TITLES[categoryId];

    sendEvent({ type: 'category_complete', category_id: categoryId, data: object });
    return { categoryId, data: object, error: null };
  } catch (err) {
    sendEvent({ type: 'error', category_id: categoryId, message: `Failed to evaluate ${categoryId}: ${err.message}` });
    return { categoryId, data: null, error: err.message };
  }
});

const evalResults = await Promise.allSettled(evalPromises);
const categoryResults = {};
for (const result of evalResults) {
  const val = result.status === 'fulfilled' ? result.value : { categoryId: 'unknown', data: null, error: result.reason };
  if (val.data) categoryResults[val.categoryId] = val.data;
}

// Phase 1.5: Maturity calculation (deterministic, no LLM)
sendEvent({ type: 'status', message: 'Calculating maturity stage...' });
const maturityData = calculateMaturity(categoryResults);
sendEvent({ type: 'maturity_calculated', data: maturityData });

// Phase 2: Investment matrix + LLM recommendation
// (See Task 15)
```

Keep the existing mock path (`streamMockEvaluation`) and the feature flag:

```js
const useLLMDirect = !!process.env.LLM_EVAL_MODEL;
if (!useLLMDirect) {
  // Existing Dify path or mock
  if (useMock) {
    await streamMockEvaluation(sendEvent, onboardingSummary);
  } else {
    // Existing Dify workflow call
    // ...
  }
} else {
  // New direct LLM path (code above)
}
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `bun run test:run`

Expected: All existing tests pass. The new code path only activates when `LLM_EVAL_MODEL` is set.

- [ ] **Step 3: Commit**

```bash
git add api/evaluation/generate.js
git commit -m "feat: replace Dify evaluation workflow with 10 parallel generateObject() calls"
```

---

## Phase 4: Investment Matching

### Task 15: Create Investment Prompt + Wire into Evaluation Pipeline

**Files:**
- Create: `api/_prompts/investment.js`
- Create: `api/_prompts/investment.test.js`
- Modify: `api/evaluation/generate.js` (add Phase 2)

- [ ] **Step 1: Write the failing test**

```js
// api/_prompts/investment.test.js
import { describe, it, expect } from 'vitest';
import { buildInvestmentPrompt, InvestmentOutputSchema } from './investment.js';

describe('investment prompt', () => {
  it('builds a prompt with evaluation results and matrix', () => {
    const evalResults = { product_technology: { completeness: 75, summary: 'Strong' } };
    const maturity = { level: 3, name: 'Validated', score: 500 };
    const matrix = { pre_seed: 80, seed: 60, series_a: 30 };
    const { system, user } = buildInvestmentPrompt(evalResults, maturity, matrix);
    expect(system).toContain('investment');
    expect(user).toContain('Validated');
    expect(user).toContain('pre_seed');
  });

  it('InvestmentOutputSchema validates a correct output', () => {
    const valid = {
      investment_readiness_summary: { assessment: 'test', primary_recommendation: 'seed', readiness_score: 'Moderate' },
      recommended_funding: [{ investment_type: 'pre_seed', rating: 'strong_fit', fit_explanation: 'test' }],
      conditional_options: [],
      improvement_roadmap: [],
      not_recommended: [{ investment_type: 'series_a', reason: 'Too early' }],
      next_steps: [{ priority: 1, action: 'Do X', timeline: '2 weeks', expected_outcome: 'Y' }],
    };
    expect(() => InvestmentOutputSchema.parse(valid)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run api/_prompts/investment.test.js`

Expected: FAIL.

- [ ] **Step 3: Write the implementation**

```js
// api/_prompts/investment.js
import { z } from 'zod';

export const InvestmentOutputSchema = z.object({
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

const INVESTMENT_SYSTEM_PROMPT = `You are a startup investment advisor. Based on a company's evaluation results across 10 dimensions, generate investment recommendations.

## Investment Types
- pre_seed: Pre-seed funding ($50K-$500K, idea to early product)
- seed: Seed funding ($500K-$3M, product-market fit validation)
- series_a: Series A ($3M-$15M, proven growth, scaling)
- venture_debt: Venture debt (non-dilutive, requires existing equity/revenue)
- grants: Government/research grants (non-dilutive, innovation-focused)
- crowdfunding: Equity crowdfunding (community-driven, consumer products)

## Rating Scale
- ideal: Perfect match for current stage
- strong_fit: Well-suited with minor gaps
- acceptable: Viable but not optimal
- conditional: Possible if specific milestones are met
- not_suitable: Not appropriate for current stage

## Rules
- recommended_funding: Only investment types rated ideal, strong_fit, or acceptable
- conditional_options: Types that could work with specific improvements
- not_recommended: Types that are clearly inappropriate with concise reasons
- improvement_roadmap: Prioritized actions to unlock higher-tier funding
- next_steps: 3-5 immediate actionable items with timelines

Respond with ONLY valid JSON matching the required schema.`;

/**
 * Build prompts for the investment recommendation LLM call.
 * @param {Object} evaluationResults - Map of categoryId → evaluation output
 * @param {{ level: number, name: string, score: number, performance: { score: number, label: string } }} maturityData
 * @param {Object} investmentMatrix - Map of investmentType → suitabilityScore (0-100)
 * @returns {{ system: string, user: string }}
 */
export function buildInvestmentPrompt(evaluationResults, maturityData, investmentMatrix) {
  const categorySummaries = Object.entries(evaluationResults)
    .map(([id, data]) => `- ${id}: completeness=${data.completeness}%, status=${data.status}, summary="${data.summary || ''}"`)
    .join('\n');

  const matrixSummary = Object.entries(investmentMatrix)
    .map(([type, score]) => `- ${type}: suitability=${score}/100`)
    .join('\n');

  const user = `## Company Evaluation Summary

**Maturity Stage:** ${maturityData.name} (Level ${maturityData.level}/5)
**Overall Score:** ${maturityData.score}/1000
**Performance:** ${maturityData.performance.score}/5.0 (${maturityData.performance.label})

## Dimension Results
${categorySummaries}

## Investment Suitability Matrix
${matrixSummary}

Based on these results, generate comprehensive investment recommendations.`;

  return { system: INVESTMENT_SYSTEM_PROMPT, user };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run api/_prompts/investment.test.js`

Expected: 2 tests PASS.

- [ ] **Step 5: Wire Phase 2 into generate.js**

Add to `api/evaluation/generate.js`, after the maturity calculation:

```js
import { buildInvestmentPrompt, InvestmentOutputSchema } from '../_prompts/investment.js';

// ... inside the ReadableStream, after maturity_calculated event:

// Phase 2: Investment recommendations
sendEvent({ type: 'investment_matching_started' });
sendEvent({ type: 'status', message: 'Matching investment profiles...' });

const investmentMatrix = generateInvestmentMatrix(categoryResults, maturityData);
const investmentModel = getModel('LLM_INVESTMENT_MODEL');
const { system: invSystem, user: invUser } = buildInvestmentPrompt(categoryResults, maturityData, investmentMatrix);

try {
  const { object: investmentData } = await generateObject({
    model: investmentModel,
    schema: InvestmentOutputSchema,
    messages: [
      { role: 'system', content: invSystem },
      { role: 'user', content: invUser },
    ],
    temperature: 0.3,
  });

  sendEvent({ type: 'investment_recommendations_complete', data: investmentData });
} catch (err) {
  sendEvent({ type: 'error', message: `Investment matching failed: ${err.message}` });
}

sendEvent({ type: 'workflow_complete', metadata: { categoriesEvaluated: Object.keys(categoryResults).length } });
```

- [ ] **Step 6: Commit**

```bash
git add api/_prompts/investment.js api/_prompts/investment.test.js api/evaluation/generate.js
git commit -m "feat: add investment matching prompt + wire Phase 2 into evaluation pipeline"
```

---

### Task 16: Migrate Action Item Refresh to AI SDK

**Files:**
- Modify: `api/action-items/_analyze.js`
- Read: `api/action-items/_analyze.test.js` (existing 18 tests)

- [ ] **Step 1: Replace raw fetch() with AI SDK generateObject()**

Read the current `api/action-items/_analyze.js` (125 lines). Replace the raw `fetch()` to OpenAI with `generateObject()` using `getModel('LLM_ANALYSIS_MODEL')`.

Replace the imports and OpenAI call:

```js
// Old:
// const response = await fetch(OPENAI_CHAT_URL, { ... });

// New:
import { generateObject } from 'ai';
import { getModel } from '../_llm.js';
import { z } from 'zod';

const AnalysisSchema = z.object({
  status: z.enum(['addressed', 'partially_addressed', 'not_addressed']),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
});
```

Replace the `analyzeActionItem` function body (keep the no-evidence shortcut):

```js
export async function analyzeActionItem(actionItem, evidenceChunks) {
  if (!evidenceChunks || evidenceChunks.length === 0) {
    return {
      status: 'insufficient_evidence',
      confidence: 0,
      summary: 'No relevant evidence found in knowledge base.',
    };
  }

  const evidenceText = evidenceChunks
    .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
    .join('\n\n');

  const userMessage = `Action item: "${actionItem.title}"
Description: ${actionItem.description || 'N/A'}

Evidence found:
${evidenceText}

Classify whether this action item has been addressed.`;

  try {
    const model = getModel('LLM_ANALYSIS_MODEL');
    const { object } = await generateObject({
      model,
      schema: AnalysisSchema,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
    });
    return object;
  } catch (err) {
    return {
      status: 'not_addressed',
      confidence: 0,
      summary: `Analysis failed: ${err.message}`,
    };
  }
}
```

Remove `parseAnalysisResponse` — Zod schema validation replaces manual JSON parsing.

- [ ] **Step 2: Run existing tests**

Run: `bun run vitest run api/action-items/_analyze.test.js`

Expected: Tests that mock the `fetch()` call will need updating to mock `generateObject()` instead. Update the test mocks accordingly.

- [ ] **Step 3: Commit**

```bash
git add api/action-items/_analyze.js api/action-items/_analyze.test.js
git commit -m "refactor: migrate action item refresh from raw OpenAI fetch to AI SDK generateObject"
```

---

## Phase 5: Cleanup + Comparison

### Task 17: Create Comparison Script

**Files:**
- Create: `scripts/compare-evaluation.js`

- [ ] **Step 1: Write the comparison report script**

```js
#!/usr/bin/env node
/**
 * Compare new pipeline evaluation outputs against Dify baselines.
 *
 * Usage:
 *   node scripts/compare-evaluation.js [--fixture <id>] [--verbose]
 *
 * Reads golden fixtures from src/test/fixtures/golden/ and compares:
 *   - evaluation.categoryOutputs (new) vs difyBaseline.evaluation.categoryOutputs (Dify)
 *   - investment.recommendations (new) vs difyBaseline.investment.recommendations (Dify)
 *
 * Thresholds:
 *   - Maturity/performance: within +/-1 per category
 *   - Completeness: within +/-15 per category
 *   - 80% of categories across all fixtures must meet thresholds
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '..', 'src', 'test', 'fixtures', 'golden');

const CATEGORY_IDS = [
  'product_technology', 'market_traction', 'business_model', 'team_organization',
  'go_to_market', 'financial_health', 'fundraising_capital', 'competitive_position',
  'operations', 'legal_compliance',
];

function compareFixture(fixture, verbose) {
  const baseline = fixture.difyBaseline;
  if (!baseline) return { id: fixture.id, skipped: true, reason: 'no baseline' };

  const newEval = fixture.evaluation?.categoryOutputs || {};
  const difyEval = baseline.evaluation?.categoryOutputs || {};

  const comparisons = [];
  for (const catId of CATEGORY_IDS) {
    const dify = difyEval[catId];
    const fresh = newEval[catId];
    if (!dify || !fresh) {
      comparisons.push({ catId, status: 'MISSING', detail: `dify=${!!dify} new=${!!fresh}` });
      continue;
    }

    const completenessDiff = Math.abs((fresh.completeness || 0) - (dify.completeness || 0));
    const completenessOk = completenessDiff <= 15;

    comparisons.push({
      catId,
      difyCompleteness: dify.completeness,
      newCompleteness: fresh.completeness,
      completenessDiff,
      completenessOk,
      difyGaps: (dify.gaps || []).length,
      newGaps: (fresh.gaps || []).length,
    });
  }

  const passing = comparisons.filter(c => c.completenessOk).length;
  const total = comparisons.filter(c => c.status !== 'MISSING').length;

  return { id: fixture.id, skipped: false, comparisons, passing, total, passRate: total > 0 ? passing / total : 0 };
}

function main() {
  const args = process.argv.slice(2);
  const fixtureId = args.includes('--fixture') ? args[args.indexOf('--fixture') + 1] : null;
  const verbose = args.includes('--verbose');

  const files = readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.json'))
    .filter(f => !fixtureId || f.includes(fixtureId))
    .sort();

  console.log(`\nComparing ${files.length} fixtures...\n`);

  let totalPassing = 0;
  let totalComparisons = 0;
  let skipped = 0;
  const flagged = [];

  for (const file of files) {
    const fixture = JSON.parse(readFileSync(join(FIXTURES_DIR, file), 'utf8'));
    const result = compareFixture(fixture, verbose);

    if (result.skipped) {
      skipped++;
      if (verbose) console.log(`  SKIP ${result.id}: ${result.reason}`);
      continue;
    }

    totalPassing += result.passing;
    totalComparisons += result.total;

    const icon = result.passRate >= 0.8 ? 'PASS' : 'FLAG';
    console.log(`  ${icon} ${result.id}: ${result.passing}/${result.total} categories within threshold (${Math.round(result.passRate * 100)}%)`);

    if (result.passRate < 0.8) flagged.push(result);

    if (verbose) {
      for (const c of result.comparisons) {
        if (c.status === 'MISSING') {
          console.log(`    ${c.catId}: MISSING`);
        } else {
          const mark = c.completenessOk ? 'OK' : 'DRIFT';
          console.log(`    ${c.catId}: completeness ${c.difyCompleteness}→${c.newCompleteness} (diff=${c.completenessDiff}) [${mark}]`);
        }
      }
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total fixtures: ${files.length} (${skipped} skipped)`);
  console.log(`Categories within threshold: ${totalPassing}/${totalComparisons} (${totalComparisons > 0 ? Math.round(totalPassing / totalComparisons * 100) : 0}%)`);
  console.log(`Flagged fixtures: ${flagged.length}`);

  if (flagged.length > 0) {
    console.log(`\nFlagged for manual review:`);
    for (const f of flagged) {
      console.log(`  - ${f.id} (${f.passing}/${f.total})`);
    }
  }

  const overallPass = totalComparisons > 0 && (totalPassing / totalComparisons) >= 0.8;
  console.log(`\nOverall: ${overallPass ? 'PASS' : 'FAIL'}`);
  process.exit(overallPass ? 0 : 1);
}

main();
```

- [ ] **Step 2: Commit**

```bash
git add scripts/compare-evaluation.js
git commit -m "feat: add evaluation comparison script for Dify vs new pipeline"
```

---

### Task 18: Create Mock LLM Test Helper

**Files:**
- Create: `src/test/helpers/mockLlm.js`

- [ ] **Step 1: Write the mock LLM helper**

```js
// src/test/helpers/mockLlm.js
import { vi } from 'vitest';

/**
 * Create a mock for the 'ai' module's generateObject function.
 * Returns predetermined responses based on category ID.
 *
 * Usage in tests:
 *   vi.mock('ai', () => createMockAI(fixtureData));
 */
export function createMockAI(categoryOutputs = {}, investmentOutput = null) {
  return {
    generateObject: vi.fn(async ({ messages }) => {
      // Detect which category is being evaluated from the user message
      const userMsg = messages.find(m => m.role === 'user')?.content || '';
      for (const [catId, output] of Object.entries(categoryOutputs)) {
        if (userMsg.includes(catId)) {
          return { object: output };
        }
      }
      // Investment call (no category ID in message)
      if (investmentOutput && userMsg.includes('Investment Suitability Matrix')) {
        return { object: investmentOutput };
      }
      return { object: {} };
    }),
    streamText: vi.fn(async function* () {
      yield 'Mock streaming response';
    }),
  };
}

/**
 * Load a golden fixture and extract its category outputs for mocking.
 */
export function loadFixtureForMock(fixturePath) {
  const { readFileSync } = require('fs');
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  return {
    categoryOutputs: fixture.difyBaseline?.evaluation?.categoryOutputs || {},
    investmentOutput: fixture.difyBaseline?.investment?.recommendations || null,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/test/helpers/mockLlm.js
git commit -m "feat: add mock LLM helper for integration tests"
```

---

### Task 19: Delete Dify Code + Update Env Vars

**Files:**
- Delete: `api/_shared.js`
- Delete: `api/evaluation/_difyWorkflow.js`
- Delete: `api/evaluation/_difyWorkflow.test.js`
- Delete: `api/knowledge/context.js` (if it exists as a non-prefixed endpoint)
- Modify: `.env.example`
- Modify: `vite.config.js` (remove Dify proxy)

- [ ] **Step 1: Delete Dify-specific files**

```bash
rm api/_shared.js
rm api/evaluation/_difyWorkflow.js
rm api/evaluation/_difyWorkflow.test.js
```

Check if `api/knowledge/context.js` exists (non-prefixed = Vercel function):

```bash
ls api/knowledge/context.js 2>/dev/null && rm api/knowledge/context.js || echo "not found"
```

- [ ] **Step 2: Remove Dify imports from modified files**

Search all files under `api/` for imports of `_shared.js` and `_difyWorkflow.js` and remove them:

```bash
grep -rl "_shared.js\|_difyWorkflow.js" api/
```

Remove any remaining `import { resolveApiKey, getDifyBaseUrl } from './_shared.js'` lines and the Dify proxy paths from `api/chat.js`.

- [ ] **Step 3: Update .env.example**

Remove all `DIFY_*` vars and `VITE_DIFY_*` vars. Add `LLM_*` vars:

```
# LLM Configuration (provider:model format)
LLM_CHAT_MODEL=openai:gpt-4o-mini
LLM_EVAL_MODEL=openai:gpt-4o
LLM_INVESTMENT_MODEL=openai:gpt-4o
LLM_ANALYSIS_MODEL=openai:gpt-4o-mini

# Client-side mock mode
VITE_LLM_MOCK=true
```

- [ ] **Step 4: Remove Dify proxy from vite.config.js**

Read `vite.config.js`. Remove the proxy entries for `/api/chat` and `/api/upload` that target Dify. The dev server will now hit the local Vercel dev server or use mock mode.

- [ ] **Step 5: Run all tests**

Run: `bun run test:run`

Expected: All tests pass. Tests that referenced `_difyWorkflow.js` were deleted. Tests that referenced `_shared.js` should have been updated in earlier tasks.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove all Dify code, update env vars to LLM_* format"
```

---

### Task 20: Update Client-Side Mock Toggle

**Files:**
- Modify: `src/api/difyApi.js`
- Modify: `src/api/evaluationApi.js`

- [ ] **Step 1: Rename VITE_DIFY_MOCK to VITE_LLM_MOCK**

In `src/api/difyApi.js`, change:

```js
// Old:
get isMock() { return import.meta.env.VITE_DIFY_MOCK === 'true'; },

// New:
get isMock() { return import.meta.env.VITE_LLM_MOCK === 'true'; },
```

Remove the `useStreaming` getter (streaming is now always-on):

```js
// Delete this line:
get useStreaming() { return import.meta.env.VITE_DIFY_STREAMING === 'true'; },
```

In `src/api/evaluationApi.js`, update the mock check similarly.

- [ ] **Step 2: Run all tests**

Run: `bun run test:run`

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/api/difyApi.js src/api/evaluationApi.js
git commit -m "refactor: rename VITE_DIFY_MOCK to VITE_LLM_MOCK, remove streaming toggle"
```

---

### Task 21: Update Documentation

**Files:**
- Modify: `CLAUDE.md` (Fundy-MVP)
- Modify: `projectmemory.md`

- [ ] **Step 1: Update CLAUDE.md**

Remove all Dify references. Update:
- Environment variables section: replace `DIFY_*` with `LLM_*`
- Architecture section: replace Dify workflow descriptions with AI SDK direct calls
- Serverless functions section: remove `_shared.js`, `_difyWorkflow.js`, `knowledge/context.js`
- Add `api/_llm.js` and `api/_prompts/` to the file structure

- [ ] **Step 2: Add v5.0 section to projectmemory.md**

```markdown
## v5.0 — Dify Migration (May 2026)

Replaced all 4 Dify workflows with direct LLM calls via Vercel AI SDK. Eliminated Dify hosting costs.

### What changed

**Provider abstraction (`api/_llm.js`):**
- `createProviderRegistry` with `provider:model` env var format (e.g., `openai:gpt-4o-mini`)
- Per-workflow model selection: `LLM_CHAT_MODEL`, `LLM_EVAL_MODEL`, `LLM_INVESTMENT_MODEL`, `LLM_ANALYSIS_MODEL`

**Onboarding + deep-dive chat (`api/chat.js`):**
- Replaced Dify proxy with single `streamText()` call per turn
- Consolidated 6 Dify nodes (3 LLM calls/turn) into 1 LLM call with full conversation history
- System prompts extracted to `api/_prompts/onboarding.js` and `api/_prompts/deepdive.js`

**Evaluation pipeline (`api/evaluation/generate.js`):**
- 10 parallel `generateObject()` calls with Zod schemas replace Dify workflow
- Maturity calculation + investment matrix ported from Python Code nodes to `api/evaluation/_maturity.js`
- Structured output via Zod replaces JSON fence-stripping + manual validation

**Investment matching:**
- Single `generateObject()` call with `InvestmentOutputSchema`
- Integrated into evaluation pipeline (Phase 2), same as before

**File handling (`api/upload.js`):**
- `officeparser` replaces Dify's File Extractor for PDF/DOCX/PPTX text extraction

**Testing:**
- 50 golden fixtures (synthetic company profiles) with Dify baselines captured pre-migration
- Comparison script validates new pipeline output within ±15 completeness / ±1 maturity of Dify

### Deleted files
- `api/_shared.js`, `api/evaluation/_difyWorkflow.js`, `api/knowledge/context.js`

### Env vars removed
- `DIFY_BASE_URL`, `DIFY_ONBOARDING_API_KEY`, `DIFY_DEEPDIVE_API_KEY`, `DIFY_EVALUATION_API_KEY`, `DIFY_INVESTMENT_API_KEY`, `DIFY_WEBHOOK_SECRET`, `VITE_DIFY_MOCK`, `VITE_DIFY_STREAMING`

### Env vars added
- `LLM_CHAT_MODEL`, `LLM_EVAL_MODEL`, `LLM_INVESTMENT_MODEL`, `LLM_ANALYSIS_MODEL`, `VITE_LLM_MOCK`
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md projectmemory.md
git commit -m "docs: update CLAUDE.md and projectmemory.md for Dify migration (v5.0)"
```

---

## Post-Migration Validation

### Task 22: Run Full Comparison

This is a manual task after all phases are deployed.

- [ ] **Step 1: Feed golden fixtures through the new pipeline**

For each of the 50 fixtures, call `/api/evaluation/generate` with the fixture's onboarding summary and capture the output. Store results in `fixture.evaluation.categoryOutputs` and `fixture.investment.recommendations`.

You can adapt `scripts/capture-dify-baselines.js` for this — change the URL to the new deployment and write to `evaluation` instead of `difyBaseline`.

- [ ] **Step 2: Run comparison**

```bash
node scripts/compare-evaluation.js --verbose
```

Expected: Overall PASS (80%+ of categories within thresholds).

- [ ] **Step 3: Review flagged fixtures**

Open each flagged fixture and compare the Dify baseline vs new output. Determine if the new output is worse, equivalent, or better. Adjust prompts if needed.

- [ ] **Step 4: Run existing test suite**

```bash
bun run test:run
```

Expected: All tests pass.

- [ ] **Step 5: Final commit**

```bash
git add src/test/fixtures/golden/
git commit -m "test: capture new pipeline outputs for golden fixture comparison"
```
