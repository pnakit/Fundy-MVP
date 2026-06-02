#!/usr/bin/env node

/**
 * Capture Dify evaluation baselines for golden fixtures.
 *
 * Feeds each fixture's onboarding summary through the current Dify evaluation
 * pipeline (via /api/evaluation/generate + /api/evaluation/investment-match)
 * and writes the outputs back to fixture.difyBaseline.
 *
 * Must be run while Dify is still active.
 *
 * Usage:
 *   node scripts/capture-dify-baselines.js --base-url https://fundy.nusuai.com --token <JWT>
 *   node scripts/capture-dify-baselines.js --base-url http://localhost:5173 --token <JWT>
 *   node scripts/capture-dify-baselines.js --base-url <url> --token <jwt> --fixture <id>
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, '..', 'src', 'test', 'fixtures', 'golden');
const DELAY_BETWEEN_FIXTURES_MS = 5000;

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--base-url' && argv[i + 1]) {
      args.baseUrl = argv[++i].replace(/\/$/, ''); // strip trailing slash
    } else if (argv[i] === '--token' && argv[i + 1]) {
      args.token = argv[++i];
    } else if (argv[i] === '--fixture' && argv[i + 1]) {
      args.fixtureId = argv[++i];
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// SSE stream reader
// ---------------------------------------------------------------------------

/**
 * Read an SSE response stream and return all parsed events.
 * Handles partial lines by buffering until a newline arrives.
 */
