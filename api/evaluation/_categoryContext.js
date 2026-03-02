/**
 * Category context builder for evaluation.
 * Assembles per-category context from onboarding data + semantic search results.
 * Each context becomes a Dify workflow input variable.
 *
 * Search queries can come from:
 * 1. app_config table in Supabase (single source of truth, editable without deploy)
 * 2. Hardcoded defaults (fallback if app_config not populated)
 */

import { generateEmbeddings } from '../knowledge/embeddings.js';
import { semanticSearch } from '../knowledge/knowledgeBase.js';
import { getSupabaseAdmin } from '../_supabase.js';

/**
 * Default search query templates per category.
 * Used as fallback if app_config doesn't have evaluation_search_queries.
 */
const DEFAULT_SEARCH_QUERIES = {
  product_technology: [
    'working product demo prototype MVP functional',
    'technical architecture system design stack infrastructure',
    'product market fit Sean Ellis organic growth retention',
    'scalability load testing performance under load',
    'intellectual property patents trade secrets IP filings',
  ],
  market_traction: [
    'revenue MRR ARR growth rate month over month',
    'customer acquisition cost CAC payback period',
    'total addressable market TAM SAM SOM market size',
    'net revenue retention expansion churn rate',
    'customer count growth active users paying customers',
  ],
  business_model: [
    'pricing model subscription tiers freemium enterprise',
    'unit economics LTV CAC ratio gross margin',
    'revenue streams monetization business model canvas',
    'customer lifetime value retention cohort analysis',
    'gross margins cost structure contribution margin',
  ],
  team_organization: [
    'founding team background experience domain expertise',
    'team size headcount organizational structure',
    'key hires VP engineering sales marketing roles',
    'advisory board mentors investors advisors',
    'culture values retention employee satisfaction',
  ],
  go_to_market: [
    'sales channels distribution strategy go to market',
    'customer acquisition channels marketing funnel',
    'product led growth PLG self serve conversion',
    'enterprise sales playbook pipeline deal cycle',
    'partnerships channel strategy reseller distributor',
  ],
  financial_health: [
    'runway months cash burn rate monthly expenses',
    'revenue vs expenses break even path profitability',
    'financial projections forecast model assumptions',
    'cash flow working capital liquidity position',
    'cost reduction efficiency operational leverage',
  ],
  fundraising_capital: [
    'funding rounds raised seed series investment history',
    'valuation cap table dilution ownership structure',
    'investor pipeline warm introductions term sheets',
    'use of funds allocation deployment strategy',
    'fundraising timeline next round target amount',
  ],
  competitive_position: [
    'competitive advantage moat differentiation unique value',
    'competitor analysis market landscape alternatives',
    'barriers to entry switching costs network effects',
    'market share positioning category leadership',
    'competitive matrix feature comparison benchmarks',
  ],
  operations: [
    'operational processes workflows automation efficiency',
    'infrastructure uptime SLA reliability monitoring',
    'customer support scaling help desk response time',
    'vendor management procurement supply chain',
    'disaster recovery business continuity compliance',
  ],
  legal_compliance: [
    'corporate structure entity type incorporation jurisdiction',
    'intellectual property IP assignments contractor agreements',
    'regulatory compliance GDPR data privacy requirements',
    'employment law contracts equity vesting agreements',
    'insurance liability coverage risk management',
  ],
};

const CATEGORY_IDS = Object.keys(DEFAULT_SEARCH_QUERIES);

/**
 * Fetch search queries from app_config, falling back to defaults.
 */
async function getSearchQueries() {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'evaluation_search_queries')
      .single();

    if (data?.value) {
      return data.value;
    }
  } catch (_err) {
    // Fall through to defaults
  }
  return DEFAULT_SEARCH_QUERIES;
}

/**
 * Build context for all 10 evaluation categories.
 * Uses hardcoded query templates that incorporate onboarding data.
 *
 * @param {string} userId - Supabase user ID
 * @param {object} onboardingSummary - The onboarding summary data (with categories array)
 * @param {string} [kbId] - Knowledge base ID (defaults to active KB)
 * @returns {Promise<Record<string, string>>} Map of context_<category_id> → assembled context text
 */
