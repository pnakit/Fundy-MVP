/**
 * One-time cleanup script: removes duplicate embeddings from document_embeddings.
 *
 * For each (user_id, source_type, source_id) group, keeps only the rows with
 * the lowest chunk_index values (i.e. the first N chunks). Duplicates created
 * by the old Date.now() chunk_index strategy are removed.
 *
 * Usage:
 *   node scripts/cleanup-duplicate-embeddings.js --dry-run   # Preview only
 *   node scripts/cleanup-duplicate-embeddings.js --apply      # Actually delete
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const dryRun = !process.argv.includes('--apply');

// ─── Supabase Client ───────────────────────────────────────────

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Main ──────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${dryRun ? 'DRY RUN (no deletions)' : 'APPLY (will delete duplicates)'}\n`);

  // Step 1: Fetch all embeddings (id, grouping keys, chunk_index, created_at)
  // Paginate in batches of 1000 to handle large tables.
  const allRows = [];
  let offset = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('document_embeddings')
      .select('id, user_id, source_type, source_id, chunk_index, created_at')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Failed to fetch embeddings:', error.message);
      process.exit(1);
    }

    allRows.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`Total embeddings in table: ${allRows.length}`);

  // Step 2: Group by (user_id, source_type, source_id)
  const groups = new Map();
  for (const row of allRows) {
    const key = `${row.user_id}::${row.source_type}::${row.source_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  // Step 3: Identify duplicates within each group
  // Strategy: detect timestamp-based chunk_indices (> 1_000_000_000) as legacy duplicates.
  // For groups with only sequential indices, detect true duplicates (same chunk_index).
  const idsToDelete = [];
  let groupsWithDupes = 0;

  for (const [key, rows] of groups) {
    // Separate timestamp-based indices from sequential ones
    const timestampRows = rows.filter((r) => r.chunk_index > 1_000_000_000);
    const sequentialRows = rows.filter((r) => r.chunk_index <= 1_000_000_000);

    // If there are sequential rows, the timestamp rows are legacy duplicates — delete them all
    if (sequentialRows.length > 0 && timestampRows.length > 0) {
      idsToDelete.push(...timestampRows.map((r) => r.id));
      if (timestampRows.length > 0) groupsWithDupes++;
      continue;
    }

    // If ALL rows use timestamp indices (old action-item embeds), keep only the most recent N.
    // N = unique content count (but we don't have content here, so keep by created_at order).
    // Heuristic: for action item exchanges, a reasonable upper bound is ~20 chunks per source.
    // Keep the 20 most recent, delete the rest.
    if (timestampRows.length > 0 && sequentialRows.length === 0) {
      const MAX_CHUNKS_PER_SOURCE = 20;
      if (timestampRows.length > MAX_CHUNKS_PER_SOURCE) {
        // Sort by created_at descending, keep first MAX, delete rest
        const sorted = [...timestampRows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const toRemove = sorted.slice(MAX_CHUNKS_PER_SOURCE);
        idsToDelete.push(...toRemove.map((r) => r.id));
        groupsWithDupes++;
      }
      continue;
    }

    // For sequential-only groups: check for duplicate chunk_indices (shouldn't happen with unique
    // constraint, but check anyway). Keep the newest row per chunk_index.
    const byIndex = new Map();
    for (const row of sequentialRows) {
      if (!byIndex.has(row.chunk_index)) {
        byIndex.set(row.chunk_index, []);
      }
      byIndex.get(row.chunk_index).push(row);
    }
    for (const [_idx, dupes] of byIndex) {
      if (dupes.length > 1) {
        // Keep the most recently created, delete the rest
        const sorted = [...dupes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        idsToDelete.push(...sorted.slice(1).map((r) => r.id));
        groupsWithDupes++;
      }
    }
  }

  console.log(`Source groups with duplicates: ${groupsWithDupes}`);
  console.log(`Embeddings to delete: ${idsToDelete.length}`);
  console.log(`Embeddings to keep: ${allRows.length - idsToDelete.length}\n`);

  if (idsToDelete.length === 0) {
    console.log('No duplicates found. Database is clean.');
    return;
  }

  if (dryRun) {
    // Show a sample of what would be deleted
    const sample = idsToDelete.slice(0, 10);
    const sampleRows = allRows.filter((r) => sample.includes(r.id));
    console.log('Sample rows that would be deleted:');
    for (const row of sampleRows) {
      console.log(`  id=${row.id}  source=${row.source_type}/${row.source_id}  chunk=${row.chunk_index}  created=${row.created_at}`);
    }
    if (idsToDelete.length > 10) {
      console.log(`  ... and ${idsToDelete.length - 10} more`);
    }
    console.log('\nRun with --apply to delete these rows.');
    return;
  }

  // Step 4: Delete in batches of 100
  const BATCH_SIZE = 100;
  let deleted = 0;

  for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
    const batch = idsToDelete.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('document_embeddings').delete().in('id', batch);

    if (error) {
      console.error(`Failed to delete batch at offset ${i}:`, error.message);
      process.exit(1);
    }

    deleted += batch.length;
    process.stdout.write(`\rDeleted ${deleted}/${idsToDelete.length}`);
  }

  console.log(`\n\nDone. Removed ${deleted} duplicate embeddings.`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
