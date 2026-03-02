import { verifyWebhook } from '../_webhookAuth.js';
import { getSupabaseAdmin } from '../_supabase.js';
import { generateEmbeddings } from './embeddings.js';
import { semanticSearch } from './knowledgeBase.js';

/**
 * GET/POST /api/knowledge/context
 *
 * Returns assembled per-category context for evaluation.
 * Called by Dify HTTP Request node or by our evaluation endpoint.
 *
 * Auth: webhook secret via X-Webhook-Secret header or ?secret= query param
 *
 * POST body (JSON):
 * {
 *   "user_id": "UUID",
 *   "queries": {                          // Optional — Dify controls what to search for
 *     "product_technology": "working product MVP demo technical architecture",
 *     "market_traction": "revenue MRR growth customers retention",
 *     ...
 *   }
 * }
 *
 * If queries are provided: generates embeddings → searches pgvector → returns KB results + onboarding data
 * If queries are omitted: returns onboarding data only (no vector search)
 *
 * This means:
 * - Dify controls the search terms (editable in Dify Studio, no code deploy)
 * - Different workflows can send different queries to the same endpoint
 * - Falls back gracefully if embeddings fail (returns onboarding-only context)
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

  // Parse params from query (GET) or body (POST)
  let user_id;
  let queries;
  if (req.method === 'GET') {
    user_id = req.query?.user_id;
  } else {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_e) { body = {}; }
    }
    user_id = body?.user_id || req.query?.user_id;
    queries = body?.queries;
  }

  if (!user_id) {
    return res.status(400).json({
      error: 'user_id is required',
      usage: 'POST with { "user_id": "UUID", "queries": { "category_id": "search terms" } }',
    });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Fetch onboarding summary
    const { data: summaryRow, error: summaryErr } = await supabase
      .from('onboarding_summaries')
      .select('summary_data')
      .eq('user_id', user_id)
      .single();

    if (summaryErr && summaryErr.code !== 'PGRST116') {
      return res.status(500).json({ error: `Failed to fetch summary: ${summaryErr.message}` });
    }

    const onboardingSummary = summaryRow?.summary_data || null;

    // If Dify sent queries, do vector search; otherwise return onboarding-only
    let kbResults = {};
    if (queries && typeof queries === 'object' && Object.keys(queries).length > 0) {
      kbResults = await searchKnowledgeBase(queries, user_id);
    }

    const contexts = buildContexts(onboardingSummary, kbResults);

    return res.status(200).json(contexts);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to build category contexts' });
  }
}

/**
 * Search the knowledge base using queries provided by Dify.
 * Returns { category_id: [results] } for each query that was provided.
 */
async function searchKnowledgeBase(queries, userId) {
  const categoryIds = Object.keys(queries);
  const queryTexts = categoryIds.map((id) => queries[id]);

  let embeddings;
  try {
    embeddings = await generateEmbeddings(queryTexts);
  } catch (err) {
    console.error('Embedding generation failed, skipping KB search:', err.message);
    return {};
  }

  const results = {};
  const searchPromises = embeddings.map((embedding, i) =>
    semanticSearch(embedding, { topK: 5, threshold: 0.5, userId }).catch((err) => {
      console.error(`KB search failed for ${categoryIds[i]}: ${err.message}`);
      return [];
    }),
  );

  const searchResults = await Promise.all(searchPromises);
  for (let i = 0; i < categoryIds.length; i++) {
    results[categoryIds[i]] = searchResults[i];
  }

  return results;
}

/**
 * Build per-category context combining onboarding data + KB search results.
 */
function buildContexts(onboardingSummary, kbResults) {
  const categoriesMap = {};
  if (onboardingSummary?.categories) {
    for (const cat of onboardingSummary.categories) {
      categoriesMap[cat.id] = cat;
    }
  }

  const contexts = {};
  for (const categoryId of CATEGORY_IDS) {
    const cat = categoriesMap[categoryId];
    const sections = [];

    // Section 1: Onboarding data
    sections.push('## Onboarding Data');
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

    // Section 2: KB search results (if queries were provided and returned results)
    const categoryResults = kbResults[categoryId];
    if (categoryResults && categoryResults.length > 0) {
      sections.push('\n## Retrieved Context');
      categoryResults.forEach((result, idx) => {
        const source = result.source_type || 'unknown';
        sections.push(`[Source ${idx + 1} — ${source}, relevance: ${(result.score * 100).toFixed(0)}%]`);
        sections.push(result.content);
        if (idx < categoryResults.length - 1) sections.push('---');
      });
    }

    contexts[`context_${categoryId}`] = sections.join('\n');
  }

  return contexts;
}
