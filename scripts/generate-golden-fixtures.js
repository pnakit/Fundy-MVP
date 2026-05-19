#!/usr/bin/env node

/**
 * Golden Fixture Generator
 *
 * Generates synthetic onboarding conversations and summaries for each company
 * archetype using OpenAI's API directly. Output files are used as golden test
 * fixtures for the Dify-migration evaluation pipeline.
 *
 * Usage:
 *   node scripts/generate-golden-fixtures.js [--start N] [--count N] [--dry-run]
 *
 * Requires: OPENAI_API_KEY in env or .env file
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

const ARCHETYPES_PATH = resolve(PROJECT_ROOT, 'scripts/archetypes.json');
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'src/test/fixtures/golden');

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';
const RATE_LIMIT_DELAY_MS = 2000;

const CATEGORY_IDS = [
  'product_technology',
  'market_traction',
  'business_model',
  'team_organization',
  'go_to_market',
  'financial_health',
  'fundraising_capital',
  'competitive_position',
  'operations',
  'legal_compliance',
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

// ---------------------------------------------------------------------------
// .env loader (no external dependencies)
// ---------------------------------------------------------------------------

function loadEnvFile() {
  const envPath = resolve(PROJECT_ROOT, '.env');
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    // Strip surrounding quotes (single or double)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Only set if not already in env (real env takes precedence)
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { start: 0, count: Infinity, dryRun: false };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--start':
        args.start = parseInt(argv[++i], 10);
        if (isNaN(args.start) || args.start < 0) {
          console.error('Error: --start must be a non-negative integer');
          process.exit(1);
        }
        break;
      case '--count':
        args.count = parseInt(argv[++i], 10);
        if (isNaN(args.count) || args.count < 1) {
          console.error('Error: --count must be a positive integer');
          process.exit(1);
        }
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      default:
        console.error(`Unknown argument: ${argv[i]}`);
        process.exit(1);
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// OpenAI API helper
// ---------------------------------------------------------------------------

async function callOpenAI(apiKey, systemPrompt, userPrompt, temperature, maxTokens = 4096) {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned empty content');
  }

  return content;
}

// ---------------------------------------------------------------------------
// Strip markdown code fences from LLM output
// ---------------------------------------------------------------------------

function stripCodeFences(text) {
  let cleaned = text.trim();
  // Remove opening ```json or ``` and closing ```
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?\s*```\s*$/i, '');
  return cleaned.trim();
}

// ---------------------------------------------------------------------------
// Conversation generation
// ---------------------------------------------------------------------------

function buildConversationPrompt(archetype) {
  const categoryList = CATEGORY_IDS.map((id) => `- ${CATEGORY_TITLES[id]} (${id})`).join('\n');

  const systemPrompt = `You are a conversation simulator. Generate a realistic 10-12 turn onboarding conversation between a startup evaluator assistant and a startup founder.

The assistant asks probing questions about the company across these 10 evaluation dimensions:
${categoryList}

The founder responds based on their company profile with the specified answer style.

Rules:
- The conversation must alternate between "user" (the founder) and "assistant" (the evaluator), starting with "user".
- 10-12 total messages (5-6 exchanges).
- The assistant should ask insightful follow-up questions that naturally cover all 10 categories.
- The user's responses should reflect the answer style: "sparse" = short/vague answers, "detailed" = thorough/specific answers, "mixed" = varies between sparse and detailed.
- Cover all 10 categories naturally across the conversation — do NOT ask about them one by one in a list.
- Output ONLY a JSON array of message objects: [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}, ...]
- No explanation or commentary outside the JSON.`;

  const userPrompt = `Generate the onboarding conversation for this company:

Name: ${archetype.name}
Stage: ${archetype.stage}
Industry: ${archetype.industry}
Team Size: ${archetype.teamSize}
Answer Style: ${archetype.answerStyle}
Revenue: ${archetype.revenue}
Description: ${archetype.description}

Remember: output ONLY the JSON array of messages, nothing else.`;

  return { systemPrompt, userPrompt };
}

// ---------------------------------------------------------------------------
// Summary generation
// ---------------------------------------------------------------------------

function buildSummaryPrompt(archetype, messages) {
  const categoryList = CATEGORY_IDS.map(
    (id) => `  - id: "${id}", title: "${CATEGORY_TITLES[id]}"`
  ).join('\n');

  const transcript = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');

  const systemPrompt = `You are a startup evaluation summarizer. Given a conversation transcript between an evaluator and a startup founder, generate a structured onboarding summary.

The summary must include ALL 10 of these categories (no exceptions):
${categoryList}

Schema for each category:
{
  "id": "category_id",
  "title": "Category Title",
  "summary": "1-2 sentence summary of what was discussed",
  "completeness": 0-100,
  "status": "complete|needs_attention|incomplete",
  "highlights": ["1-3 positive findings"],
  "gaps": ["1-3 areas needing more info"],
  "keyMetrics": { "metricName": "value" },
  "deepDivePrompt": "2-3 sentence personalized opener for a follow-up conversation about this topic"
}

Status derivation rules:
- completeness >= 70 → "complete"
- completeness >= 40 → "needs_attention"
- completeness < 40 → "incomplete"

Top-level schema:
{
  "version": "1.0",
  "companyName": "string",
  "generatedAt": "ISO 8601 timestamp",
  "overallCompleteness": 0-100 (average of all category completeness values),
  "categories": [ ... all 10 categories ... ]
}

Output ONLY valid JSON matching this schema. No commentary outside the JSON.`;

  const userPrompt = `Generate the onboarding summary for "${archetype.name}" based on this conversation transcript:

${transcript}

Remember: include ALL 10 categories, output ONLY JSON.`;

  return { systemPrompt, userPrompt };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    throw new Error('Summary is not an object');
  }
  if (!Array.isArray(summary.categories)) {
    throw new Error('Summary missing categories array');
  }

  const presentIds = new Set(summary.categories.map((c) => c.id));
  const missingIds = CATEGORY_IDS.filter((id) => !presentIds.has(id));

  if (missingIds.length > 0) {
    throw new Error(`Summary missing category IDs: ${missingIds.join(', ')}`);
  }

  // Validate each category has required fields
  for (const cat of summary.categories) {
    if (typeof cat.completeness !== 'number') {
      throw new Error(`Category "${cat.id}" missing numeric completeness`);
    }
    if (!['complete', 'needs_attention', 'incomplete'].includes(cat.status)) {
      throw new Error(`Category "${cat.id}" has invalid status: "${cat.status}"`);
    }
  }
}

// ---------------------------------------------------------------------------
// Build fixture object
// ---------------------------------------------------------------------------

function buildFixture(archetype, messages, summary) {
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

// ---------------------------------------------------------------------------
// Delay helper
// ---------------------------------------------------------------------------

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadEnvFile();

  const args = parseArgs(process.argv);
  const apiKey = process.env.OPENAI_API_KEY;

  // Load archetypes
  const archetypes = JSON.parse(readFileSync(ARCHETYPES_PATH, 'utf-8'));
  console.log(`Loaded ${archetypes.length} archetypes from ${ARCHETYPES_PATH}`);

  // Determine slice to process
  const slice = archetypes.slice(args.start, args.start + args.count);
  console.log(
    `Processing ${slice.length} archetypes (start=${args.start}, count=${Math.min(args.count, archetypes.length)})`
  );

  // Ensure output directory exists
  mkdirSync(OUTPUT_DIR, { recursive: true });

  if (args.dryRun) {
    console.log('\n--- DRY RUN ---');
    console.log(`Output directory: ${OUTPUT_DIR}\n`);
    for (const arch of slice) {
      const outPath = resolve(OUTPUT_DIR, `${arch.id}.json`);
      console.log(`  Would generate: ${outPath}`);
      console.log(`    Archetype: ${arch.name} (${arch.stage}, ${arch.industry}, ${arch.answerStyle})`);
    }
    console.log(`\nTotal: ${slice.length} fixtures would be generated.`);
    return;
  }

  // Validate API key
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY not found in environment or .env file');
    process.exit(1);
  }

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < slice.length; i++) {
    const archetype = slice[i];
    const globalIdx = args.start + i;
    const outPath = resolve(OUTPUT_DIR, `${archetype.id}.json`);

    console.log(
      `\n[${globalIdx + 1}/${archetypes.length}] Generating fixture for "${archetype.name}" (${archetype.id})...`
    );

    try {
      // Step 1: Generate conversation
      console.log('  Step 1/2: Generating conversation...');
      const convPrompts = buildConversationPrompt(archetype);
      const convRaw = await callOpenAI(apiKey, convPrompts.systemPrompt, convPrompts.userPrompt, 0.7);
      const messages = JSON.parse(stripCodeFences(convRaw));

      if (!Array.isArray(messages) || messages.length < 2) {
        throw new Error(`Conversation has ${messages?.length ?? 0} messages (expected 10-12)`);
      }
      console.log(`  Got ${messages.length} messages`);

      // Rate limit between API calls
      await delay(RATE_LIMIT_DELAY_MS);

      // Step 2: Generate summary
      console.log('  Step 2/2: Generating summary...');
      const sumPrompts = buildSummaryPrompt(archetype, messages);
      const sumRaw = await callOpenAI(apiKey, sumPrompts.systemPrompt, sumPrompts.userPrompt, 0.3);
      const summary = JSON.parse(stripCodeFences(sumRaw));

      // Validate
      validateSummary(summary);
      console.log(`  Summary validated (${summary.categories.length} categories, overall=${summary.overallCompleteness}%)`);

      // Build and save fixture
      const fixture = buildFixture(archetype, messages, summary);
      writeFileSync(outPath, JSON.stringify(fixture, null, 2) + '\n', 'utf-8');
      console.log(`  Saved: ${outPath}`);
      successCount++;
    } catch (err) {
      console.error(`  ERROR for "${archetype.name}": ${err.message}`);
      errorCount++;
    }

    // Rate limit between archetypes (skip delay after the last one)
    if (i < slice.length - 1) {
      await delay(RATE_LIMIT_DELAY_MS);
    }
  }

  console.log(`\nDone. Success: ${successCount}, Errors: ${errorCount}`);
  if (errorCount > 0) {
    process.exit(1);
  }
}

main();
