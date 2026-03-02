/**
 * Seed script for populating Supabase with test data.
 *
 * Usage:
 *   node scripts/seed-test-data.js --fake    # Random embeddings (tests plumbing)
 *   node scripts/seed-test-data.js --real    # Real OpenAI embeddings (tests semantics)
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * For --real mode: also requires OPENAI_API_KEY
 */

import { createClient } from '@supabase/supabase-js';

const mode = process.argv.includes('--real') ? 'real' : 'fake';

// ─── Supabase Client ───────────────────────────────────────────

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('Example: SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/seed-test-data.js --fake');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Embedding Helpers ─────────────────────────────────────────

function generateFakeEmbedding() {
  // Random unit vector (1536 dims)
  const vec = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => v / norm);
}

async function generateRealEmbeddings(texts) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY required for --real mode');
    process.exit(1);
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`OpenAI error: ${err}`);
    process.exit(1);
  }

  const data = await response.json();
  return data.data.map((d) => d.embedding);
}

async function getEmbeddings(texts) {
  if (mode === 'real') {
    return generateRealEmbeddings(texts);
  }
  return texts.map(() => generateFakeEmbedding());
}

// ─── Test Data ─────────────────────────────────────────────────

const ONBOARDING_MESSAGES = [
  { role: 'user', content: 'We are Acme Corp, a B2B SaaS company building an AI-powered analytics platform for mid-market enterprises.' },
  { role: 'assistant', content: 'Great! Tell me more about your product and technology stack. What makes your platform different from existing analytics solutions?' },
  { role: 'user', content: 'We have a proprietary ML pipeline that performs 3x better than benchmarks on structured data analysis. Our architecture is API-first, built on Python/FastAPI with React frontend. No patents filed yet but we have novel attention mechanisms.' },
  { role: 'assistant', content: 'That sounds like a strong technical foundation with clear differentiation. What about your market traction — do you have paying customers?' },
  { role: 'user', content: 'Yes, we have $45K MRR growing 15% month-over-month. Net revenue retention is 120%. Our main channel is product-led growth with a 4.2% self-serve conversion rate. We also have an emerging enterprise sales motion.' },
  { role: 'assistant', content: 'Impressive growth metrics. Tell me about your team and financial health.' },
  { role: 'user', content: 'Team of 12, CEO has 10+ years domain experience, CTO scaled systems to 100M+ users before. We need a VP Sales and 2 senior engineers. We have 18 months runway at $80K/mo burn. Revenue covers 40% of expenses. Raised $1.5M seed 8 months ago.' },
  { role: 'assistant', content: 'Thanks for the comprehensive overview. Let me compile this into an evaluation summary. Your team has strong technical leadership and solid product-market fit signals.' },
];

const DEEPDIVE_MESSAGES = [
  { role: 'assistant', content: "Let's dive deeper into your product and technology. Based on what you shared, I'd like to explore your IP strategy, technical debt, and product roadmap in more detail." },
  { role: 'user', content: "Our core ML model uses a novel attention mechanism that we developed in-house. We haven't filed patents yet because of cost concerns, but we're considering provisional filings. Technical debt is moderate — we refactored the data pipeline last quarter." },
  { role: 'assistant', content: 'The novel attention mechanism could be patentable and would strengthen your competitive moat. What is your product roadmap for the next 12 months?' },
  { role: 'user', content: 'Q2: Enterprise SSO and audit logs. Q3: Self-hosted deployment option for regulated industries. Q4: Multi-model support and custom model training for enterprise customers.' },
  { role: 'assistant', content: 'That is an ambitious but focused roadmap. The enterprise features in Q2 align well with your emerging enterprise sales motion and could unlock higher ACV deals.' },
];

