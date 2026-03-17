/**
 * Tests for _difyWorkflow.js — SSE parsing, category ID extraction, event transformation.
 *
 * Key invariants:
 * - Node title is the source of truth for category_id (not LLM output)
 * - Unknown node titles are silently ignored (not errors)
 * - structured_output is preferred over text when both are present
 * - category_id in LLM output is overridden by the node-derived ID
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the exported streamEvaluation indirectly by mocking fetch and reading
// yielded events, but the core logic (transformDifyEvent, extractCategoryFromNodeTitle)
// is private. We test them through streamEvaluation with controlled SSE payloads.

import { streamEvaluation } from './_difyWorkflow.js';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeSseBody(events) {
  const lines = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  const encoder = new TextEncoder();
  const bytes = encoder.encode(lines);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function mockFetchOk(events) {
  return vi.fn().mockResolvedValue({
    ok: true,
    body: makeSseBody(events),
  });
}

function mockFetchError(status, text) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(text),
  });
}

async function collectEvents(generator) {
  const events = [];
  for await (const event of generator) {
    events.push(event);
  }
  return events;
}

// ─── extractCategoryFromNodeTitle (via node_finished events) ──────────────────

describe('category ID extraction from node title', () => {
  it('strips eval_ prefix for valid category', async () => {
    global.fetch = mockFetchOk([
      {
        event: 'node_finished',
        data: {
          title: 'eval_business_model',
          outputs: { text: JSON.stringify({ category_id: 'eval_business_model', completeness: 60, summary: 'ok' }) },
        },
      },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('category_complete');
    expect(events[0].category_id).toBe('business_model');
    expect(events[0].data.category_id).toBe('business_model');
  });

  it('ignores node_finished for unknown category (not in VALID_CATEGORY_IDS)', async () => {
    global.fetch = mockFetchOk([
      {
        event: 'node_finished',
        data: {
          title: 'eval_unknown_category',
          outputs: { text: JSON.stringify({ category_id: 'eval_unknown_category', completeness: 50, summary: 'x' }) },
        },
      },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events).toHaveLength(0);
  });

  it('ignores node_finished for non-eval_ prefixed nodes', async () => {
    global.fetch = mockFetchOk([
      {
        event: 'node_finished',
        data: {
          title: 'Code 4 (route_to_llms)',
          outputs: { text: 'some output' },
        },
      },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events).toHaveLength(0);
  });

  it('ignores node_finished with null/missing title', async () => {
    global.fetch = mockFetchOk([
      { event: 'node_finished', data: { outputs: { text: '{}' } } },
      { event: 'node_finished', data: { title: null, outputs: { text: '{}' } } },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events).toHaveLength(0);
  });

  it('handles all 10 valid category IDs', async () => {
    const validIds = [
      'product_technology', 'market_traction', 'business_model', 'team_organization',
      'go_to_market', 'financial_health', 'fundraising_capital', 'competitive_position',
      'operations', 'legal_compliance',
    ];

    const sseEvents = validIds.map((id) => ({
      event: 'node_finished',
      data: {
        title: `eval_${id}`,
        outputs: { text: JSON.stringify({ category_id: `eval_${id}`, completeness: 50, summary: 'test' }) },
      },
    }));

    global.fetch = mockFetchOk(sseEvents);
    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));

    expect(events).toHaveLength(10);
    expect(events.map((e) => e.category_id)).toEqual(validIds);
  });
});

// ─── category_id override (LLM output must not win) ──────────────────────────

describe('category_id override from node title', () => {
  it('overrides LLM category_id with node-derived ID (strips eval_ from LLM output)', async () => {
    global.fetch = mockFetchOk([
      {
        event: 'node_finished',
        data: {
          title: 'eval_operations',
          outputs: { text: JSON.stringify({ category_id: 'eval_operations', completeness: 40, summary: 'ops' }) },
        },
      },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events[0].data.category_id).toBe('operations');
  });

  it('overrides LLM category_id even when LLM output has correct bare form', async () => {
    global.fetch = mockFetchOk([
      {
        event: 'node_finished',
        data: {
          title: 'eval_operations',
          outputs: { text: JSON.stringify({ category_id: 'operations', completeness: 40, summary: 'ops' }) },
        },
      },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events[0].data.category_id).toBe('operations');
  });

  it('overrides LLM category_id even when LLM outputs wrong category', async () => {
    global.fetch = mockFetchOk([
      {
        event: 'node_finished',
        data: {
          title: 'eval_operations',
          outputs: { text: JSON.stringify({ category_id: 'market_traction', completeness: 40, summary: 'ops' }) },
        },
      },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events[0].data.category_id).toBe('operations');
  });
});

// ─── structured_output preference ─────────────────────────────────────────────

describe('structured_output vs text preference', () => {
  it('uses structured_output when present (already parsed object)', async () => {
    const structuredOutput = { category_id: 'eval_legal_compliance', completeness: 35, summary: 'from structured' };
    const textOutput = JSON.stringify({ category_id: 'eval_legal_compliance', completeness: 99, summary: 'from text' });

    global.fetch = mockFetchOk([
      {
        event: 'node_finished',
        data: {
          title: 'eval_legal_compliance',
          outputs: { structured_output: structuredOutput, text: textOutput },
        },
      },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events[0].data.completeness).toBe(35);
    expect(events[0].data.description).toBeUndefined(); // structured_output doesn't have description
    expect(events[0].data.summary).toBe('from structured');
  });

  it('falls back to text when structured_output is absent', async () => {
    global.fetch = mockFetchOk([
      {
        event: 'node_finished',
        data: {
          title: 'eval_legal_compliance',
          outputs: { text: JSON.stringify({ category_id: 'eval_legal_compliance', completeness: 35, summary: 'from text' }) },
        },
      },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events[0].data.completeness).toBe(35);
    expect(events[0].data.summary).toBe('from text');
  });

  it('falls back to result when text is also absent', async () => {
    global.fetch = mockFetchOk([
      {
        event: 'node_finished',
        data: {
          title: 'eval_legal_compliance',
          outputs: { result: JSON.stringify({ category_id: 'eval_legal_compliance', completeness: 35, summary: 'from result' }) },
        },
      },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events[0].data.completeness).toBe(35);
    expect(events[0].data.summary).toBe('from result');
  });
});

// ─── Rich output fields preserved ─────────────────────────────────────────────

describe('rich LLM output fields are passed through', () => {
  it('preserves highlights, gaps, keyMetrics, deepDivePrompt, status', async () => {
    const fullOutput = {
      category_id: 'eval_business_model',
      completeness: 60,
      summary: 'Good SaaS model.',
      status: 'partial',
      highlights: ['72% gross margin', '$45K MRR'],
      gaps: [
        { action: 'Calculate LTV/CAC ratio using cohort data', type: 'table_stakes', evidence_items: [9] },
        { action: 'Map a clear path to profitability with timeline', type: 'stretch', evidence_items: [12] },
      ],
      keyMetrics: { mrr: 45000, grossMarginPercent: 72 },
      deepDivePrompt: 'Tell me about your CAC.',
    };

    global.fetch = mockFetchOk([
      {
        event: 'node_finished',
        data: { title: 'eval_business_model', outputs: { text: JSON.stringify(fullOutput) } },
      },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    const data = events[0].data;
    expect(data.status).toBe('partial');
    expect(data.highlights).toEqual(['72% gross margin', '$45K MRR']);
    expect(data.gaps).toHaveLength(2);
    expect(data.keyMetrics.mrr).toBe(45000);
    expect(data.deepDivePrompt).toBe('Tell me about your CAC.');
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('error handling', () => {
  it('yields error event when Dify returns non-200', async () => {
    global.fetch = mockFetchError(500, 'Internal Server Error');

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    expect(events[0].message).toContain('500');
  });

  it('yields category error when LLM output is not valid JSON', async () => {
    global.fetch = mockFetchOk([
      {
        event: 'node_finished',
        data: { title: 'eval_operations', outputs: { text: 'This is not JSON at all.' } },
      },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    expect(events[0].category_id).toBe('operations');
  });

  it('emits workflow_complete on workflow_finished event', async () => {
    global.fetch = mockFetchOk([
      { event: 'workflow_finished', data: { total_tokens: 5000, elapsed_time: 30.5 } },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('workflow_complete');
    expect(events[0].metadata.total_tokens).toBe(5000);
    expect(events[0].metadata.elapsed_time).toBe(30.5);
  });

  it('emits category_started on node_started for valid eval node', async () => {
    global.fetch = mockFetchOk([
      { event: 'node_started', data: { title: 'eval_product_technology' } },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('category_started');
    expect(events[0].category_id).toBe('product_technology');
  });

  it('ignores node_started for non-eval, non-investment nodes', async () => {
    global.fetch = mockFetchOk([
      { event: 'node_started', data: { title: 'Code 1 (define_categories)' } },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events).toHaveLength(0);
  });
});

// ─── Investment matching events ───────────────────────────────────────────────

describe('investment matching events', () => {
  it('emits investment_matching_started when calculate_maturity node starts', async () => {
    global.fetch = mockFetchOk([
      { event: 'node_started', data: { title: 'calculate_maturity' } },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('investment_matching_started');
  });

  it('emits maturity_calculated when calculate_maturity node finishes', async () => {
    global.fetch = mockFetchOk([
      {
        event: 'node_finished',
        data: {
          title: 'calculate_maturity',
          outputs: {
            maturity_score: 320,
            maturity_stage: 'early_traction',
            maturity_label: 'Early Traction (201-400)',
            performance_level: 'average',
            performance_label: 'Average',
            overall_completeness: 55,
          },
        },
      },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('maturity_calculated');
    expect(events[0].data.maturity_score).toBe(320);
    expect(events[0].data.maturity_stage).toBe('early_traction');
    expect(events[0].data.performance_level).toBe('average');
    expect(events[0].data.overall_completeness).toBe(55);
  });

  it('emits investment_recommendations_complete when outputs contain investment_readiness_summary', async () => {
    const investmentOutput = {
      investment_readiness_summary: { assessment: 'Strong early signals.', primary_recommendation: 'Pre-Seed', readiness_score: 'Moderate' },
      recommended_funding: [{ investment_type: 'pre_seed', rating: 'strong_fit', fit_explanation: 'Good fit.' }],
      conditional_options: [],
      improvement_roadmap: [],
      not_recommended: [],
      next_steps: [{ priority: 1, action: 'Build pitch deck', timeline: '2 weeks', expected_outcome: 'Investor materials ready' }],
    };

    global.fetch = mockFetchOk([
      {
        event: 'node_finished',
        data: {
          title: 'investment_recommendations',
          outputs: investmentOutput,
        },
      },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('investment_recommendations_complete');
    expect(events[0].data.investment_readiness_summary.readiness_score).toBe('Moderate');
    expect(events[0].data.next_steps).toHaveLength(1);
  });

  it('emits status event when generate_matrix node finishes (Phase 2 keepalive)', async () => {
    global.fetch = mockFetchOk([
      {
        event: 'node_finished',
        data: {
          title: 'generate_matrix',
          outputs: { recommendations_json: '{}', suitable_types: '[]' },
        },
      },
    ]);

    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('status');
    expect(events[0].message).toBe('Matching investment profiles...');
  });
});

// ─── Case-insensitive node title matching ─────────────────────────────────────

describe('case-insensitive node title matching', () => {
  it('matches CALCULATE_MATURITY (uppercase) as investment_matching_started', async () => {
    global.fetch = mockFetchOk([
      { event: 'node_started', data: { title: 'CALCULATE_MATURITY' } },
    ]);
    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('investment_matching_started');
  });

  it('matches CALCULATE_MATURITY (uppercase) node_finished as maturity_calculated', async () => {
    global.fetch = mockFetchOk([
      {
        event: 'node_finished',
        data: {
          title: 'CALCULATE_MATURITY',
          outputs: { maturity_score: 300, maturity_stage: 'early_traction', maturity_label: 'L', performance_level: 'average', performance_label: 'P', overall_completeness: 50 },
        },
      },
    ]);
    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('maturity_calculated');
  });

  it('matches GENERATE_MATRIX (uppercase) as status keepalive', async () => {
    global.fetch = mockFetchOk([
      { event: 'node_finished', data: { title: 'GENERATE_MATRIX', outputs: {} } },
    ]);
    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('status');
  });

  it('matches EVAL_PRODUCT_TECHNOLOGY (uppercase) as category_started', async () => {
    global.fetch = mockFetchOk([
      { event: 'node_started', data: { title: 'EVAL_PRODUCT_TECHNOLOGY' } },
    ]);
    const events = await collectEvents(streamEvaluation({}, 'key', 'user'));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('category_started');
    expect(events[0].category_id).toBe('product_technology');
  });
});
