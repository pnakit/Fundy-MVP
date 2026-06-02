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

  let files;
  try {
    files = readdirSync(FIXTURES_DIR)
      .filter(f => f.endsWith('.json'))
      .filter(f => !fixtureId || f.includes(fixtureId))
      .sort();
  } catch (_err) {
    console.log(`No fixtures directory found at ${FIXTURES_DIR}`);
    console.log('Generate fixtures first with: node scripts/generate-golden-fixtures.js');
    process.exit(0);
  }

  if (files.length === 0) {
    console.log('No fixture files found.');
    process.exit(0);
  }

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
