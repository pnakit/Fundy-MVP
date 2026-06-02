import { supabase } from './supabaseClient';
import { MOCK_INVESTMENT_DATA } from '../data/mockData';

/**
 * Get the current JWT for authenticated API calls.
 */
async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Parse a single SSE line. Returns parsed JSON or null.
 */
function parseSSELine(line) {
  if (!line.startsWith('data: ')) return null;
  const jsonStr = line.slice(6).trim();
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr);
  } catch (_e) {
    return null;
  }
}

const CATEGORY_TITLES = {
  product_technology: 'Product & Technology',
  market_traction: 'Market Traction & Revenue',
  business_model: 'Business Model & Economics',
  team_organization: 'Team & Organization',
  go_to_market: 'Go-to-Market',
  financial_health: 'Financial Health',
  fundraising_capital: 'Fundraising & Capital',
  competitive_position: 'Competitive Position',
  operations: 'Operations',
  legal_compliance: 'Legal & Compliance',
};

/**
 * Check if we should use client-side mock mode.
 * Supports both new VITE_LLM_MOCK and legacy VITE_DIFY_MOCK.
 */
function shouldUseMock() {
  return import.meta.env.VITE_LLM_MOCK === 'true' || import.meta.env.VITE_DIFY_MOCK === 'true';
}

/**
 * Generate an evaluation by calling the streaming evaluation endpoint,
 * or run a client-side mock if VITE_DIFY_MOCK is true (for dev without Vercel).
 *
 * @param {string} companyName - Company name
 * @param {object} onboardingSummary - Onboarding summary with categories
 * @param {object} callbacks
 * @param {function} callbacks.onCategoryStarted - (categoryId) => void
 * @param {function} callbacks.onCategoryComplete - (categoryData) => void
 * @param {function} [callbacks.onInvestmentMatchingStarted] - () => void
 * @param {function} [callbacks.onMaturityCalculated] - (data) => void
 * @param {function} [callbacks.onInvestmentRecommendationsComplete] - (data) => void
 * @param {function} callbacks.onError - (error) => void
 * @param {function} callbacks.onStatus - (message) => void
 * @param {function} [callbacks.onDebugLog] - (label, detail) => void — optional debug hook
 * @param {string} [knowledgeBaseId] - Optional KB override
 * @returns {Promise<{success: boolean, metadata?: object}>}
 */
export async function generateEvaluation(companyName, onboardingSummary, callbacks, knowledgeBaseId) {
  if (shouldUseMock()) {
    return generateEvaluationMock(onboardingSummary, callbacks);
  }

  return generateEvaluationReal(companyName, onboardingSummary, callbacks, knowledgeBaseId);
}

/**
 * Client-side mock: simulates streaming evaluation from onboarding summary.
 * Used when VITE_DIFY_MOCK=true (dev mode without Vercel serverless).
 */
async function generateEvaluationMock(onboardingSummary, callbacks) {
  const {
    onCategoryStarted,
    onCategoryComplete,
    onInvestmentMatchingStarted,
    onMaturityCalculated,
    onInvestmentRecommendationsComplete,
    onStatus,
  } = callbacks;

  if (onStatus) onStatus('Mock mode — generating evaluation from onboarding data...');

  const categoriesMap = {};
  if (onboardingSummary?.categories) {
    for (const cat of onboardingSummary.categories) {
      categoriesMap[cat.id] = cat;
    }
  }

  for (const categoryId of Object.keys(CATEGORY_TITLES)) {
    if (onCategoryStarted) onCategoryStarted(categoryId);

    // Simulated delay (300-800ms per category)
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500));

    const cat = categoriesMap[categoryId];
    const completeness = cat?.completeness ?? Math.floor(Math.random() * 60 + 20);
    const status = completeness >= 70 ? 'proven' : completeness >= 40 ? 'partial' : 'unproven';

    if (onCategoryComplete) {
      onCategoryComplete({
        category_id: categoryId,
        category_title: CATEGORY_TITLES[categoryId],
        summary: cat?.summary || `Mock evaluation for ${CATEGORY_TITLES[categoryId]}.`,
        completeness,
        status,
        highlights: cat?.highlights || [],
        gaps: cat?.gaps || [],
        keyMetrics: cat?.keyMetrics || {},
        deepDivePrompt: cat?.deepDivePrompt || `Let's explore ${CATEGORY_TITLES[categoryId]} further.`,
      });
    }
  }

  // Phase 2: mock investment matching
  if (onInvestmentMatchingStarted) onInvestmentMatchingStarted();
  await new Promise((resolve) => setTimeout(resolve, 800));

  if (onMaturityCalculated) {
    onMaturityCalculated({
      maturity_score: 320,
      maturity_stage: 'early_traction',
      maturity_label: 'Early Traction (201-400)',
      performance_level: 'average',
      performance_label: 'Average',
      overall_completeness: 55,
    });
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (onInvestmentRecommendationsComplete) {
    onInvestmentRecommendationsComplete(MOCK_INVESTMENT_DATA);
  }

  return { success: true, metadata: { total_tokens: 0, elapsed_time: 0, mock: true } };
}

/**
 * Real mode: calls the serverless evaluation endpoint with SSE streaming.
 */
