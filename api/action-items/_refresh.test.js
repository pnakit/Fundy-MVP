/**
 * Tests for refresh.js — action item refresh endpoint.
 *
 * Key invariants:
 * - Auth required (401 on missing/invalid JWT)
 * - Empty action items → empty results
 * - Partial LLM failures don't block other items
 * - Mock mode when OPENAI_API_KEY is missing
 * - Results are persisted to custom_data column
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockVerifyAuth = vi.fn();
const mockGetSupabaseAdmin = vi.fn();
const mockGenerateEmbeddings = vi.fn();
const mockSemanticSearch = vi.fn();
const mockAnalyzeActionItem = vi.fn();

vi.mock('../_auth.js', () => ({ verifyAuth: (...args) => mockVerifyAuth(...args) }));
vi.mock('../_supabase.js', () => ({ getSupabaseAdmin: () => mockGetSupabaseAdmin() }));
vi.mock('../knowledge/_embeddings.js', () => ({ generateEmbeddings: (...args) => mockGenerateEmbeddings(...args) }));
vi.mock('../knowledge/_knowledgeBase.js', () => ({ semanticSearch: (...args) => mockSemanticSearch(...args) }));
vi.mock('./_analyze.js', () => ({ analyzeActionItem: (...args) => mockAnalyzeActionItem(...args) }));

import handler from './refresh.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReq(body = {}) {
  return { method: 'POST', body };
}

function makeRes() {
  const res = {
    _status: null,
    _json: null,
    status(code) { res._status = code; return res; },
    json(data) { res._json = data; return res; },
  };
  return res;
}

const ITEMS = [
  { id: 'item-1', title: 'Build financial model', description: 'Create projections', priority: 'high', status: 'pending', custom_data: {} },
  { id: 'item-2', title: 'Hire CTO', description: 'Find technical co-founder', priority: 'medium', status: 'pending', custom_data: {} },
];

function mockSupabaseQuery(items = ITEMS) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    then: vi.fn((fn) => fn({ error: null })),
  };
  // Final query resolution
  chain.neq.mockResolvedValue({ data: items, error: null });
  chain.in.mockResolvedValue({ data: items, error: null });

  const supabase = {
    from: vi.fn().mockReturnValue(chain),
    _chain: chain,
  };
  mockGetSupabaseAdmin.mockReturnValue(supabase);
  return supabase;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/action-items/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('returns 405 for non-POST requests', async () => {
    const req = { method: 'GET' };
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  it('returns 401 when auth fails', async () => {
    mockVerifyAuth.mockResolvedValue({ error: 'Unauthorized', status: 401 });
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(401);
    expect(res._json.error).toBe('Unauthorized');
  });

  it('returns empty results when no action items found', async () => {
    mockVerifyAuth.mockResolvedValue({ user: { sub: 'user-1' } });
    mockSupabaseQuery([]);
    // Override neq to return empty
    const supabase = mockGetSupabaseAdmin();
    supabase.from().neq.mockResolvedValue({ data: [], error: null });

    const res = makeRes();
    await handler(makeReq(), res);
    expect(res._status).toBe(200);
    expect(res._json.results).toEqual({});
  });

  it('returns mock results when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    mockVerifyAuth.mockResolvedValue({ user: { sub: 'user-1' } });
    mockSupabaseQuery();

    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json.mock).toBe(true);
    expect(Object.keys(res._json.results)).toHaveLength(2);
    expect(res._json.results['item-1']).toHaveProperty('status');
    expect(res._json.results['item-1']).toHaveProperty('confidence');
    expect(res._json.results['item-1']).toHaveProperty('refreshed_at');
  });

  it('runs full pipeline: embed → search → analyze → persist', async () => {
    mockVerifyAuth.mockResolvedValue({ user: { sub: 'user-1' } });
    mockSupabaseQuery();

    mockGenerateEmbeddings.mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]);
    mockSemanticSearch.mockResolvedValue([{ content: 'Revenue data from onboarding', score: 0.8 }]);
    mockAnalyzeActionItem.mockResolvedValue({ status: 'addressed', confidence: 0.9, summary: 'Found evidence.' });

    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json.results['item-1'].status).toBe('addressed');
    expect(res._json.results['item-1'].confidence).toBe(0.9);
    expect(res._json.results['item-1'].evidence_count).toBe(1);
    expect(res._json.results['item-2'].status).toBe('addressed');

    // Verify batch embedding was called with both queries
    expect(mockGenerateEmbeddings).toHaveBeenCalledTimes(1);
    expect(mockGenerateEmbeddings).toHaveBeenCalledWith([
      'Build financial model. Create projections',
      'Hire CTO. Find technical co-founder',
    ]);

    // Verify semantic search was called for each item
    expect(mockSemanticSearch).toHaveBeenCalledTimes(2);
  });

  it('handles partial LLM failures gracefully', async () => {
    mockVerifyAuth.mockResolvedValue({ user: { sub: 'user-1' } });
    mockSupabaseQuery();

    mockGenerateEmbeddings.mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]);
    mockSemanticSearch.mockResolvedValue([{ content: 'Some evidence', score: 0.7 }]);

    // First item succeeds, second fails
    mockAnalyzeActionItem
      .mockResolvedValueOnce({ status: 'addressed', confidence: 0.85, summary: 'Found.' })
      .mockRejectedValueOnce(new Error('Rate limited'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    // First item succeeded
    expect(res._json.results['item-1'].status).toBe('addressed');
    // Second item got fallback
    expect(res._json.results['item-2'].status).toBe('insufficient_evidence');
    expect(res._json.results['item-2'].summary).toContain('failed');

    consoleSpy.mockRestore();
  });

  it('handles search failures gracefully (returns empty evidence)', async () => {
    mockVerifyAuth.mockResolvedValue({ user: { sub: 'user-1' } });
    mockSupabaseQuery([ITEMS[0]]); // single item

    mockGenerateEmbeddings.mockResolvedValue([[0.1, 0.2]]);
    mockSemanticSearch.mockRejectedValue(new Error('DB connection lost'));
    mockAnalyzeActionItem.mockResolvedValue({ status: 'insufficient_evidence', confidence: 0, summary: 'No evidence.' });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    // Search failed → empty evidence passed to analyze
    expect(mockAnalyzeActionItem).toHaveBeenCalledWith(ITEMS[0], []);

    consoleSpy.mockRestore();
  });

  it('filters by actionItemIds when provided', async () => {
    mockVerifyAuth.mockResolvedValue({ user: { sub: 'user-1' } });
    const supabase = mockSupabaseQuery([ITEMS[0]]);

    mockGenerateEmbeddings.mockResolvedValue([[0.1, 0.2]]);
    mockSemanticSearch.mockResolvedValue([]);
    mockAnalyzeActionItem.mockResolvedValue({ status: 'insufficient_evidence', confidence: 0, summary: 'Nothing.' });

    const res = makeRes();
    await handler(makeReq({ actionItemIds: ['item-1'] }), res);

    expect(res._status).toBe(200);
    // Verify .in() was called instead of .neq()
    expect(supabase.from().in).toHaveBeenCalledWith('id', ['item-1']);
  });

  it('includes evidence snippets in results (A4)', async () => {
    mockVerifyAuth.mockResolvedValue({ user: { sub: 'user-1' } });
    mockSupabaseQuery([ITEMS[0]]);

    mockGenerateEmbeddings.mockResolvedValue([[0.1, 0.2]]);
    mockSemanticSearch.mockResolvedValue([
      { content: 'Revenue data from onboarding chat', score: 0.85, source_type: 'summary' },
    ]);
    mockAnalyzeActionItem.mockResolvedValue({ status: 'addressed', confidence: 0.9, summary: 'Found revenue data.' });

    const res = makeRes();
    await handler(makeReq({ actionItemIds: ['item-1'] }), res);

    expect(res._status).toBe(200);
    const result = res._json.results['item-1'];
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].content).toBe('Revenue data from onboarding chat');
    expect(result.evidence[0].source_type).toBe('summary');
    expect(result.evidence[0].score).toBe(0.85);
  });

  it('truncates long evidence snippets to MAX_EVIDENCE_SNIPPET_LENGTH (A4)', async () => {
    mockVerifyAuth.mockResolvedValue({ user: { sub: 'user-1' } });
    mockSupabaseQuery([ITEMS[0]]);

    const longContent = 'x'.repeat(500);
    mockGenerateEmbeddings.mockResolvedValue([[0.1, 0.2]]);
    mockSemanticSearch.mockResolvedValue([{ content: longContent, score: 0.7, source_type: 'file' }]);
    mockAnalyzeActionItem.mockResolvedValue({ status: 'not_addressed', confidence: 0.3, summary: 'No match.' });

    const res = makeRes();
    await handler(makeReq({ actionItemIds: ['item-1'] }), res);

    expect(res._json.results['item-1'].evidence[0].content).toHaveLength(200);
  });

  it('filters out self-referencing evidence before LLM analysis (A2)', async () => {
    mockVerifyAuth.mockResolvedValue({ user: { sub: 'user-1' } });
    mockSupabaseQuery([ITEMS[0]]);

    mockGenerateEmbeddings.mockResolvedValue([[0.1, 0.2]]);
    // Return two chunks: one self-referencing (actionItemId matches item), one external
    mockSemanticSearch.mockResolvedValue([
      { content: 'User asked: how do I build this? AI: here is how.', score: 0.9, source_type: 'conversation', metadata: { actionItemId: 'item-1' } },
      { content: 'Financial model attached in deck', score: 0.75, source_type: 'file', metadata: {} },
    ]);
    mockAnalyzeActionItem.mockResolvedValue({ status: 'partially_addressed', confidence: 0.6, summary: 'Partial.' });

    const res = makeRes();
    await handler(makeReq({ actionItemIds: ['item-1'] }), res);

    expect(res._status).toBe(200);
    // The self-referencing chunk must be excluded — analyzeActionItem should only see the file chunk
    expect(mockAnalyzeActionItem).toHaveBeenCalledWith(
      ITEMS[0],
      [{ content: 'Financial model attached in deck', score: 0.75, source_type: 'file', metadata: {} }],
    );
    expect(res._json.results['item-1'].evidence_count).toBe(1);
  });

  it('skips items refreshed within the staleness window (P2)', async () => {
    mockVerifyAuth.mockResolvedValue({ user: { sub: 'user-1' } });

    const recentTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
    const staleTimestamp = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago

    const recentItem = { ...ITEMS[0], custom_data: { refresh: { refreshed_at: recentTimestamp } } };
    const staleItem = { ...ITEMS[1], custom_data: { refresh: { refreshed_at: staleTimestamp } } };
    mockSupabaseQuery([recentItem, staleItem]);

    mockGenerateEmbeddings.mockResolvedValue([[0.1, 0.2]]);
    mockSemanticSearch.mockResolvedValue([]);
    mockAnalyzeActionItem.mockResolvedValue({ status: 'not_addressed', confidence: 0, summary: 'None.' });

    const res = makeRes();
    // Default skip window is 15 min — item-1 (5 min) is skipped, item-2 (30 min) is refreshed
    await handler(makeReq(), res);

    expect(res._status).toBe(200);
    expect(res._json.skipped).toContain('item-1');
    expect(res._json.results['item-2']).toBeDefined();
    expect(res._json.results['item-1']).toBeUndefined();
  });

  it('merges refresh result into existing custom_data without overwriting other fields (A1)', async () => {
    mockVerifyAuth.mockResolvedValue({ user: { sub: 'user-1' } });

    const itemWithData = { ...ITEMS[0], custom_data: { someUserNote: 'keep this', refresh: { status: 'not_addressed' } } };
    const supabase = mockSupabaseQuery([itemWithData]);

    mockGenerateEmbeddings.mockResolvedValue([[0.1, 0.2]]);
    mockSemanticSearch.mockResolvedValue([{ content: 'Revenue evidence', score: 0.8, source_type: 'summary', metadata: {} }]);
    mockAnalyzeActionItem.mockResolvedValue({ status: 'addressed', confidence: 0.95, summary: 'Addressed.' });

    const res = makeRes();
    await handler(makeReq({ actionItemIds: ['item-1'] }), res);

    expect(res._status).toBe(200);
    // Find the update call and verify it preserved someUserNote
    const updateCalls = supabase._chain.update.mock.calls;
    expect(updateCalls.length).toBeGreaterThan(0);
    const updatedData = updateCalls[updateCalls.length - 1][0];
    expect(updatedData.custom_data.someUserNote).toBe('keep this');
    expect(updatedData.custom_data.refresh.status).toBe('addressed');
  });
});
