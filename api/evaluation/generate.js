/**
 * POST /api/evaluation/generate
 *
 * Main evaluation endpoint. Orchestrates:
 * 1. Deep dive conversation embedding (enriches KB before retrieval)
 * 2. Dify Workflow execution (streaming) — Dify iteration handles KB retrieval
 * 3. SSE stream transformation back to frontend
 *
 * Auth: User JWT (via _auth.js)
 * Response: text/event-stream (SSE)
 *
 * Mock mode: When DIFY_EVALUATION_API_KEY is not set, returns simulated
 * streaming results derived from the onboarding summary. This lets you
 * test the full pipeline (frontend → API → SSE) without a Dify workflow
 * configured.
 */

import { verifyAuth } from '../_auth.js';

export const config = { runtime: 'edge' };
import { getSupabaseAdmin } from '../_supabase.js';
import { resolveApiKey } from '../_shared.js';
import { chunkConversation } from '../_chunking.js';
import { generateEmbeddings } from '../knowledge/embeddings.js';
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

// Mock investment recommendations — same shape as the investment_recommendations LLM node output.
// Used when DIFY_EVALUATION_API_KEY is absent (server mock mode).
const MOCK_INVESTMENT_RECOMMENDATIONS = {
  investment_readiness_summary: {
    assessment: 'Your company is at early traction stage with average performance across key dimensions. You have promising early signals but need to strengthen financial health and market traction documentation before approaching most institutional investors.',
    primary_recommendation: 'Pre-Seed Investment',
    readiness_score: 'Moderate',
  },
  recommended_funding: [
    {
      investment_type: 'pre_seed',
      rating: 'strong_fit',
      fit_explanation: 'Strong team with relevant experience and early product traction make you an attractive pre-seed candidate. Investors at this stage focus on team and vision, which you have demonstrated.',
      typical_terms: '$50K–$500K at $2–5M pre-money valuation. Expect 10–20% dilution.',
      investor_expectations: ['Compelling vision and large market opportunity', 'Exceptional founding team', 'Early customer validation or prototype'],
      prepare_for_objections: ['Limited revenue traction so far', 'Financial projections need strengthening', 'Go-to-market strategy needs more detail'],
    },
    {
      investment_type: 'grant_funding',
      rating: 'acceptable',
      fit_explanation: 'Non-dilutive grants are well-suited for your stage and can extend runway while you build toward seed readiness. Look for innovation-focused programs aligned with your technology.',
      typical_terms: 'Non-dilutive. Varies by program: $25K–$250K.',
      investor_expectations: ['Clear innovation or social impact narrative', 'Specific use of funds tied to deliverables', 'Reporting requirements'],
      prepare_for_objections: ['Application process can take 3–6 months', 'Usage may be restricted to specific activities'],
    },
  ],
  conditional_options: [
    {
      investment_type: 'seed',
      conditions_for_fit: 'Achievable once you reach $25–50K ARR with clear PMF signals and stronger financial documentation.',
      improvements_needed: [
        {
          category: 'market_traction',
          current_state: 'Early customers, limited ARR data',
          target_state: '$25–50K ARR, documented growth metrics',
          actions: ['Document MRR growth month-over-month for 6+ months', 'Collect and publish customer testimonials', 'Define and measure CAC and LTV'],
        },
        {
          category: 'financial_health',
          current_state: 'Basic financials without detailed projections',
          target_state: '18-month runway model with scenario planning',
          actions: ['Build a 3-year financial model', 'Document burn rate trends', 'Prepare detailed use-of-funds breakdown'],
        },
      ],
    },
  ],
  improvement_roadmap: [
    {
      priority: 1,
      category: 'market_traction',
      current_score: 45,
      target_score: 70,
      unlocks: ['seed', 'revenue_based_financing'],
      specific_actions: ['Track and document MRR with month-over-month growth', 'Define customer acquisition channels with CAC data', 'Gather 3–5 detailed customer case studies'],
      timeline: '2–3 months',
    },
    {
      priority: 2,
      category: 'financial_health',
      current_score: 38,
      target_score: 60,
      unlocks: ['seed', 'venture_debt', 'revenue_based_financing'],
      specific_actions: ['Build 18-month cash flow model', 'Document unit economics (CAC, LTV, payback period)', 'Prepare investor-ready P&L summary'],
      timeline: '1–2 months',
    },
    {
      priority: 3,
      category: 'go_to_market',
      current_score: 50,
      target_score: 70,
      unlocks: ['seed', 'series_a'],
      specific_actions: ['Document primary sales motion and channel strategy', 'Define ideal customer profile (ICP)', 'Track conversion rates through each funnel stage'],
      timeline: '2–3 months',
    },
  ],
  not_recommended: [
    { investment_type: 'series_a', reason: 'Too early — need proven PMF and $150K+ ARR first.' },
    { investment_type: 'venture_debt', reason: 'Requires predictable recurring revenue and existing VC backing.' },
    { investment_type: 'revenue_based_financing', reason: 'Revenue volume too low to support repayment obligations at this stage.' },
  ],
  next_steps: [
    {
      priority: 1,
      action: 'Build detailed MRR tracking and growth metrics dashboard',
      timeline: '2 weeks',
      expected_outcome: 'Clear evidence of traction growth for investor conversations',
    },
    {
      priority: 2,
      action: 'Prepare pre-seed investor deck (10–12 slides)',
      timeline: '3 weeks',
      expected_outcome: 'Investment-ready materials targeting pre-seed funds',
    },
    {
      priority: 3,
      action: 'Research and apply to 2–3 relevant grant programs',
      timeline: '4 weeks',
      expected_outcome: 'Non-dilutive capital to extend runway by 3–6 months',
    },
    {
      priority: 4,
      action: 'Build 18-month financial model with scenario analysis',
      timeline: '2 weeks',
      expected_outcome: 'Investor-ready financials that demonstrate capital efficiency',
    },
    {
      priority: 5,
      action: 'Identify and build relationships with 15–20 target pre-seed investors',
      timeline: '6 weeks',
      expected_outcome: 'Active investor pipeline for fundraise in next quarter',
    },
  ],
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Step 1: Authenticate user
  const auth = await verifyAuth(req);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = auth.user.sub;
  const { companyName, onboardingSummary } = await req.json();

  if (!companyName) {
    return new Response(JSON.stringify({ error: 'companyName is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Step 2: Resolve Dify API key for evaluation workflow
  const { apiKey } = resolveApiKey('evaluation');
  const useMock = !apiKey || apiKey === resolveApiKey('onboarding').apiKey;

  // Set up SSE stream using Web Streams API (required for Edge Runtime)
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        if (useMock) {
          // ── Mock mode: simulate evaluation from onboarding summary ──
          sendEvent({ type: 'status', message: 'Mock mode — generating evaluation from onboarding data...' });

          await streamMockEvaluation(sendEvent, onboardingSummary);
        } else {
          // ── Real mode: embed deep dive conversations, then run Dify workflow ──
          // Dify's own iteration handles KB retrieval; we just ensure deep dive
          // conversations are embedded so they're available for vector search.
          sendEvent({ type: 'status', message: 'Preparing knowledge base...' });
          await embedDeepDiveConversations(userId);

          const inputs = {
            company_name: companyName,
            user_id: userId,
          };

          sendEvent({ type: 'status', message: 'Starting evaluation workflow...' });
          console.log(`[generate] Calling Dify workflow for user ${userId}, company="${companyName}"`);

          for await (const event of streamEvaluation(inputs, apiKey, userId)) {
            if (event.type === 'error') {
              console.error(`[generate] Dify error event: ${event.message}`);
            }
            sendEvent(event);
            if (event.type === 'error' && !event.category_id) {
              break;
            }
          }

          console.log(`[generate] Dify workflow stream complete for user ${userId}`);
        }
      } catch (err) {
        console.error(`[generate] Uncaught error: ${err.message}`, err.stack);
        sendEvent({ type: 'error', message: err.message || 'Evaluation generation failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
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

  // Phase 2: Investment matching
  sendEvent({ type: 'investment_matching_started' });
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Derive mock maturity from average completeness of generated categories
  sendEvent({
    type: 'maturity_calculated',
    data: {
      maturity_score: 320,
      maturity_stage: 'early_traction',
      maturity_label: 'Early Traction (201-400)',
      performance_level: 'average',
      performance_label: 'Average',
      overall_completeness: 55,
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  sendEvent({
    type: 'investment_recommendations_complete',
    data: MOCK_INVESTMENT_RECOMMENDATIONS,
  });

  sendEvent({
    type: 'workflow_complete',
    metadata: { total_tokens: 0, elapsed_time: 0, mock: true },
  });
}

/**
 * Embed all deep dive conversation messages for the user into the vector store.
 * Called before the Dify evaluation workflow so that KB retrieval inside Dify
 * can find category-specific deep dive content.
 *
 * Non-fatal — logs errors without throwing so evaluation can still proceed.
 */
async function embedDeepDiveConversations(userId) {
  try {
    const supabase = getSupabaseAdmin();

    const { data: convs } = await supabase
      .from('conversations')
      .select('id, category_id')
      .eq('user_id', userId)
      .eq('workflow', 'deepdive');

    if (!convs?.length) return;

    // Fetch messages for all deep dive conversations in parallel
    const convMessages = await Promise.all(
      convs.map(async (conv) => {
        const { data: msgs } = await supabase
          .from('messages')
          .select('role, content')
          .eq('conversation_id', conv.id)
          .order('created_at');
        return { conv, msgs: msgs || [] };
      }),
    );

    // Chunk all conversations and batch embed in one OpenAI call
    const allChunks = [];
    const chunkConvMap = []; // tracks which conv each chunk belongs to

    for (const { conv, msgs } of convMessages) {
      if (msgs.length === 0) continue;
      const chunks = chunkConversation(msgs, { workflow: 'deepdive', category_id: conv.category_id });
      for (const chunk of chunks) {
        allChunks.push(chunk);
        chunkConvMap.push(conv);
      }
    }

    if (allChunks.length === 0) return;

    const embeddings = await generateEmbeddings(allChunks.map((c) => c.content));

    const rows = allChunks.map((chunk, i) => ({
      user_id: userId,
      source_type: 'conversation',
      source_id: chunkConvMap[i].id,
      chunk_index: chunk.chunk_index ?? i,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[i]),
      metadata: chunk.metadata || {},
    }));

    const { error } = await supabase
      .from('document_embeddings')
      .upsert(rows, { onConflict: 'source_type,source_id,chunk_index' });

    if (error) {
      console.error('[generate] Failed to upsert deep dive embeddings:', error.message);
    } else {
      console.log(`[generate] Embedded ${rows.length} deep dive chunks for user ${userId}`);
    }
  } catch (err) {
    console.error('[generate] Deep dive embedding failed (non-fatal):', err.message);
  }
}