async function readSSEStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last (possibly incomplete) line in the buffer
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        try {
          events.push(JSON.parse(jsonStr));
        } catch (_e) {
          // Skip unparseable lines
        }
      }
    }

    // Process any remaining buffer content
    if (buffer.startsWith('data: ')) {
      const jsonStr = buffer.slice(6).trim();
      if (jsonStr) {
        try {
          events.push(JSON.parse(jsonStr));
        } catch (_e) {
          // Skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return events;
}

// ---------------------------------------------------------------------------
// Phase 1: Evaluation generation
// ---------------------------------------------------------------------------

async function runPhase1(baseUrl, token, companyName, onboardingSummary) {
  const response = await fetch(`${baseUrl}/api/evaluation/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ companyName, onboardingSummary }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Phase 1 failed (${response.status}): ${errorText}`);
  }

  const events = await readSSEStream(response);

  const categoryOutputs = {};
  let metadata = null;

  for (const event of events) {
    switch (event.type) {
      case 'category_complete':
        if (event.data?.category_id) {
          categoryOutputs[event.data.category_id] = event.data;
        }
        break;
      case 'workflow_complete':
        metadata = event.metadata || null;
        break;
      case 'error':
        throw new Error(`Phase 1 SSE error: ${event.message}`);
    }
  }

  // Build categoryResults in the format Phase 2 expects (eval_ prefix)
  const categoryResults = {};
  for (const [catId, catData] of Object.entries(categoryOutputs)) {
    categoryResults[`eval_${catId}`] = {
      category_id: catData.category_id,
      completeness: catData.completeness,
      status: catData.status,
      highlights: catData.highlights || [],
      gaps: catData.gaps || [],
      summary: catData.summary || '',
    };
  }

  return { categoryOutputs, categoryResults, metadata };
}

// ---------------------------------------------------------------------------
// Phase 2: Investment matching
// ---------------------------------------------------------------------------

async function runPhase2(baseUrl, token, categoryResults) {
  const response = await fetch(`${baseUrl}/api/evaluation/investment-match`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ categoryResults }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Phase 2 failed (${response.status}): ${errorText}`);
  }

  const events = await readSSEStream(response);

  let maturity = null;
  let investmentRecommendations = null;
  let metadata = null;

  for (const event of events) {
    switch (event.type) {
      case 'maturity_calculated':
        maturity = event.data || null;
        break;
      case 'investment_recommendations_complete':
        investmentRecommendations = event.data || null;
        break;
      case 'workflow_complete':
        metadata = event.metadata || null;
        break;
      case 'error':
        throw new Error(`Phase 2 SSE error: ${event.message}`);
    }
  }

  return { maturity, investmentRecommendations, metadata };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  if (!args.baseUrl || !args.token) {
    console.error('Usage: node scripts/capture-dify-baselines.js --base-url <url> --token <jwt> [--fixture <id>]');
    process.exit(1);
  }

  // Load fixtures
  const allFiles = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));

  if (allFiles.length === 0) {
    console.error(`No .json fixtures found in ${FIXTURES_DIR}`);
    process.exit(1);
  }

  // Filter to specific fixture if requested
  const targetFiles = args.fixtureId
    ? allFiles.filter((f) => {
        const data = JSON.parse(readFileSync(join(FIXTURES_DIR, f), 'utf8'));
        return data.id === args.fixtureId;
      })
    : allFiles;

  if (args.fixtureId && targetFiles.length === 0) {
    console.error(`No fixture found with id "${args.fixtureId}"`);
    process.exit(1);
  }

  console.log(`\nDify Baseline Capture`);
  console.log(`=====================`);
  console.log(`Base URL:  ${args.baseUrl}`);
  console.log(`Fixtures:  ${targetFiles.length} of ${allFiles.length}`);
  console.log('');

  let captured = 0;
  let errors = 0;

  for (let i = 0; i < targetFiles.length; i++) {
    const filename = targetFiles[i];
    const filepath = join(FIXTURES_DIR, filename);
    const fixture = JSON.parse(readFileSync(filepath, 'utf8'));
    const id = fixture.id || filename.replace('.json', '');

    // Skip if baseline already captured (idempotent)
    if (fixture.difyBaseline) {
      console.log(`\u23ED ${id}: already has baseline, skipping`);
      continue;
    }

    // Validate fixture has required data
    const companyName = fixture.onboarding?.summary?.companyName;
    const onboardingSummary = fixture.onboarding?.summary;

    if (!companyName || !onboardingSummary) {
      console.log(`\u2717 ${id}: missing companyName or onboarding summary, skipping`);
      errors++;
      continue;
    }

    console.log(`\u23F3 ${id}: capturing...`);

    try {
      // Phase 1: Evaluation generation
      const phase1 = await runPhase1(args.baseUrl, args.token, companyName, onboardingSummary);
      const categoryCount = Object.keys(phase1.categoryOutputs).length;

      // Phase 2: Investment matching (only if we got category results)
      let phase2 = { maturity: null, investmentRecommendations: null, metadata: null };
      if (Object.keys(phase1.categoryResults).length > 0) {
        phase2 = await runPhase2(args.baseUrl, args.token, phase1.categoryResults);
      }

      // Write baseline back to fixture
      fixture.difyBaseline = {
        evaluation: {
          categoryOutputs: phase1.categoryOutputs,
          maturity: phase2.maturity,
        },
        investment: {
          recommendations: phase2.investmentRecommendations,
        },
      };

      writeFileSync(filepath, JSON.stringify(fixture, null, 2) + '\n', 'utf8');

      console.log(
        `\u2713 ${id}: captured ${categoryCount} categories` +
          (phase2.maturity ? `, maturity=${phase2.maturity.maturity_stage}` : '') +
          (phase2.investmentRecommendations ? ', investments=yes' : '')
      );
      captured++;
    } catch (err) {
      console.log(`\u2717 ${id}: ${err.message}`);
      errors++;
    }

    // Rate limiting delay between fixtures (skip after last one)
    if (i < targetFiles.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_FIXTURES_MS));
    }
  }

  // Summary
  console.log('');
  console.log(`Done: ${captured} captured, ${errors} errors`);

  // Verification command suggestion
  console.log('');
  console.log('Verify baselines with:');
  console.log(`  node -e "
const fs = require('fs');
const dir = 'src/test/fixtures/golden';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
let withBaseline = 0, without = 0;
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8'));
  if (d.difyBaseline) withBaseline++; else without++;
}
console.log('With baseline:', withBaseline, '| Without:', without, '| Total:', files.length);
"`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
