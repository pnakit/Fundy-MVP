/**
 * Category context builder for evaluation.
 * Assembles per-category context from onboarding data + semantic search results.
 * Each context becomes a Dify workflow input variable.
 */

import { generateEmbeddings } from '../knowledge/embeddings.js';
import { semanticSearch } from '../knowledge/knowledgeBase.js';

/**
 * The 10 evaluation dimensions and their search query templates.
 * Each template combines category keywords with relevant onboarding data.
 */
const CATEGORY_QUERIES = {
  product_technology: (cat) =>
    `product technology features capabilities technical architecture ${cat?.highlights?.join(' ') || ''}`,
  market_traction: (cat) =>
    `market traction revenue growth customers metrics ${cat?.keyMetrics?.mrr || ''} ${cat?.keyMetrics?.mrrGrowth || ''}`,
  business_model: (cat) =>
    `business model economics pricing unit economics margins ${cat?.keyMetrics?.grossMargin || ''}`,
  team_organization: (cat) =>
    `team organization founders leadership hiring ${cat?.keyMetrics?.teamSize || ''}`,
  go_to_market: (cat) =>
    `go to market strategy sales channels distribution ${cat?.keyMetrics?.primaryMotion || ''}`,
  financial_health: (cat) =>
    `financial health runway burn rate revenue expenses ${cat?.keyMetrics?.burnRate || ''}`,
  fundraising_capital: (cat) =>
    `fundraising capital investment rounds valuation ${cat?.keyMetrics?.lastRound || ''}`,
  competitive_position: (cat) =>
    `competitive position moat differentiation competitors ${cat?.keyMetrics?.primaryDifferentiator || ''}`,
  operations: (cat) =>
    `operations processes infrastructure scalability ${cat?.keyMetrics?.uptime || ''}`,
  legal_compliance: (cat) =>
    `legal compliance regulatory IP patents GDPR ${cat?.keyMetrics?.entityType || ''}`,
};

const CATEGORY_IDS = Object.keys(CATEGORY_QUERIES);

/**
 * Build context for all 10 evaluation categories.
 *
 * @param {string} userId - Supabase user ID
 * @param {object} onboardingSummary - The onboarding summary data (with categories array)
 * @param {string} [kbId] - Knowledge base ID (defaults to active KB)
 * @returns {Promise<Record<string, string>>} Map of context_<category_id> → assembled context text
 */
export async function buildCategoryContexts(userId, onboardingSummary, kbId) {
  const categoriesMap = {};
  if (onboardingSummary?.categories) {
    for (const cat of onboardingSummary.categories) {
      categoriesMap[cat.id] = cat;
    }
  }

  // Step 1: Build search queries for each category
  const queries = CATEGORY_IDS.map((id) => {
    const queryFn = CATEGORY_QUERIES[id];
    const cat = categoriesMap[id];
    return queryFn(cat).replace(/\s+/g, ' ').trim();
  });

  // Step 2: Batch generate embeddings for all 10 queries
  const embeddings = await generateEmbeddings(queries);

  // Step 3: Execute 10 parallel KB searches
  const searchPromises = embeddings.map((embedding, i) =>
    semanticSearch(
      embedding,
      { topK: 5, threshold: 0.5, userId },
      kbId,
    ).catch((err) => {
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

/**
 * Get the list of category IDs used in evaluation.
 */
export { CATEGORY_IDS };
