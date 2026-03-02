import { verifyWebhook } from '../_webhookAuth.js';
import { getSupabaseAdmin } from '../_supabase.js';

/**
 * GET/POST /api/knowledge/context
 *
 * Returns assembled per-category context for evaluation.
 * Called by Dify HTTP Request node.
 *
 * Auth: webhook secret via X-Webhook-Secret header
 *
 * GET:  /api/knowledge/context?user_id=UUID&secret=WEBHOOK_SECRET
 * POST: /api/knowledge/context  { user_id: "UUID" }
 *
 * The GET variant also accepts the secret as a query param for simpler Dify config.
 */

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

export default async function handler(req, res) {
  // Accept both GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: check header first, then query param fallback
  const secretFromQuery = req.query?.secret;
  if (secretFromQuery) {
    req.headers = req.headers || {};
    req.headers['x-webhook-secret'] = secretFromQuery;
  }

  const auth = verifyWebhook(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  // Get user_id from query params (GET) or body (POST)
  let user_id;
  if (req.method === 'GET') {
    user_id = req.query?.user_id;
  } else {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_e) { body = {}; }
    }
    user_id = body?.user_id || req.query?.user_id;
  }

  if (!user_id) {
    return res.status(400).json({
      error: 'user_id is required',
      usage: 'GET /api/knowledge/context?user_id=UUID&secret=WEBHOOK_SECRET',
    });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: summaryRow, error: summaryErr } = await supabase
      .from('onboarding_summaries')
      .select('summary_data')
      .eq('user_id', user_id)
      .single();

    if (summaryErr && summaryErr.code !== 'PGRST116') {
      return res.status(500).json({ error: `Failed to fetch summary: ${summaryErr.message}` });
    }

    const onboardingSummary = summaryRow?.summary_data || null;
    const contexts = buildContexts(onboardingSummary);

    return res.status(200).json(contexts);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to build category contexts' });
  }
}

function buildContexts(onboardingSummary) {
  const categoriesMap = {};
  if (onboardingSummary?.categories) {
    for (const cat of onboardingSummary.categories) {
      categoriesMap[cat.id] = cat;
    }
  }

  const contexts = {};
  for (const categoryId of CATEGORY_IDS) {
    const cat = categoriesMap[categoryId];
    const sections = ['## Onboarding Data'];
    if (cat) {
      sections.push(`Summary: ${cat.summary}`);
      sections.push(`Completeness: ${cat.completeness}%`);
      if (cat.highlights?.length) {
        sections.push(`Highlights:\n${cat.highlights.map((h) => `- ${h}`).join('\n')}`);
      }
      if (cat.gaps?.length) {
        sections.push(`Gaps:\n${cat.gaps.map((g) => `- ${g}`).join('\n')}`);
      }
      if (cat.keyMetrics && Object.keys(cat.keyMetrics).length > 0) {
        sections.push(
          `Key Metrics:\n${Object.entries(cat.keyMetrics)
            .map(([k, v]) => `- ${k}: ${v}`)
            .join('\n')}`,
        );
      }
    } else {
      sections.push('No onboarding data available for this category.');
    }
    contexts[`context_${categoryId}`] = sections.join('\n');
  }

  return contexts;
}