const ONBOARDING_SUMMARY = {
  version: '1.0',
  companyName: 'Acme Corp',
  generatedAt: '2026-03-01T14:30:00.000Z',
  overallCompleteness: 68,
  categories: [
    { id: 'product_technology', title: 'Product & Technology', summary: 'SaaS platform with proprietary ML pipeline. Strong technical differentiation but limited IP protection strategy.', completeness: 85, status: 'complete', highlights: ['Proprietary ML model with 3x benchmark performance', 'API-first architecture enables rapid integration'], gaps: ['No patent filings documented', 'Technical debt assessment missing'], keyMetrics: { techStackMaturity: 'Advanced', ipProtection: 'Low', productStage: 'Growth' }, deepDivePrompt: "Let's dive deeper into your product and technology." },
    { id: 'market_traction', title: 'Market Traction & Revenue', summary: 'Growing MRR with strong net retention.', completeness: 72, status: 'complete', highlights: ['$45K MRR with 15% MoM growth', 'Net revenue retention at 120%'], gaps: ['TAM analysis incomplete'], keyMetrics: { mrr: '$45K', mrrGrowth: '15% MoM', netRetention: '120%' }, deepDivePrompt: "Let's explore your market traction in more detail." },
    { id: 'business_model', title: 'Business Model & Economics', summary: 'SaaS subscription model with tiered pricing.', completeness: 60, status: 'needs_attention', highlights: ['Three-tier pricing model', 'Gross margins above 70%'], gaps: ['Customer lifetime value incomplete'], keyMetrics: { grossMargin: '72%' }, deepDivePrompt: "Let's examine your business model more closely." },
    { id: 'team_organization', title: 'Team & Organization', summary: 'Strong founding team with complementary skills.', completeness: 78, status: 'complete', highlights: ['CEO has 10+ years domain expertise', 'CTO previously scaled to 100M+ users'], gaps: ['VP Sales unfilled'], keyMetrics: { teamSize: '12' }, deepDivePrompt: "Let's discuss your team and organizational structure." },
    { id: 'go_to_market', title: 'Go-to-Market', summary: 'Product-led growth motion with emerging enterprise sales.', completeness: 55, status: 'needs_attention', highlights: ['Self-serve conversion at 4.2%'], gaps: ['Enterprise playbook not documented'], keyMetrics: { primaryMotion: 'PLG' }, deepDivePrompt: "Let's explore your go-to-market strategy." },
    { id: 'financial_health', title: 'Financial Health', summary: '18 months runway remaining.', completeness: 65, status: 'needs_attention', highlights: ['18 months runway', 'Revenue covering 40% of expenses'], gaps: ['Detailed projections not provided'], keyMetrics: { runway: '18 months', burnRate: '$80K/mo' }, deepDivePrompt: "Let's look at your financial health in more detail." },
    { id: 'fundraising_capital', title: 'Fundraising & Capital', summary: 'Seed round completed.', completeness: 50, status: 'needs_attention', highlights: ['$1.5M seed closed 8 months ago'], gaps: ['Series A target valuation not discussed'], keyMetrics: { lastRound: 'Seed ($1.5M)' }, deepDivePrompt: "Let's discuss your fundraising strategy." },
    { id: 'competitive_position', title: 'Competitive Position', summary: 'Clear technical moat.', completeness: 45, status: 'incomplete', highlights: ['3x performance advantage'], gaps: ['Competitive matrix not provided'], keyMetrics: { primaryDifferentiator: 'AI Performance' }, deepDivePrompt: "Let's analyze your competitive position." },
    { id: 'operations', title: 'Operations', summary: 'Lean operations with strong engineering processes.', completeness: 40, status: 'incomplete', highlights: ['99.9% uptime SLA'], gaps: ['Support scaling plan not discussed'], keyMetrics: { uptime: '99.9%' }, deepDivePrompt: "Let's look at your operations." },
    { id: 'legal_compliance', title: 'Legal & Compliance', summary: 'Basic corporate structure in place.', completeness: 35, status: 'incomplete', highlights: ['Delaware C-Corp'], gaps: ['GDPR compliance unknown'], keyMetrics: { entityType: 'Delaware C-Corp' }, deepDivePrompt: "Let's explore your legal and compliance readiness." },
  ],
};

// ─── Chunking (inline — mirrors api/_chunking.js logic) ────────

