/**
 * POST /api/evaluation/generate
 *
 * Main evaluation endpoint. Orchestrates:
 * 1. Knowledge base retrieval (10 parallel semantic searches)
 * 2. Context assembly per category
 * 3. Dify Workflow execution (streaming) — or mock mode if no API key
 * 4. SSE stream transformation back to frontend
 *
 * Auth: User JWT (via _auth.js)
 * Response: text/event-stream (SSE)
 *
 * Mock mode: When DIFY_EVALUATION_API_KEY is not set, returns simulated
 * streaming results derived from the onboarding summary. This lets you
 * test the full pipeline (frontend → API → KB retrieval → SSE) without
 * a Dify workflow configured.
 */

import { verifyAuth } from '../_auth.js';
import { resolveApiKey } from '../_shared.js';
import { buildCategoryContexts } from './_categoryContext.js';
import { streamEvaluation } from './_difyWorkflow.js';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Step 1: Authenticate user
  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const userId = auth.user.sub;
  const { companyName, onboardingSummary, knowledgeBaseId } = req.body;

  if (!companyName) {
    return res.status(400).json({ error: 'companyName is required' });
  }
  if (!onboardingSummary?.categories) {
    return res.status(400).json({ error: 'onboardingSummary with categories is required' });
  }

  // Step 2: Resolve Dify API key for evaluation workflow
  const { apiKey } = resolveApiKey('evaluation');
  const useMock = !apiKey || apiKey === resolveApiKey('onboarding').apiKey;

  // Set up SSE response
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    if (useMock) {
      // ── Mock mode: simulate evaluation from onboarding summary ──
      sendEvent({ type: 'status', message: 'Mock mode — generating evaluation from onboarding data...' });

      await streamMockEvaluation(sendEvent, onboardingSummary);
    } else {
      // ── Real mode: KB retrieval + Dify workflow ──
      sendEvent({ type: 'status', message: 'Retrieving knowledge base context...' });

      let contexts;
      try {
        contexts = await buildCategoryContexts(userId, onboardingSummary, knowledgeBaseId);
      } catch (ctxErr) {
        // If KB retrieval fails (e.g. OpenAI quota), fall back to onboarding-only context
        console.error('KB retrieval failed, using onboarding-only context:', ctxErr.message);
        sendEvent({ type: 'status', message: 'KB retrieval unavailable — using onboarding data only...' });
        contexts = buildFallbackContexts(onboardingSummary);
      }

      const inputs = {
        company_name: companyName,
        user_id: userId,
        ...contexts,
      };

      sendEvent({ type: 'status', message: 'Starting evaluation workflow...' });

      for await (const event of streamEvaluation(inputs, apiKey, userId)) {
        sendEvent(event);
        if (event.type === 'error' && !event.category_id) {
          break;
        }
      }
    }
  } catch (err) {
    sendEvent({ type: 'error', message: err.message || 'Evaluation generation failed' });
  } finally {
    res.end();
  }
}

/**
 * Mock evaluation: derives category results from the onboarding summary
 * with simulated delays (300-800ms per category) to test the streaming UX.
 */
async function streamMockEvaluation(sendEvent, onboardingSummary) {
  const categoriesMap = {};
  if (onboardingSummary?.categories) {
    for (const cat of onboardingSummary.categories) {
      categoriesMap[cat.id] = cat;
    }
  }

  const categoryIds = Object.keys(CATEGORY_TITLES);

  for (const categoryId of categoryIds) {
    sendEvent({ type: 'category_started', category_id: categoryId });

    // Simulated processing delay (300-800ms)
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500));

    const onboardingCat = categoriesMap[categoryId];
    const completeness = onboardingCat?.completeness ?? Math.floor(Math.random() * 60 + 20);
    const status = completeness >= 70 ? 'proven' : completeness >= 40 ? 'partial' : 'unproven';

    sendEvent({
      type: 'category_complete',
      category_id: categoryId,
      data: {
        category_id: categoryId,
        category_title: CATEGORY_TITLES[categoryId],
        summary: onboardingCat?.summary || `Mock evaluation for ${CATEGORY_TITLES[categoryId]}.`,
        completeness,
        status,
        highlights: onboardingCat?.highlights || [],
        gaps: onboardingCat?.gaps || [],
        keyMetrics: onboardingCat?.keyMetrics || {},
        deepDivePrompt: onboardingCat?.deepDivePrompt || `Let's explore ${CATEGORY_TITLES[categoryId]} further.`,
      },
    });
  }

  sendEvent({
    type: 'workflow_complete',
    metadata: { total_tokens: 0, elapsed_time: 0, mock: true },
  });
}

/**
 * Build fallback contexts using only onboarding data (no KB search).
 * Used when embedding generation fails (e.g. OpenAI quota exceeded).
 */
function buildFallbackContexts(onboardingSummary) {
  const contexts = {};
  const categoriesMap = {};
  if (onboardingSummary?.categories) {
    for (const cat of onboardingSummary.categories) {
      categoriesMap[cat.id] = cat;
    }
  }

  for (const categoryId of Object.keys(CATEGORY_TITLES)) {
    const cat = categoriesMap[categoryId];
    const sections = ['## Onboarding Data'];
    if (cat) {
      sections.push(`Summary: ${cat.summary}`);
      sections.push(`Completeness: ${cat.completeness}%`);
      if (cat.highlights?.length) sections.push(`Highlights:\n${cat.highlights.map((h) => `- ${h}`).join('\n')}`);
      if (cat.gaps?.length) sections.push(`Gaps:\n${cat.gaps.map((g) => `- ${g}`).join('\n')}`);
      if (cat.keyMetrics && Object.keys(cat.keyMetrics).length > 0) {
        sections.push(`Key Metrics:\n${Object.entries(cat.keyMetrics).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`);
      }
    } else {
      sections.push('No onboarding data available for this category.');
    }
    contexts[`context_${categoryId}`] = sections.join('\n');
  }

  return contexts;
}
