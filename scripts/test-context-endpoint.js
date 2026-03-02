/**
 * Test script for the /api/knowledge/context endpoint.
 *
 * This simulates what Dify's HTTP Request node will do — calls the endpoint
 * with a webhook secret and user_id, and prints the response.
 *
 * Usage:
 *   node scripts/test-context-endpoint.js [--local | --production]
 *
 * --local: tests against the serverless function directly (no HTTP, imports handler)
 * --production: tests against the deployed Vercel endpoint (requires deploy)
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DIFY_WEBHOOK_SECRET in .env
 */

const isProduction = process.argv.includes('--production');

async function testLocal() {
  // Load env vars
  const { config } = await import('dotenv');
  config();

  // Import the handler directly
  const { default: handler } = await import('../api/knowledge/context.js');

  // Find the test user
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1 });
  const testUser = users?.users?.[0];
  if (!testUser) {
    console.error('No users found. Log in via the app first.');
    process.exit(1);
  }

  console.log(`Testing with user: ${testUser.email} (${testUser.id})\n`);

  // Mock req/res
  const req = {
    method: 'POST',
    headers: {
      'x-webhook-secret': process.env.DIFY_WEBHOOK_SECRET,
    },
    body: {
      user_id: testUser.id,
    },
  };

  let statusCode;
  let responseBody;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
    },
  };

  await handler(req, res);

  console.log(`Status: ${statusCode}`);
  if (statusCode === 200) {
    const keys = Object.keys(responseBody);
    console.log(`Returned ${keys.length} context blocks:\n`);
    for (const key of keys) {
      const value = responseBody[key];
      const preview = value.substring(0, 150).replace(/\n/g, ' ');
      console.log(`  ${key}: ${preview}...`);
    }
    console.log(`\nFull response for first category:\n`);
    console.log(responseBody[keys[0]]);
  } else {
    console.log('Error:', JSON.stringify(responseBody, null, 2));
  }
}

async function testProduction() {
  const { config } = await import('dotenv');
  config();

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1 });
  const testUser = users?.users?.[0];
  if (!testUser) {
    console.error('No users found.');
    process.exit(1);
  }

  console.log(`Testing production endpoint with user: ${testUser.email}\n`);

  const response = await fetch('https://app.nusuai.com/api/knowledge/context', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Secret': process.env.DIFY_WEBHOOK_SECRET,
    },
    body: JSON.stringify({ user_id: testUser.id }),
  });

  const body = await response.json();
  console.log(`Status: ${response.status}`);
  console.log(JSON.stringify(body, null, 2));
}

if (isProduction) {
  testProduction().catch(console.error);
} else {
  testLocal().catch(console.error);
}
