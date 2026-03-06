/**
 * Clear all application data for a specific user.
 * Leaves the auth.users record intact — only removes app data.
 *
 * Usage:
 *   node scripts/clear-user-data.js --email peter@nusufi.com
 *   node scripts/clear-user-data.js --user-id 0d71eb07-6e99-4109-ae02-b9e1f657c911
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function resolveUserId() {
  const emailArg = process.argv.find((a) => a.startsWith('--email='))?.slice(8) ||
    (process.argv.includes('--email') ? process.argv[process.argv.indexOf('--email') + 1] : null);
  const idArg = process.argv.find((a) => a.startsWith('--user-id='))?.slice(10) ||
    (process.argv.includes('--user-id') ? process.argv[process.argv.indexOf('--user-id') + 1] : null);

  if (idArg) return idArg;

  if (emailArg) {
    // Search by listing users — Supabase admin API doesn't have getUserByEmail
    let page = 1;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 50 });
      if (error) { console.error(`Failed to list users: ${error.message}`); process.exit(1); }
      const match = data.users.find((u) => u.email === emailArg);
      if (match) return match.id;
      if (data.users.length < 50) break;
      page++;
    }
    console.error(`No user found with email: ${emailArg}`);
    process.exit(1);
  }

  console.error('Usage: node scripts/clear-user-data.js --email <email>  OR  --user-id <uuid>');
  process.exit(1);
}

async function clearUser(userId) {
  console.log(`\nClearing all app data for user: ${userId}\n`);

  // Tables with cascading FK dependencies — order matters
  const steps = [
    { table: 'document_embeddings', label: 'document embeddings' },
    { table: 'action_items',        label: 'action items' },
    { table: 'investment_selections', label: 'investment selections' },
    { table: 'evaluations',         label: 'evaluations' },
    { table: 'messages',            label: 'messages' },
    { table: 'conversations',       label: 'conversations' },
    { table: 'file_metadata',       label: 'file metadata' },
    { table: 'onboarding_summaries', label: 'onboarding summary' },
  ];

  let anyError = false;
  for (const { table, label } of steps) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .eq('user_id', userId);

    if (error) {
      console.error(`  ✗ ${label}: ${error.message}`);
      anyError = true;
    } else {
      console.log(`  ✓ ${label}: ${count ?? 0} rows deleted`);
    }
  }

  if (anyError) {
    console.log('\nCompleted with errors — check output above.');
  } else {
    console.log('\nDone. User account preserved; all app data cleared.');
    console.log('User can now log in and start fresh.');
  }
}

const userId = await resolveUserId();
await clearUser(userId);