export async function buildCategoryContexts(userId, onboardingSummary, kbId) {
  const searchQueries = await getSearchQueries();
  return buildContextsWithQueries(userId, onboardingSummary, searchQueries, kbId);
}

/**
 * Build context using search queries from app_config.
 * Called by the /api/knowledge/context endpoint (Dify HTTP fallback).
 */
export async function buildCategoryContextsFromConfig(userId, onboardingSummary, kbId) {
  const searchQueries = await getSearchQueries();
  return buildContextsWithQueries(userId, onboardingSummary, searchQueries, kbId);
}

/**
 * Core context builder — takes search queries and builds per-category context.
 */
async function buildContextsWithQueries(userId, onboardingSummary, searchQueries, kbId) {
  const categoriesMap = {};
  if (onboardingSummary?.categories) {
    for (const cat of onboardingSummary.categories) {
      categoriesMap[cat.id] = cat;
    }
  }

  // Step 1: Build one combined search query per category
  const queries = CATEGORY_IDS.map((id) => {
    const categoryQueries = searchQueries[id] || DEFAULT_SEARCH_QUERIES[id] || [];
    const onboardingCat = categoriesMap[id];

    // Combine the stored search queries with onboarding highlights for better retrieval
    const queryParts = [...categoryQueries];
    if (onboardingCat?.highlights) {
      queryParts.push(...onboardingCat.highlights);
    }

    return queryParts.join(' ').replace(/\s+/g, ' ').trim();
  });

  // Step 2: Batch generate embeddings for all 10 queries
  const embeddings = await generateEmbeddings(queries);

  // Step 3: Execute 10 parallel KB searches
  const searchPromises = embeddings.map((embedding, i) =>
    semanticSearch(embedding, { topK: 5, threshold: 0.5, userId }, kbId).catch((err) => {
      console.error(`KB search failed for ${CATEGORY_IDS[i]}: ${err.message}`);
      return [];
    }),
  );

  const searchResults = await Promise.all(searchPromises);

  // Step 4: Assemble context for each category
  const contexts = {};
  for (let i = 0; i < CATEGORY_IDS.length; i++) {
    const categoryId = CATEGORY_IDS[i];
    const cat = categoriesMap[categoryId];
    const results = searchResults[i];

    contexts[`context_${categoryId}`] = assembleContext(categoryId, cat, results);
  }

  return contexts;
}

/**
 * Assemble the context text for a single category.
 * Combines onboarding data with retrieved knowledge base chunks.
 */
function assembleContext(categoryId, onboardingCategory, kbResults) {
  const sections = [];

  // Section 1: Onboarding data
  if (onboardingCategory) {
    sections.push('## Onboarding Data');
    sections.push(`Summary: ${onboardingCategory.summary}`);
    sections.push(`Completeness: ${onboardingCategory.completeness}%`);

    if (onboardingCategory.highlights?.length) {
      sections.push(`Highlights:\n${onboardingCategory.highlights.map((h) => `- ${h}`).join('\n')}`);
    }
    if (onboardingCategory.gaps?.length) {
      sections.push(`Gaps:\n${onboardingCategory.gaps.map((g) => `- ${g}`).join('\n')}`);
    }
    if (onboardingCategory.keyMetrics && Object.keys(onboardingCategory.keyMetrics).length > 0) {
      const metrics = Object.entries(onboardingCategory.keyMetrics)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n');
      sections.push(`Key Metrics:\n${metrics}`);
    }
  } else {
    sections.push('## Onboarding Data');
    sections.push('No onboarding data available for this category.');
  }

  // Section 2: Retrieved knowledge base chunks
  if (kbResults.length > 0) {
    sections.push('\n## Retrieved Context');
    kbResults.forEach((result, idx) => {
      const source = result.source_type || 'unknown';
      sections.push(`[Source ${idx + 1} — ${source}, relevance: ${(result.score * 100).toFixed(0)}%]`);
      sections.push(result.content);
      if (idx < kbResults.length - 1) sections.push('---');
    });
  }

  return sections.join('\n');
}

export { CATEGORY_IDS };
