import { verifyWebhook } from '../_webhookAuth.js';
import { getSupabaseAdmin } from '../_supabase.js';
import { buildCategoryContextsFromConfig, CATEGORY_IDS } from '../evaluation/_categoryContext.js';

/**
 * POST /api/knowledge/context
 *
 * Returns assembled per-category context for evaluation.
 * Called by Dify HTTP Request node (fallback when context isn't provided as input)
 * or by our evaluation generate endpoint.
 *
 * Auth: webhook secret (Dify → Vercel)
 *
 * Request body:
 * {
 *   user_id: string (UUID),
 *   knowledge_base_id?: string (defaults to active KB)
 * }
 *
 * Response:
 * {
 *   context_product_technology: "## Onboarding Data\n...\n## Retrieved Context\n...",
 *   context_market_traction: "...",
 *   ...
 * }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = verifyWebhook(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { user_id, knowledge_base_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Fetch onboarding summary for this user
    const { data: summaryRow, error: summaryErr } = await supabase
      .from('onboarding_summaries')
      .select('summary_data')
      .eq('user_id', user_id)
      .single();

    if (summaryErr && summaryErr.code !== 'PGRST116') {
      // PGRST116 = no rows found (acceptable — user may not have completed onboarding)
      return res.status(500).json({ error: `Failed to fetch summary: ${summaryErr.message}` });
    }

    const onboardingSummary = summaryRow?.summary_data || null;

    // Build category contexts (reads search queries from app_config, does KB retrieval)
    let contexts;
    try {
      contexts = await buildCategoryContextsFromConfig(user_id, onboardingSummary, knowledge_base_id);
    } catch (kbErr) {
      // If KB retrieval fails (e.g. OpenAI quota), return onboarding-only context
      console.error('KB retrieval failed in context endpoint, using onboarding fallback:', kbErr.message);
      contexts = buildOnboardingOnlyContexts(onboardingSummary);
    }

    return res.status(200).json(contexts);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to build category contexts' });
  }
}

/**
 * Fallback: build context using only onboarding data (no KB search).
 * Used when embedding generation fails.
 */
function buildOnboardingOnlyContexts(onboardingSummary) {
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
      if (cat.highlights?.length) sections.push(`Highlights:\n${cat.highlights.map((h) => `- ${h}`).join('\n')}`);
      if (cat.gaps?.length) sections.push(`Gaps:\n${cat.gaps.map((g) => `- ${g}`).join('\n')}`);
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
