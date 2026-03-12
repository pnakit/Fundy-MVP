/**
 * Tests for evaluationApi.js — investment matching callbacks in mock and real (SSE) modes.
 *
 * Key invariants:
 * - Mock mode fires onInvestmentMatchingStarted, onMaturityCalculated,
 *   onInvestmentRecommendationsComplete after all 10 category callbacks
 * - Real (SSE) mode correctly routes investment event types to their callbacks
 * - Missing optional callbacks are silently ignored (no throws)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Supabase mock (for getAuthHeaders) ───────────────────────────────────────

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));
vi.mock('./supabaseClient', () => ({
  supabase: { auth: { getSession: mockGetSession } },
}));

// ─── mockData mock ────────────────────────────────────────────────────────────
// MOCK_INV must be defined via vi.hoisted so it is initialised before vi.mock's
// factory function runs (vi.mock is hoisted to the top of the file by Vitest).

const { MOCK_INV } = vi.hoisted(() => ({
  MOCK_INV: {
    investment_readiness_summary: {
      assessment: 'Strong early signals.',
      primary_recommendation: 'Pre-Seed',
      readiness_score: 'Moderate',
    },
    recommended_funding: [{ investment_type: 'pre_seed', rating: 'strong_fit', fit_explanation: 'Good fit.' }],
    conditional_options: [],
    improvement_roadmap: [],
    not_recommended: [],
    next_steps: [{ priority: 1, action: 'Build pitch deck', timeline: '2 weeks', expected_outcome: 'Ready' }],
  },
}));

vi.mock('../data/mockData', () => ({ MOCK_INVESTMENT_DATA: MOCK_INV }));

import { generateEvaluation } from './evaluationApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSseStream(events) {
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

function mockFetchSse(events) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    body: makeSseStream(events),
  });
}

// Minimal category_complete payload — just enough to populate collectedCategories
// so generateEvaluationReal proceeds to Phase 2.
const MINIMAL_CATEGORY_EVENT = {
  type: 'category_complete',
  data: { category_id: 'product_technology', completeness: 65, status: 'partial', highlights: [], gaps: [], summary: '' },
};

// Mocks two sequential fetch calls: Phase 1 (generate) then Phase 2 (investment-match).
// Phase 1 must include at least one category_complete so Phase 2 is triggered.
function mockFetchSsePhased(phase1Events, phase2Events) {
  global.fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, body: makeSseStream(phase1Events) })
    .mockResolvedValueOnce({ ok: true, body: makeSseStream(phase2Events) });
}

function makeCallbacks(overrides = {}) {
  return {
    onCategoryStarted: vi.fn(),
    onCategoryComplete: vi.fn(),
    onInvestmentMatchingStarted: vi.fn(),
    onMaturityCalculated: vi.fn(),
    onInvestmentRecommendationsComplete: vi.fn(),
    onError: vi.fn(),
    onStatus: vi.fn(),
    ...overrides,
  };
}

// ─── Mock mode ────────────────────────────────────────────────────────────────

describe('generateEvaluation (mock mode)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_DIFY_MOCK', 'true');
    mockGetSession.mockResolvedValue({ data: { session: null } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('calls all 10 category callbacks then fires investment phase callbacks', async () => {
    const cbs = makeCallbacks();
    const promise = generateEvaluation('TestCo', null, cbs);
    await vi.runAllTimersAsync();
    await promise;

    expect(cbs.onCategoryStarted).toHaveBeenCalledTimes(10);
    expect(cbs.onCategoryComplete).toHaveBeenCalledTimes(10);
    expect(cbs.onInvestmentMatchingStarted).toHaveBeenCalledTimes(1);
    expect(cbs.onMaturityCalculated).toHaveBeenCalledTimes(1);
    expect(cbs.onInvestmentRecommendationsComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onMaturityCalculated with correct shape', async () => {
    const cbs = makeCallbacks();
    const promise = generateEvaluation('TestCo', null, cbs);
    await vi.runAllTimersAsync();
    await promise;

    expect(cbs.onMaturityCalculated).toHaveBeenCalledWith(
      expect.objectContaining({
        maturity_score: 320,
        maturity_stage: 'early_traction',
        maturity_label: 'Early Traction (201-400)',
        performance_level: 'average',
        overall_completeness: 55,
      }),
    );
  });

  it('calls onInvestmentRecommendationsComplete with MOCK_INVESTMENT_DATA', async () => {
    const cbs = makeCallbacks();
    const promise = generateEvaluation('TestCo', null, cbs);
    await vi.runAllTimersAsync();
    await promise;

    expect(cbs.onInvestmentRecommendationsComplete).toHaveBeenCalledWith(MOCK_INV);
    expect(cbs.onInvestmentRecommendationsComplete.mock.calls[0][0].investment_readiness_summary.readiness_score).toBe(
      'Moderate',
    );
  });

  it('does not throw when investment callbacks are omitted', async () => {
    const cbs = {
      onCategoryStarted: vi.fn(),
      onCategoryComplete: vi.fn(),
      // investment callbacks intentionally omitted
      onStatus: vi.fn(),
    };
    const promise = generateEvaluation('TestCo', null, cbs);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toMatchObject({ success: true });
  });

  it('investment matching callbacks fire after all 10 category events (order)', async () => {
    const callOrder = [];
    const cbs = makeCallbacks({
      onCategoryComplete: vi.fn(() => callOrder.push('category')),
      onInvestmentMatchingStarted: vi.fn(() => callOrder.push('matching_started')),
      onInvestmentRecommendationsComplete: vi.fn(() => callOrder.push('recommendations')),
    });

    const promise = generateEvaluation('TestCo', null, cbs);
    await vi.runAllTimersAsync();
    await promise;

    // All 10 category events must precede investment_matching_started
    const firstMatchingIdx = callOrder.indexOf('matching_started');
    const lastCategoryIdx = callOrder.lastIndexOf('category');
    expect(firstMatchingIdx).toBeGreaterThan(lastCategoryIdx);

    // recommendations must come after matching_started
    const recIdx = callOrder.indexOf('recommendations');
    expect(recIdx).toBeGreaterThan(firstMatchingIdx);
  });
});

// ─── Real mode (SSE) ──────────────────────────────────────────────────────────

describe('generateEvaluation (real mode SSE)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs(); // ensure VITE_DIFY_MOCK is not set
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } } });
  });

  it('routes investment_matching_started event to onInvestmentMatchingStarted', async () => {
    mockFetchSsePhased(
      [MINIMAL_CATEGORY_EVENT],
      [{ type: 'investment_matching_started' }],
    );
    const cbs = makeCallbacks();

    await generateEvaluation('TestCo', null, cbs);

    expect(cbs.onInvestmentMatchingStarted).toHaveBeenCalledTimes(1);
    expect(cbs.onMaturityCalculated).not.toHaveBeenCalled();
  });

  it('routes maturity_calculated event to onMaturityCalculated with data', async () => {
    const maturityData = {
      maturity_score: 450,
      maturity_stage: 'growth',
      maturity_label: 'Growth (401-600)',
      performance_level: 'strong',
      performance_label: 'Strong',
      overall_completeness: 72,
    };
    mockFetchSsePhased(
      [MINIMAL_CATEGORY_EVENT],
      [{ type: 'maturity_calculated', data: maturityData }],
    );
    const cbs = makeCallbacks();

    await generateEvaluation('TestCo', null, cbs);

    expect(cbs.onMaturityCalculated).toHaveBeenCalledWith(maturityData);
  });

  it('routes investment_recommendations_complete event to onInvestmentRecommendationsComplete', async () => {
    const recData = {
      investment_readiness_summary: { assessment: 'Test', primary_recommendation: 'Seed', readiness_score: 'High' },
      recommended_funding: [],
      conditional_options: [],
      improvement_roadmap: [],
      not_recommended: [],
      next_steps: [],
    };
    mockFetchSsePhased(
      [MINIMAL_CATEGORY_EVENT],
      [{ type: 'investment_recommendations_complete', data: recData }],
    );
    const cbs = makeCallbacks();

    await generateEvaluation('TestCo', null, cbs);

    expect(cbs.onInvestmentRecommendationsComplete).toHaveBeenCalledWith(recData);
  });

  it('handles all three investment events in a single Phase 2 stream', async () => {
    const maturityData = { maturity_score: 320, maturity_stage: 'early_traction', overall_completeness: 55 };
    mockFetchSsePhased(
      [MINIMAL_CATEGORY_EVENT],
      [
        { type: 'investment_matching_started' },
        { type: 'maturity_calculated', data: maturityData },
        { type: 'investment_recommendations_complete', data: MOCK_INV },
        { type: 'workflow_complete', metadata: { total_tokens: 1000, elapsed_time: 30 } },
      ],
    );
    const cbs = makeCallbacks();

    const result = await generateEvaluation('TestCo', null, cbs);

    expect(cbs.onInvestmentMatchingStarted).toHaveBeenCalledTimes(1);
    expect(cbs.onMaturityCalculated).toHaveBeenCalledWith(maturityData);
    expect(cbs.onInvestmentRecommendationsComplete).toHaveBeenCalledWith(MOCK_INV);
    expect(result).toMatchObject({ success: true, metadata: { total_tokens: 1000 } });
  });

  it('does not call investment callbacks when they are absent from callbacks object', async () => {
    mockFetchSse([
      { type: 'investment_matching_started' },
      { type: 'maturity_calculated', data: {} },
      { type: 'investment_recommendations_complete', data: MOCK_INV },
    ]);

    // No investment callbacks provided — should not throw
    await expect(
      generateEvaluation('TestCo', null, {
        onCategoryStarted: vi.fn(),
        onCategoryComplete: vi.fn(),
        onError: vi.fn(),
        onStatus: vi.fn(),
      }),
    ).resolves.toMatchObject({ success: true });
  });
});
