/**
 * Seed script for populating Supabase with the Lumio AI demo user data.
 *
 * Usage:
 *   node scripts/seed-demo-data.js --fake    # Random embeddings (fast)
 *   node scripts/seed-demo-data.js --real    # Real OpenAI embeddings
 *
 * Requires env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   DEMO_USER_EMAIL, DEMO_USER_PASSWORD
 * For --real mode: also OPENAI_API_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const mode = process.argv.includes('--real') ? 'real' : 'fake';

// ─── Supabase Client ───────────────────────────────────────────

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoEmail = process.env.DEMO_USER_EMAIL;
const demoPassword = process.env.DEMO_USER_PASSWORD;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}
if (!demoEmail || !demoPassword) {
  console.error('Error: DEMO_USER_EMAIL and DEMO_USER_PASSWORD must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Embedding Helpers ─────────────────────────────────────────

function generateFakeEmbedding() {
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
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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
  if (mode === 'real') return generateRealEmbeddings(texts);
  return texts.map(() => generateFakeEmbedding());
}

// ─── Demo Data — Lumio AI ──────────────────────────────────────

const ONBOARDING_MESSAGES = [
  {
    role: 'user',
    content:
      "We're Lumio AI — we build AI-powered project management software for software engineering teams. Think Jira, but actually intelligent: it auto-prioritizes backlogs, surfaces blockers early, and writes release notes from commits.",
  },
  {
    role: 'assistant',
    content:
      "That's a compelling angle — the 'Jira but smarter' space is crowded but the pain is real. What's the core technical differentiation? Is it fine-tuned models, a novel architecture, or something in the integration layer?",
  },
  {
    role: 'user',
    content:
      'We have a fine-tuned transformer model trained on 40M+ anonymized engineering tickets. It understands sprint context better than general LLMs. We also have 12 native integrations (GitHub, Linear, Slack, Jira import, etc.) which gives us richer signal than competitors building on top of generic APIs.',
  },
  {
    role: 'assistant',
    content:
      'Solid moat — proprietary training data and deep integrations are hard to replicate quickly. What does traction look like? MRR, growth rate, retention?',
  },
  {
    role: 'user',
    content:
      "$28K MRR, growing 12% month-over-month for the past 5 months. Net revenue retention is 115% — we're actually expanding revenue within existing accounts. Our ICP is VP of Engineering at companies with 20–100 engineers. Average contract is around $3.5K/year.",
  },
  {
    role: 'assistant',
    content:
      '115% NRR is a strong signal of product-market fit — customers are expanding rather than churning. Tell me about the team and your current financial position.',
  },
  {
    role: 'user',
    content:
      "Team of 10. I'm the CEO, ex-Atlassian PM for 6 years. CTO is ex-Google Brain, built ML infra at scale. We raised $750K pre-seed from angels 8 months ago. Burn is $55K/month, so 14 months runway. Revenue covers about 50% of burn. We're actively looking to raise a $2.5M seed.",
  },
  {
    role: 'assistant',
    content:
      "Strong founding pedigree and the runway gives you room to execute. The combination of your Atlassian product DNA and Google Brain ML expertise is a credible story for investors. Let me compile this into a structured profile — I'll flag where you have strong signals and where investors will push for more detail.",
  },
];

const DEEPDIVE_MESSAGES = [
  {
    role: 'assistant',
    content:
      "Let's go deeper on go-to-market. You mentioned your ICP is VP of Engineering at 20–100 person companies. Walk me through how you're acquiring customers today — what's working and what isn't?",
  },
  {
    role: 'user',
    content:
      "Primarily PLG — we have a free tier that lets teams use the backlog AI features for up to 10 engineers. We also have a developer community (Discord, ~800 members) where we do live demos and content. No dedicated sales reps yet. About 60% of paid conversions come from the free tier, 30% from community, 10% word of mouth from happy customers.",
  },
  {
    role: 'assistant',
    content:
      "That's a healthy PLG motion. The community is a strong signal — it creates word-of-mouth leverage without headcount. Have you tested any outbound or enterprise motions yet? And what does the expansion pattern look like — are teams expanding organically or is it triggered by an event?",
  },
  {
    role: 'user',
    content:
      "No outbound playbook yet — purely bottoms-up. Expansion is almost entirely organic: someone tries it on their team, loves it, and then pushes it to the broader engineering org. We've had 3 expansions from 10 seats to 50+ seats in the last 2 months. The trigger is usually a sprint retrospective where the AI surfaced something the team missed.",
  },
];

const ONBOARDING_SUMMARY = {
  version: '1.0',
  companyName: 'Lumio AI',
  generatedAt: '2026-03-10T10:00:00.000Z',
  overallCompleteness: 60,
  categories: [
    {
      id: 'product_technology',
      title: 'Product & Technology',
      summary:
        'AI-powered project management platform with a fine-tuned transformer model trained on 40M+ engineering tickets. 12 native integrations provide strong data moat.',
      completeness: 82,
      status: 'complete',
      highlights: ['Proprietary model trained on 40M+ anonymized tickets', '12 native integrations (GitHub, Linear, Slack, Jira)', 'Auto-prioritization, blocker detection, and AI release notes'],
      gaps: ['No patents filed', 'Scalability benchmarks not documented'],
      keyMetrics: { modelTrainingData: '40M+ tickets', integrations: '12', stage: 'Production' },
      deepDivePrompt: "Let's dive deeper into your product and technology.",
    },
    {
      id: 'market_traction',
      title: 'Market Traction & Revenue',
      summary: '$28K MRR growing 12% MoM with 115% NRR. Strong PLG motion converting free-tier users.',
      completeness: 75,
      status: 'complete',
      highlights: ['$28K MRR, 12% MoM growth for 5 consecutive months', '115% net revenue retention', '60% of paid conversions from free tier'],
      gaps: ['TAM/SAM sizing not provided', 'Churn rate by cohort not discussed'],
      keyMetrics: { mrr: '$28K', mrrGrowth: '12% MoM', netRetention: '115%', avgContract: '$3.5K/year' },
      deepDivePrompt: "Let's explore your market traction in more detail.",
    },
    {
      id: 'business_model',
      title: 'Business Model & Economics',
      summary: 'Freemium SaaS with seat-based pricing. Free tier (≤10 engineers) drives top of funnel.',
      completeness: 65,
      status: 'needs_attention',
      highlights: ['Freemium → paid conversion at 60% from free tier', 'Seat-based pricing with natural expansion motion', 'Revenue covers ~50% of burn'],
      gaps: ['Gross margin not explicitly stated', 'Pricing tiers above seed round not modeled'],
      keyMetrics: { model: 'Freemium SaaS', avgContract: '$3.5K/year', revenueToBurnRatio: '50%' },
      deepDivePrompt: "Let's examine your business model more closely.",
    },
    {
      id: 'team_organization',
      title: 'Team & Organization',
      summary: 'Experienced founding team with domain-specific pedigree. CEO ex-Atlassian, CTO ex-Google Brain.',
      completeness: 70,
      status: 'complete',
      highlights: ['CEO: 6 years Atlassian PM experience', 'CTO: ML infra at Google Brain scale', 'Team of 10, likely lean across eng/product'],
      gaps: ['No VP Sales or Head of Growth', 'Engineering team composition not detailed'],
      keyMetrics: { teamSize: '10', ceoBackground: 'Atlassian', ctoBackground: 'Google Brain' },
      deepDivePrompt: "Let's discuss your team and organizational structure.",
    },
    {
      id: 'go_to_market',
      title: 'Go-to-Market',
      summary: 'PLG motion via free tier and developer community. No outbound playbook. Organic expansion from 3 accounts in last 2 months.',
      completeness: 58,
      status: 'needs_attention',
      highlights: ['Free tier drives 60% of paid conversions', 'Discord community with 800+ members', '3 organic seat expansions (10→50+) in 2 months'],
      gaps: ['No outbound sales playbook', 'No dedicated sales headcount', 'Enterprise motion not defined'],
      keyMetrics: { primaryMotion: 'PLG', community: '800+ Discord', conversionSource: '60% free tier' },
      deepDivePrompt: "Let's explore your go-to-market strategy.",
    },
    {
      id: 'financial_health',
      title: 'Financial Health',
      summary: '14 months runway at $55K/month burn. Revenue covers 50% of expenses. Actively fundraising.',
      completeness: 62,
      status: 'needs_attention',
      highlights: ['14 months runway', '$55K/month burn rate', 'Revenue covers 50% of operating costs'],
      gaps: ['12-month financial model not provided', 'Unit economics (CAC, LTV) not detailed'],
      keyMetrics: { runway: '14 months', burnRate: '$55K/mo', revenueCoverage: '50%' },
      deepDivePrompt: "Let's look at your financial health in more detail.",
    },
    {
      id: 'fundraising_capital',
      title: 'Fundraising & Capital',
      summary: '$750K pre-seed raised 8 months ago. Targeting $2.5M seed round. No lead investor confirmed.',
      completeness: 55,
      status: 'needs_attention',
      highlights: ['$750K pre-seed from angels (8 months ago)', 'Targeting $2.5M seed round', 'Seed metrics are approaching investable range'],
      gaps: ['No lead investor or term sheet', 'Seed round use of funds not articulated', 'Target valuation not discussed'],
      keyMetrics: { preSeedRaised: '$750K', targetRound: '$2.5M seed', timeToRaise: 'Actively fundraising' },
      deepDivePrompt: "Let's discuss your fundraising strategy.",
    },
    {
      id: 'competitive_position',
      title: 'Competitive Position',
      summary: 'Competing against Jira, Linear, and Asana in a large but crowded market. Differentiation via AI-native design.',
      completeness: 48,
      status: 'incomplete',
      highlights: ['AI-native vs bolt-on approach vs incumbents', 'Proprietary training data as moat', '12 integrations enable data richness'],
      gaps: ['Competitive matrix not provided', 'Win/loss analysis not available', 'Pricing comparison not detailed'],
      keyMetrics: { primaryCompetitors: 'Jira, Linear, Asana', moat: 'Proprietary data + integrations' },
      deepDivePrompt: "Let's analyze your competitive position.",
    },
    {
      id: 'operations',
      title: 'Operations',
      summary: 'Lean team of 10. Engineering-heavy early stage. Operational processes not fully documented.',
      completeness: 42,
      status: 'incomplete',
      highlights: ['Lean org structure appropriate for stage', 'PLG model reduces support overhead', 'Free tier limits support surface area'],
      gaps: ['Customer support SLAs not defined', 'Incident response process unknown', 'Scaling plan beyond 10-person team not discussed'],
      keyMetrics: { teamSize: '10', supportModel: 'Self-serve + community' },
      deepDivePrompt: "Let's look at your operations.",
    },
    {
      id: 'legal_compliance',
      title: 'Legal & Compliance',
      summary: 'Corporate structure established. GDPR and data privacy posture unclear — a risk for EU enterprise customers.',
      completeness: 38,
      status: 'incomplete',
      highlights: ['Company entity established', 'Customer data anonymized for model training'],
      gaps: ['GDPR compliance status unknown', 'Data processing agreements (DPAs) not mentioned', 'IP assignment agreements not confirmed', 'SOC 2 status unknown'],
      keyMetrics: { gdprStatus: 'Unknown', soc2: 'Not mentioned' },
      deepDivePrompt: "Let's explore your legal and compliance readiness.",
    },
  ],
};

const EVALUATION_DATA = {
  maturity_stage: 'validated',
  dimensions: [
    { id: 'product_technology', label: 'Product & Technology', score: 3.8, description: 'Strong technical foundation with proprietary ML model and deep integration network.' },
    { id: 'market_traction', label: 'Market Traction', score: 3.2, description: 'Solid MRR growth and NRR, but TAM/SAM analysis is underdeveloped.' },
    { id: 'business_model', label: 'Business Model', score: 2.8, description: 'Freemium SaaS model is proven but unit economics need more documentation.' },
    { id: 'team_organization', label: 'Team', score: 3.5, description: 'Strong domain-specific founding team, missing go-to-market leadership.' },
    { id: 'go_to_market', label: 'Go-to-Market', score: 2.4, description: 'PLG motion is working, but no outbound playbook or enterprise sales capability.' },
    { id: 'financial_health', label: 'Financial Health', score: 2.6, description: '14 months runway is adequate but burn rate needs reduction or revenue acceleration.' },
    { id: 'fundraising_capital', label: 'Fundraising', score: 2.2, description: 'Pre-seed complete, seed round in progress but no lead investor confirmed yet.' },
    { id: 'competitive_position', label: 'Competitive Position', score: 2.5, description: 'Clear differentiation exists but competitive analysis is not well-documented.' },
    { id: 'operations', label: 'Operations', score: 2.0, description: 'Lean operations appropriate for stage but scaling processes undefined.' },
    { id: 'legal_compliance', label: 'Legal & Compliance', score: 1.5, description: 'GDPR posture and IP assignments are gaps that enterprise customers will flag.' },
  ],
  performance_metrics: {
    overallScore: 2.65,
    topStrengths: ['Proprietary ML model with large training dataset', 'Strong net revenue retention (115%)', 'Experienced founding team with domain expertise'],
    keyRisks: ['GDPR compliance unknown — blocks EU enterprise sales', 'No outbound GTM — limits growth ceiling', 'No lead investor for seed round yet'],
    investorReadiness: 68,
  },
};

const INVESTMENT_DATA = {
  recommended_funding: [
    {
      id: 'pre_seed',
      fit: 'strong_fit',
      readiness_score: 72,
      rationale: 'Lumio AI is well past pre-seed validation criteria: $28K MRR with 12% MoM growth, proprietary technical differentiation, and strong NRR. The $750K already raised at pre-seed validates investor confidence. A bridge or extension is appropriate to reach seed-fundable milestones.',
      improvement_areas: ['Clean up legal/compliance gaps before diligence', 'Document unit economics (CAC, LTV, payback period)'],
    },
    {
      id: 'grant_funding',
      fit: 'acceptable',
      readiness_score: 55,
      rationale: 'AI/ML-focused grants (SBIR, Innovate UK, EU Horizon) are accessible given the research-grade model training approach. Non-dilutive capital could extend runway without equity pressure during the seed raise.',
      improvement_areas: ['Identify specific grant programs aligned to AI for developer productivity', 'Document model training methodology for grant applications'],
    },
  ],
  conditional_options: [
    {
      id: 'seed',
      fit: 'conditional',
      readiness_score: 48,
      rationale: 'Seed round is the right next step but Lumio AI needs 2–3 more months of growth to hit the $60–80K MRR threshold most seed investors expect. Legal cleanup is also a prerequisite.',
      conditions: ['Reach $60–80K MRR before pitching', 'Complete GDPR compliance assessment and DPAs', 'Develop 12-month financial model with clear use of funds'],
      improvement_areas: ['Accelerate revenue growth via outbound pilot', 'Resolve IP assignment agreements'],
    },
  ],
  not_recommended: [
    { id: 'series_a', fit: 'not_recommended', readiness_score: 18, rationale: 'Too early — Series A typically requires $1M+ ARR. Focus on seed round first.' },
    { id: 'venture_debt', fit: 'not_recommended', readiness_score: 22, rationale: 'Venture debt requires existing equity capital or revenue scale not yet reached.' },
    { id: 'revenue_based_financing', fit: 'not_recommended', readiness_score: 30, rationale: 'RBF requires $50K+ MRR and proven unit economics. Revisit after seed round.' },
  ],
  improvement_roadmap: [
    { rank: 1, category_id: 'legal_compliance', current_score: 38, target_score: 65, priority: 'critical', action: 'Complete GDPR compliance assessment, execute DPAs with existing customers, and confirm IP assignment agreements are in place.' },
    { rank: 2, category_id: 'market_traction', current_score: 75, target_score: 85, priority: 'high', action: 'Document TAM/SAM analysis and build out cohort-level retention metrics to strengthen investor narrative.' },
    { rank: 3, category_id: 'financial_health', current_score: 62, target_score: 75, priority: 'high', action: 'Build 18-month financial model with scenario analysis. Define CAC and LTV by customer segment.' },
  ],
  next_steps: [
    { title: 'GDPR compliance audit', description: 'Engage a legal advisor to assess GDPR exposure — especially for EU-based customers and the anonymized training data pipeline.', priority: 'critical', action_key: 'gdpr_audit' },
    { title: 'Build 18-month financial model', description: 'Create bottom-up financial projections with use-of-funds breakdown for the seed round. Include CAC, LTV, and payback period by channel.', priority: 'high', action_key: 'financial_model' },
    { title: 'Prepare seed pitch deck', description: 'Develop investor pitch deck targeting $2.5M seed. Lead with the 115% NRR and proprietary training data moat.', priority: 'high', action_key: 'pitch_deck' },
    { title: 'Define enterprise ICP and outbound pilot', description: 'Formalize the VP Engineering ICP and run a 30-day outbound pilot (50 targeted outreach) to test if PLG can be supplemented with a top-down motion.', priority: 'medium', action_key: 'enterprise_icp' },
    { title: 'Build investor CRM', description: 'Identify 30 seed-stage funds that invest in B2B SaaS + developer tools. Track outreach and follow-ups in a structured pipeline.', priority: 'medium', action_key: 'investor_crm' },
  ],
};

const ACTION_ITEMS = [
  {
    id: randomUUID(),
    title: 'Complete GDPR compliance audit',
    description: 'Engage a legal advisor to assess GDPR exposure for EU customers and the anonymized training data pipeline.',
    priority: 'critical',
    status: 'completed',
    source_type: 'evaluation',
    source_id: null,
    dimension_id: 'legal_compliance',
    action_key: 'gdpr_audit',
  },
  {
    id: randomUUID(),
    title: 'Build 18-month financial model',
    description: 'Create bottom-up financial projections with use-of-funds breakdown. Include CAC, LTV, and payback period.',
    priority: 'high',
    status: 'completed',
    source_type: 'evaluation',
    source_id: null,
    dimension_id: 'financial_health',
    action_key: 'financial_model',
  },
  {
    id: randomUUID(),
    title: 'Prepare seed pitch deck',
    description: 'Develop investor pitch deck targeting $2.5M seed. Lead with 115% NRR and proprietary training data moat.',
    priority: 'high',
    status: 'pending',
    source_type: 'evaluation',
    source_id: null,
    dimension_id: 'fundraising_capital',
    action_key: 'pitch_deck',
  },
  {
    id: randomUUID(),
    title: 'Define enterprise ICP and outbound pilot',
    description: 'Formalize the VP Engineering ICP and run a 30-day outbound pilot targeting 50 accounts.',
    priority: 'medium',
    status: 'pending',
    source_type: 'evaluation',
    source_id: null,
    dimension_id: 'go_to_market',
    action_key: 'enterprise_icp',
  },
  {
    id: randomUUID(),
    title: 'Build investor CRM',
    description: 'Identify 30 seed-stage funds investing in B2B SaaS + developer tools. Track outreach pipeline.',
    priority: 'medium',
    status: 'pending',
    source_type: 'investment',
    source_id: 'investment_matching',
    dimension_id: null,
    action_key: 'investor_crm',
  },
];

// ─── Chunking (mirrors api/_chunking.js logic) ─────────────────

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
  console.log(`\nSeeding Lumio AI demo data (mode: ${mode})...\n`);

  // Step 1: Find or create demo user
  console.log(`Resolving demo user: ${demoEmail}...`);
  const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 100 });
  let demoUser = listData?.users?.find((u) => u.email === demoEmail);

  if (demoUser) {
    console.log(`  Found existing demo user: ${demoUser.id}`);
  } else {
    console.log('  Creating new demo user...');
    const { data: createdData, error: createErr } = await supabase.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true,
    });
    if (createErr) {
      console.error(`Failed to create demo user: ${createErr.message}`);
      process.exit(1);
    }
    demoUser = createdData.user;
    console.log(`  Created demo user: ${demoUser.id}`);
  }

  const userId = demoUser.id;

  // Step 2: Clean up all existing data for demo user
  console.log('Cleaning up existing demo data...');
  const { data: existingConvs } = await supabase.from('conversations').select('id').eq('user_id', userId);
  if (existingConvs?.length) {
    const convIds = existingConvs.map((c) => c.id);
    await supabase.from('messages').delete().in('conversation_id', convIds);
  }
  await supabase.from('document_embeddings').delete().eq('user_id', userId);
  await supabase.from('action_items').delete().eq('user_id', userId);
  await supabase.from('investment_selections').delete().eq('user_id', userId);
  await supabase.from('investment_recommendations').delete().eq('user_id', userId);
  await supabase.from('evaluations').delete().eq('user_id', userId);
  await supabase.from('onboarding_summaries').delete().eq('user_id', userId);
  await supabase.from('conversations').delete().eq('user_id', userId);
  await supabase.from('file_metadata').delete().eq('user_id', userId);
  console.log('  Cleanup complete');

  // Step 3: Insert onboarding conversation + messages
  console.log('Inserting onboarding conversation...');
  const { data: onboardingConv, error: convErr } = await supabase
    .from('conversations')
    .insert({ user_id: userId, workflow: 'onboarding', dify_conversation_id: 'dify_demo_onboarding' })
    .select('id')
    .single();
  if (convErr) {
    console.error(`Failed to insert onboarding conversation: ${convErr.message}`);
    process.exit(1);
  }

  const onboardingMsgRows = ONBOARDING_MESSAGES.map((msg) => ({
    conversation_id: onboardingConv.id,
    user_id: userId,
    role: msg.role,
    content: msg.content,
  }));
  const { error: msgErr } = await supabase.from('messages').insert(onboardingMsgRows);
  if (msgErr) {
    console.error(`Failed to insert onboarding messages: ${msgErr.message}`);
    process.exit(1);
  }
  console.log(`  Inserted ${onboardingMsgRows.length} onboarding messages`);

  // Step 4: Insert go_to_market deep-dive conversation + messages
  console.log('Inserting go-to-market deep-dive conversation...');
  const { data: deepDiveConv, error: ddConvErr } = await supabase
    .from('conversations')
    .insert({ user_id: userId, workflow: 'deepdive', category_id: 'go_to_market', dify_conversation_id: 'dify_demo_deepdive_gtm' })
    .select('id')
    .single();
  if (ddConvErr) {
    console.error(`Failed to insert deep-dive conversation: ${ddConvErr.message}`);
    process.exit(1);
  }

  const deepDiveMsgRows = DEEPDIVE_MESSAGES.map((msg) => ({
    conversation_id: deepDiveConv.id,
    user_id: userId,
    role: msg.role,
    content: msg.content,
  }));
  const { error: ddMsgErr } = await supabase.from('messages').insert(deepDiveMsgRows);
  if (ddMsgErr) {
    console.error(`Failed to insert deep-dive messages: ${ddMsgErr.message}`);
    process.exit(1);
  }
  console.log(`  Inserted ${deepDiveMsgRows.length} go-to-market deep-dive messages`);

  // Step 5: Insert onboarding summary
  console.log('Inserting onboarding summary...');
  const { error: summaryErr } = await supabase
    .from('onboarding_summaries')
    .insert({ user_id: userId, summary_data: ONBOARDING_SUMMARY, onboarding_phase: 'summary' });
  if (summaryErr) {
    console.error(`Failed to insert summary: ${summaryErr.message}`);
    process.exit(1);
  }
  console.log('  Inserted onboarding summary (10 categories, overallCompleteness: 60)');

  // Step 6: Insert evaluation
  console.log('Inserting evaluation...');
  const { error: evalErr } = await supabase.from('evaluations').insert({
    user_id: userId,
    maturity_stage: EVALUATION_DATA.maturity_stage,
    dimensions: EVALUATION_DATA.dimensions,
    performance_metrics: EVALUATION_DATA.performance_metrics,
    investment_data: INVESTMENT_DATA,
  });
  if (evalErr) {
    console.error(`Failed to insert evaluation: ${evalErr.message}`);
    process.exit(1);
  }
  console.log('  Inserted evaluation (maturity: validated, score: 2.65/5)');

  // Step 7: Insert investment selections
  console.log('Inserting investment selections...');
  const { error: invSelErr } = await supabase
    .from('investment_selections')
    .insert({ user_id: userId, investment_type: 'pre_seed', selected: true });
  if (invSelErr) {
    console.error(`Failed to insert investment selection: ${invSelErr.message}`);
    process.exit(1);
  }
  console.log('  Inserted investment selection (pre_seed = true)');

  // Step 8: Insert action items
  console.log('Inserting action items...');
  const actionItemRows = ACTION_ITEMS.map((item) => ({
    id: item.id,
    user_id: userId,
    title: item.title,
    description: item.description,
    priority: item.priority,
    status: item.status,
    source_type: item.source_type,
    source_id: item.source_id,
    dimension_id: item.dimension_id,
    action_key: item.action_key,
    file_ids: [],
    custom_data: {},
  }));
  const { error: actionErr } = await supabase.from('action_items').insert(actionItemRows);
  if (actionErr) {
    console.error(`Failed to insert action items: ${actionErr.message}`);
    process.exit(1);
  }
  const completed = ACTION_ITEMS.filter((a) => a.status === 'completed').length;
  const pending = ACTION_ITEMS.filter((a) => a.status === 'pending').length;
  console.log(`  Inserted ${ACTION_ITEMS.length} action items (${completed} completed, ${pending} pending)`);

  // Step 9: Generate and insert embeddings
  console.log(`\nGenerating embeddings (${mode} mode)...`);

  const onboardingChunks = chunkConversationMessages(ONBOARDING_MESSAGES, 'onboarding', null);
  const deepDiveChunks = chunkConversationMessages(DEEPDIVE_MESSAGES, 'deepdive', 'go_to_market');
  const summaryChunks = chunkSummaryData(ONBOARDING_SUMMARY);

  const allChunks = [
    ...onboardingChunks.map((c) => ({ ...c, source_type: 'conversation', source_id: onboardingConv.id })),
    ...deepDiveChunks.map((c) => ({ ...c, source_type: 'conversation', source_id: deepDiveConv.id })),
    ...summaryChunks.map((c) => ({ ...c, source_type: 'summary', source_id: null })),
  ];

  console.log(
    `  ${allChunks.length} chunks to embed (${onboardingChunks.length} onboarding + ${deepDiveChunks.length} deep-dive + ${summaryChunks.length} summary)`,
  );

  const texts = allChunks.map((c) => c.content);
  const embeddings = await getEmbeddings(texts);

  const embeddingRows = allChunks.map((chunk, i) => ({
    user_id: userId,
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

  // Step 10: Summary
  console.log('\n--- Demo Seed Complete ---');
  console.log(`User: ${demoEmail} (${userId})`);
  console.log(`Conversations: 2 (onboarding + go_to_market deep-dive)`);
  console.log(`Messages: ${onboardingMsgRows.length + deepDiveMsgRows.length}`);
  console.log(`Summary: 10 categories (overallCompleteness: 60)`);
  console.log(`Evaluation: validated stage, score 2.65/5`);
  console.log(`Investment selections: pre_seed`);
  console.log(`Action items: ${completed} completed, ${pending} pending`);
  console.log(`Embeddings: ${embeddingRows.length} (${mode})`);
  console.log('');
}

seed().catch((err) => {
  console.error('Demo seed failed:', err);
  process.exit(1);
});