async function generateEvaluationReal(companyName, onboardingSummary, callbacks, knowledgeBaseId) {
  const {
    onCategoryStarted,
    onCategoryComplete,
    onInvestmentMatchingStarted,
    onMaturityCalculated,
    onInvestmentRecommendationsComplete,
    onError,
    onStatus,
    onDebugLog,
  } = callbacks;

  const authHeaders = await getAuthHeaders();

  onDebugLog?.('CONNECT', 'POST /api/evaluation/generate');

  let response;
  try {
    response = await fetch('/api/evaluation/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        companyName,
        onboardingSummary,
        knowledgeBaseId: knowledgeBaseId || undefined,
      }),
    });
  } catch (fetchErr) {
    if (onError) onError(`Network error: ${fetchErr.message}`);
    return { success: false };
  }

  if (!response.ok) {
    // If endpoint doesn't exist (dev mode without Vercel), fall back to client mock
    if (response.status === 404) {
      if (onStatus) onStatus('Evaluation endpoint not available — using client mock...');
      return generateEvaluationMock(onboardingSummary, callbacks);
    }

    const errorText = await response.text();
    let errorMessage;
    try {
      errorMessage = JSON.parse(errorText).error;
    } catch (_e) {
      errorMessage = errorText;
    }
    if (onError) onError(errorMessage || `Request failed (${response.status})`);
    return { success: false };
  }

  // Parse Phase 1 SSE stream — collect category results for Phase 2
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let metadata = null;
  const collectedCategories = {};
  let investmentReceivedInPhase1 = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const event = parseSSELine(line);
        if (!event) continue;

        switch (event.type) {
          case 'category_started':
            onDebugLog?.('CAT↑', event.category_id);
            if (onCategoryStarted) onCategoryStarted(event.category_id);
            break;

          case 'category_complete':
            onDebugLog?.('CAT✓', `${event.data?.category_id} score=${event.data?.completeness}`);
            if (event.data?.category_id) {
              collectedCategories[`eval_${event.data.category_id}`] = {
                category_id: event.data.category_id,
                completeness: event.data.completeness,
                status: event.data.status,
                highlights: event.data.highlights || [],
                gaps: event.data.gaps || [],
                summary: event.data.summary || '',
              };
            }
            if (onCategoryComplete) onCategoryComplete(event.data);
            break;

          case 'investment_matching_started':
            onDebugLog?.('INVEST↑', 'Phase 2 started (inline)');
            if (onInvestmentMatchingStarted) onInvestmentMatchingStarted();
            break;

          case 'maturity_calculated':
            onDebugLog?.('MATURE', `stage=${event.data?.maturity_stage ?? event.data?.name} score=${event.data?.maturity_score ?? event.data?.score}`);
            if (onMaturityCalculated) onMaturityCalculated(event.data);
            break;

          case 'investment_recommendations_complete':
            onDebugLog?.('INVEST✓', `keys=${Object.keys(event.data || {}).join(',')}`);
            investmentReceivedInPhase1 = true;
            if (onInvestmentRecommendationsComplete) onInvestmentRecommendationsComplete(event.data);
            break;

          case 'workflow_complete':
            metadata = event.metadata;
            onDebugLog?.('DONE', `tokens=${event.metadata?.total_tokens} elapsed=${event.metadata?.elapsed_time}s`);
            break;

          case 'status':
            if (onStatus) onStatus(event.message);
            break;

          case 'error':
            onDebugLog?.('ERROR', event.message);
            if (onError) onError(event.message, event.category_id);
            break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Phase 2: investment matching — only needed when generate.js didn't handle it inline
  // (i.e. when using the legacy Dify path which does investment matching in a separate workflow)
  if (!investmentReceivedInPhase1 && Object.keys(collectedCategories).length > 0) {
    onDebugLog?.('PHASE2', `Calling investment-match with ${Object.keys(collectedCategories).length} categories`);
    const phase2Result = await runInvestmentMatch(collectedCategories, callbacks, authHeaders);
    if (!phase2Result.success) return { success: false };
    metadata = { ...metadata, ...phase2Result.metadata };
  }

  return { success: true, metadata };
}

/**
 * Phase 2: call /api/evaluation/investment-match with the 10 collected category results.
 * Streams maturity_calculated, investment_recommendations_complete, workflow_complete events.
 */
async function runInvestmentMatch(categoryResults, callbacks, authHeaders) {
  const {
    onInvestmentMatchingStarted,
    onMaturityCalculated,
    onInvestmentRecommendationsComplete,
    onError,
    onStatus,
    onDebugLog,
  } = callbacks;

  onDebugLog?.('CONNECT2', 'POST /api/evaluation/investment-match');

  let response;
  try {
    response = await fetch('/api/evaluation/investment-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ categoryResults }),
    });
  } catch (fetchErr) {
    if (onError) onError(`Network error (Phase 2): ${fetchErr.message}`);
    return { success: false };
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (onError) onError(`Phase 2 failed (${response.status}): ${errorText}`);
    return { success: false };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let metadata = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const event = parseSSELine(line);
        if (!event) continue;
        switch (event.type) {
          case 'investment_matching_started':
            onDebugLog?.('INVEST↑', 'Phase 2 started');
            if (onInvestmentMatchingStarted) onInvestmentMatchingStarted();
            break;
          case 'maturity_calculated':
            onDebugLog?.('MATURE', `stage=${event.data?.maturity_stage} score=${event.data?.maturity_score}`);
            if (onMaturityCalculated) onMaturityCalculated(event.data);
            break;
          case 'investment_recommendations_complete':
            onDebugLog?.('INVEST✓', `keys=${Object.keys(event.data || {}).join(',')}`);
            if (onInvestmentRecommendationsComplete) onInvestmentRecommendationsComplete(event.data);
            break;
          case 'workflow_complete':
            metadata = event.metadata;
            onDebugLog?.('DONE2', `tokens=${event.metadata?.total_tokens} elapsed=${event.metadata?.elapsed_time}s`);
            break;
          case 'status':
            if (onStatus) onStatus(event.message);
            break;
          case 'error':
            onDebugLog?.('ERROR2', event.message);
            if (onError) onError(event.message);
            break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { success: true, metadata };
}