function chunkConversationMessages(messages, workflow, categoryId) {
  const chunks = [];
  for (let i = 0; i < messages.length; i += 2) {
    const userMsg = messages[i];
    const assistantMsg = messages[i + 1];
    let content = '';
    if (i > 0 && messages[i - 1]) {
      const prev = messages[i - 1].content;
      content += `[Previous context] Assistant: ${prev.slice(0, 200)}${prev.length > 200 ? '...' : ''}\n\n`;
    }
    content += `User: ${userMsg.content}`;
    if (assistantMsg) content += `\nAssistant: ${assistantMsg.content}`;
    chunks.push({
      content,
      chunk_index: chunks.length,
      metadata: { workflow, category_id: categoryId || null, message_range: [i, assistantMsg ? i + 1 : i] },
    });
  }
  return chunks;
}

function chunkSummaryData(summaryData) {
  return summaryData.categories.map((cat, index) => {
    const lines = [`Category: ${cat.title}`, `Completeness: ${cat.completeness}%`, `Summary: ${cat.summary}`];
    if (cat.highlights?.length) lines.push(`Highlights: ${cat.highlights.join('; ')}`);
    if (cat.gaps?.length) lines.push(`Gaps: ${cat.gaps.join('; ')}`);
    if (cat.keyMetrics && Object.keys(cat.keyMetrics).length > 0) {
      lines.push(`Key Metrics: ${Object.entries(cat.keyMetrics).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }
    return { content: lines.join('\n'), chunk_index: index, metadata: { category_id: cat.id, completeness: cat.completeness } };
  });
}

// ─── Main Seed Function ────────────────────────────────────────

async function seed() {
  console.log(`\nSeeding test data (mode: ${mode})...\n`);

  // Step 1: Find or identify test user
  const { data: users, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1 });
  if (usersErr || !users?.users?.length) {
    console.error('Error: No users found in auth.users. Create a test user first (log in via the app).');
    process.exit(1);
  }
  const testUser = users.users[0];
  console.log(`Using test user: ${testUser.email} (${testUser.id})`);

  // Step 2: Clean up existing test data for this user
  console.log('Cleaning up existing data...');
  await supabase.from('document_embeddings').delete().eq('user_id', testUser.id);
  await supabase.from('messages').delete().eq('user_id', testUser.id);
  await supabase.from('conversations').delete().eq('user_id', testUser.id);
  await supabase.from('onboarding_summaries').delete().eq('user_id', testUser.id);
  await supabase.from('file_metadata').delete().eq('user_id', testUser.id);

  // Step 3: Insert onboarding conversation
  console.log('Inserting onboarding conversation...');
  const { data: onboardingConv, error: convErr } = await supabase
    .from('conversations')
    .insert({ user_id: testUser.id, workflow: 'onboarding', dify_conversation_id: 'dify_test_onboarding' })
    .select('id')
    .single();

  if (convErr) {
    console.error(`Failed to insert conversation: ${convErr.message}`);
    process.exit(1);
  }

  const msgRows = ONBOARDING_MESSAGES.map((msg) => ({
    conversation_id: onboardingConv.id,
    user_id: testUser.id,
    role: msg.role,
    content: msg.content,
  }));
  const { error: msgErr } = await supabase.from('messages').insert(msgRows);
  if (msgErr) {
    console.error(`Failed to insert messages: ${msgErr.message}`);
    process.exit(1);
  }
  console.log(`  Inserted ${msgRows.length} onboarding messages`);

  // Step 4: Insert deep-dive conversation
  console.log('Inserting deep-dive conversation...');
  const { data: deepDiveConv, error: ddConvErr } = await supabase
    .from('conversations')
    .insert({ user_id: testUser.id, workflow: 'deepdive', category_id: 'product_technology', dify_conversation_id: 'dify_test_deepdive' })
    .select('id')
    .single();

  if (ddConvErr) {
    console.error(`Failed to insert deep-dive conversation: ${ddConvErr.message}`);
    process.exit(1);
  }

  const ddMsgRows = DEEPDIVE_MESSAGES.map((msg) => ({
    conversation_id: deepDiveConv.id,
    user_id: testUser.id,
    role: msg.role,
    content: msg.content,
  }));
  const { error: ddMsgErr } = await supabase.from('messages').insert(ddMsgRows);
  if (ddMsgErr) {
    console.error(`Failed to insert deep-dive messages: ${ddMsgErr.message}`);
    process.exit(1);
  }
  console.log(`  Inserted ${ddMsgRows.length} deep-dive messages`);

  // Step 5: Insert onboarding summary
  console.log('Inserting onboarding summary...');
  const { error: summaryErr } = await supabase
    .from('onboarding_summaries')
    .insert({ user_id: testUser.id, summary_data: ONBOARDING_SUMMARY, onboarding_phase: 'summary' });
  if (summaryErr) {
    console.error(`Failed to insert summary: ${summaryErr.message}`);
    process.exit(1);
  }
  console.log('  Inserted onboarding summary (10 categories)');

  // Step 6: Insert file metadata
  console.log('Inserting file metadata...');
  const { error: fileErr } = await supabase.from('file_metadata').insert([
    { user_id: testUser.id, file_name: 'pitch-deck-q1-2026.pdf', file_path: 'uploads/test-user/pitch-deck-q1-2026.pdf', file_size: 2048576, mime_type: 'application/pdf', dify_file_id: 'dify_file_001', context: 'Uploaded during onboarding', extracted_text_path: 'uploads/test-user/pitch-deck-q1-2026.txt' },
    { user_id: testUser.id, file_name: 'financial-model.xlsx', file_path: 'uploads/test-user/financial-model.xlsx', file_size: 524288, mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dify_file_id: 'dify_file_002', context: 'Uploaded during onboarding', extracted_text_path: 'uploads/test-user/financial-model.txt' },
  ]);
  if (fileErr) {
    console.error(`Failed to insert file metadata: ${fileErr.message}`);
    process.exit(1);
  }
  console.log('  Inserted 2 file metadata records');

  // Step 7: Generate and insert embeddings
  console.log(`Generating embeddings (${mode} mode)...`);

  const onboardingChunks = chunkConversationMessages(ONBOARDING_MESSAGES, 'onboarding', null);
  const deepDiveChunks = chunkConversationMessages(DEEPDIVE_MESSAGES, 'deepdive', 'product_technology');
  const summaryChunks = chunkSummaryData(ONBOARDING_SUMMARY);

  const allChunks = [
    ...onboardingChunks.map((c) => ({ ...c, source_type: 'conversation', source_id: onboardingConv.id })),
    ...deepDiveChunks.map((c) => ({ ...c, source_type: 'conversation', source_id: deepDiveConv.id })),
    ...summaryChunks.map((c) => ({ ...c, source_type: 'summary', source_id: null })),
  ];

  console.log(`  ${allChunks.length} chunks to embed (${onboardingChunks.length} onboarding + ${deepDiveChunks.length} deep-dive + ${summaryChunks.length} summary)`);

  const texts = allChunks.map((c) => c.content);
  const embeddings = await getEmbeddings(texts);

  const embeddingRows = allChunks.map((chunk, i) => ({
    user_id: testUser.id,
    source_type: chunk.source_type,
    source_id: chunk.source_id,
    chunk_index: chunk.chunk_index,
    content: chunk.content,
    embedding: JSON.stringify(embeddings[i]),
    metadata: chunk.metadata,
  }));

  const { error: embErr } = await supabase.from('document_embeddings').insert(embeddingRows);
  if (embErr) {
    console.error(`Failed to insert embeddings: ${embErr.message}`);
    process.exit(1);
  }
  console.log(`  Inserted ${embeddingRows.length} embeddings`);

  // Step 8: Summary
  console.log('\n--- Seed Complete ---');
  console.log(`User: ${testUser.email}`);
  console.log(`Conversations: 2 (onboarding + deep-dive)`);
  console.log(`Messages: ${msgRows.length + ddMsgRows.length}`);
  console.log(`Summary categories: 10`);
  console.log(`Files: 2`);
  console.log(`Embeddings: ${embeddingRows.length} (${mode})`);
  console.log('');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
