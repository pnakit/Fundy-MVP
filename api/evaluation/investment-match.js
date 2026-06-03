/**
 * POST /api/evaluation/investment-match
 *
 * Phase 2 fallback: receives the 10 evaluated category objects from the client
 * and returns mock investment recommendations. The primary LLM path in
 * generate.js handles investment matching inline; this endpoint is only
 * called when that inline path is unavailable (e.g. mock mode).
 *
 * Auth: User JWT (via _auth.js)
 * Response: text/event-stream (SSE)
 */

import { verifyAuth } from '../_auth.js';

export const config = { runtime: 'edge' };

const MOCK_INVESTMENT_RECOMMENDATIONS = {
  investment_readiness_summary: {
    assessment:
      'Your company is at early traction stage with average performance across key dimensions. You have promising early signals but need to strengthen financial health and market traction documentation before approaching most institutional investors.',
    primary_recommendation: 'Pre-Seed Investment',
    readiness_score: 'Moderate',
  },
  recommended_funding: [
    {
      investment_type: 'pre_seed',
      rating: 'strong_fit',
      fit_explanation:
        'Strong team with relevant experience and early product traction make you an attractive pre-seed candidate. Investors at this stage focus on team and vision, which you have demonstrated.',
      typical_terms: '$50K–$500K at $2–5M pre-money valuation. Expect 10–20% dilution.',
      investor_expectations: [
        'Compelling vision and large market opportunity',
        'Exceptional founding team',
        'Early customer validation or prototype',
      ],
      prepare_for_objections: [
        'Limited revenue traction so far',
        'Financial projections need strengthening',
        'Go-to-market strategy needs more detail',
      ],
    },
    {
      investment_type: 'grant_funding',
      rating: 'acceptable',
      fit_explanation:
        'Non-dilutive grants are well-suited for your stage and can extend runway while you build toward seed readiness. Look for innovation-focused programs aligned with your technology.',
      typical_terms: 'Non-dilutive. Varies by program: $25K–$250K.',
      investor_expectations: [
        'Clear innovation or social impact narrative',
        'Specific use of funds tied to deliverables',
        'Reporting requirements',
      ],
      prepare_for_objections: [
        'Application process can take 3–6 months',
        'Usage may be restricted to specific activities',
      ],
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
          actions: [
            'Document MRR growth month-over-month for 6+ months',
            'Collect and publish customer testimonials',
            'Define and measure CAC and LTV',
          ],
        },
        {
          category: 'financial_health',
          current_state: 'Basic financials without detailed projections',
          target_state: '18-month runway model with scenario planning',
          actions: [
            'Build a 3-year financial model',
            'Document burn rate trends',
            'Prepare detailed use-of-funds breakdown',
          ],
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
      specific_actions: [
        'Track and document MRR with month-over-month growth',
        'Define customer acquisition channels with CAC data',
        'Gather 3–5 detailed customer case studies',
      ],
      timeline: '2–3 months',
    },
    {
      priority: 2,
      category: 'financial_health',
      current_score: 38,
      target_score: 60,
      unlocks: ['seed', 'venture_debt', 'revenue_based_financing'],
      specific_actions: [
        'Build 18-month cash flow model',
        'Document unit economics (CAC, LTV, payback period)',
        'Prepare investor-ready P&L summary',
      ],
      timeline: '1–2 months',
    },
    {
      priority: 3,
      category: 'go_to_market',
      current_score: 50,
      target_score: 70,
      unlocks: ['seed', 'series_a'],
      specific_actions: [
        'Document primary sales motion and channel strategy',
        'Define ideal customer profile (ICP)',
        'Track conversion rates through each funnel stage',
      ],
      timeline: '2–3 months',
    },
  ],
  not_recommended: [
    { investment_type: 'series_a', reason: 'Too early — need proven PMF and $150K+ ARR first.' },
    { investment_type: 'venture_debt', reason: 'Requires predictable recurring revenue and existing VC backing.' },
    {
      investment_type: 'revenue_based_financing',
      reason: 'Revenue volume too low to support repayment obligations at this stage.',
    },
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

  const auth = await verifyAuth(req);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { categoryResults } = await req.json();

  if (!categoryResults || typeof categoryResults !== 'object') {
    return new Response(JSON.stringify({ error: 'categoryResults is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        await streamMockPhase2(sendEvent);
      } catch (err) {
        console.error(`[investment-match] Uncaught error: ${err.message}`, err.stack);
        sendEvent({ type: 'error', message: err.message || 'Investment matching failed' });
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

async function streamMockPhase2(sendEvent) {
  sendEvent({ type: 'investment_matching_started' });
  await new Promise((resolve) => setTimeout(resolve, 800));

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
