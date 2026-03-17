import { verifyWebhook } from '../_webhookAuth.js';
import { getSupabaseAdmin } from '../_supabase.js';
import { generateEmbedding } from './_embeddings.js';
import { semanticSearch } from './_knowledgeBase.js';

/**
 * GET/POST /api/knowledge/context
 *
 * Returns assembled context for evaluation categories.
 * Called by Dify HTTP Request nodes (one call per category).
 *
 * Auth: webhook secret via X-Webhook-Secret header or ?secret= query param
 *
 * POST body (JSON):
 * {
 *   "user_id": "UUID",                    // Required
 *   "category_id": "product_technology",   // Optional — if set, returns only this category
 *   "query": "search terms for vector DB", // Optional — triggers vector search
 *   "top_k": 5,                            // Optional — number of chunks to retrieve (default: 5)
 *   "threshold": 0.5,                      // Optional — min similarity score 0-1 (default: 0.5)
 *   "source_types": ["conversation","file","summary"]  // Optional — filter by source type
 * }
 *
 * Response (single category):
 * { "context": "## Onboarding Data\n...\n## Retrieved Context\n..." }
 *
 * Response (all categories, no category_id):
 * { "context_product_technology": "...", "context_market_traction": "...", ... }
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

  // Parse params
  let params;
  if (req.method === 'GET') {
    params = {
      user_id: req.query?.user_id,
      category_id: req.query?.category_id,
      query: req.query?.query,
      top_k: req.query?.top_k ? parseInt(req.query.top_k, 10) : undefined,
      threshold: req.query?.threshold ? parseFloat(req.query.threshold) : undefined,
      source_types: req.query?.source_types?.split(','),
    };
  } else {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_e) { body = {}; }
    }
    params = {
      user_id: body?.user_id || req.query?.user_id,
      category_id: body?.category_id,
      query: body?.query,
      top_k: body?.top_k,
      threshold: body?.threshold,
      source_types: body?.source_types,
    };
  }

  const { user_id, category_id, query, top_k = 5, threshold = 0.5, source_types } = params;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
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

    // Single category mode (Dify calls once per category)
    if (category_id) {
      const context = await buildSingleContext(category_id, onboardingSummary, query, user_id, top_k, threshold, source_types);
      return res.status(200).json({ context });
    }

    // All categories mode (backward compatible)
    const contexts = buildAllContexts(onboardingSummary);
    return res.status(200).json(contexts);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to build context' });
  }
}

/**
 * Build context for a single category.
 * If query is provided, does vector search and appends KB results.
 */
async function buildSingleContext(categoryId, onboardingSummary, query, userId, topK, threshold, sourceTypes) {
  const sections = [];

  // Section 1: Onboarding data
  const cat = onboardingSummary?.categories?.find((c) => c.id === categoryId);
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

  // Section 2: Vector search results (if query provided)
  if (query) {
    try {
      const embedding = await generateEmbedding(query);
      const results = await semanticSearch(
        embedding,
        { topK, threshold, userId, sourceTypes: sourceTypes || null },
      );

      if (results.length > 0) {
        sections.push('\n## Retrieved Context');
        results.forEach((result, idx) => {
          const source = result.source_type || 'unknown';
          sections.push(`[Source ${idx + 1} — ${source}, relevance: ${(result.score * 100).toFixed(0)}%]`);
          sections.push(result.content);
          if (idx < results.length - 1) sections.push('---');
        });
      } else {
        sections.push('\n## Retrieved Context');
        sections.push('No relevant documents found for this query.');
      }
    } catch (err) {
      sections.push(`\n## Retrieved Context\nVector search failed: ${err.message}`);
    }
  }

  return sections.join('\n');
}

/**
 * Build context for all categories (onboarding data only, no vector search).
 */
function buildAllContexts(onboardingSummary) {
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
