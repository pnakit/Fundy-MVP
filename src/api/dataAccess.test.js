/**
 * Tests for the conversation/message persistence functions in dataAccess.js.
 * Auth and read functions (Phase 1 & 2) are covered by integration tests; these
 * focus on the Phase 3 conversation functions that have non-trivial branching.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase mock ────────────────────────────────────────────────────────────
// vi.mock is hoisted to the top of the file; use vi.hoisted() so the referenced
// variables are initialised before the factory function runs.

const { mockFrom, mockGetUser } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: mockFrom,
    auth: { getUser: mockGetUser },
  },
}));

// A fresh chainable query object — each method returns itself so chains work.
function makeChain(terminalOverrides = {}) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: terminalOverrides.single ?? vi.fn(),
    maybeSingle: terminalOverrides.maybeSingle ?? vi.fn(),
  };
  return chain;
}

// Import AFTER the mock is registered.
import {
  createConversation,
  updateConversationDifyId,
  saveMessages,
  loadMessages,
  loadOnboardingConversation,
  loadDeepDiveConversations,
  loadEvaluation,
} from './dataAccess';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-123';

function mockUser(id = USER_ID) {
  mockGetUser.mockResolvedValue({ data: { user: { id } }, error: null });
}

function mockNoUser() {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
}

// ─── loadEvaluation ───────────────────────────────────────────────────────────

describe('loadEvaluation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('selects investment_data along with other evaluation fields', async () => {
    const row = {
      maturity_stage: 'early_traction',
      dimensions: { product_technology: { completeness: 70 } },
      performance_metrics: { overall: 55 },
      investment_data: { investment_readiness_summary: { readiness_score: 'Moderate' } },
    };
    const chain = makeChain({ single: vi.fn().mockResolvedValue({ data: row }) });
    mockFrom.mockReturnValue(chain);

    const result = await loadEvaluation();

    expect(result).toEqual(row);
    expect(mockFrom).toHaveBeenCalledWith('evaluations');
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('investment_data'));
  });

  it('returns null when no evaluation exists yet', async () => {
    const chain = makeChain({ single: vi.fn().mockResolvedValue({ data: null }) });
    mockFrom.mockReturnValue(chain);

    const result = await loadEvaluation();

    expect(result).toBeNull();
  });

  it('returns data with null investment_data for users who ran evaluation before investment matching', async () => {
    const row = {
      maturity_stage: 'early_traction',
      dimensions: {},
      performance_metrics: {},
      investment_data: null,
    };
    const chain = makeChain({ single: vi.fn().mockResolvedValue({ data: row }) });
    mockFrom.mockReturnValue(chain);

    const result = await loadEvaluation();

    expect(result).toEqual(row);
    expect(result.investment_data).toBeNull();
  });
});

// ─── createConversation ───────────────────────────────────────────────────────

describe('createConversation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the new conversation UUID on success', async () => {
    mockUser();
    const chain = makeChain({ single: vi.fn().mockResolvedValue({ data: { id: 'conv-uuid' }, error: null }) });
    mockFrom.mockReturnValue(chain);

    const result = await createConversation('onboarding', null);

    expect(result).toBe('conv-uuid');
    expect(mockFrom).toHaveBeenCalledWith('conversations');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, workflow: 'onboarding', category_id: null }),
    );
  });

  it('passes category_id for deepdive workflow', async () => {
    mockUser();
    const chain = makeChain({ single: vi.fn().mockResolvedValue({ data: { id: 'conv-dd' }, error: null }) });
    mockFrom.mockReturnValue(chain);

    const result = await createConversation('deepdive', 'product_technology');

    expect(result).toBe('conv-dd');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ workflow: 'deepdive', category_id: 'product_technology' }),
    );
  });

  it('returns null when no authenticated user', async () => {
    mockNoUser();
    const result = await createConversation('onboarding');
    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns null and logs on DB error', async () => {
    mockUser();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const chain = makeChain({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'duplicate key' } }),
    });
    mockFrom.mockReturnValue(chain);

    const result = await createConversation('onboarding');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('createConversation failed'), 'duplicate key');
    consoleSpy.mockRestore();
  });
});

// ─── updateConversationDifyId ─────────────────────────────────────────────────

describe('updateConversationDifyId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates the dify_conversation_id column', async () => {
    const chain = makeChain();
    chain.eq.mockReturnValue({ error: null });
    mockFrom.mockReturnValue(chain);

    await updateConversationDifyId('conv-uuid', 'dify-id-abc');

    expect(mockFrom).toHaveBeenCalledWith('conversations');
    expect(chain.update).toHaveBeenCalledWith({ dify_conversation_id: 'dify-id-abc' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'conv-uuid');
  });

  it('logs on error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const chain = makeChain();
    chain.eq.mockReturnValue({ error: { message: 'not found' } });
    mockFrom.mockReturnValue(chain);

    await updateConversationDifyId('bad-id', 'dify-id');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('updateConversationDifyId failed'),
      'not found',
    );
    consoleSpy.mockRestore();
  });
});

// ─── saveMessages ─────────────────────────────────────────────────────────────

describe('saveMessages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts all message rows with correct fields', async () => {
    const chain = makeChain();
    chain.insert.mockReturnValue({ error: null });
    mockFrom.mockReturnValue(chain);

    await saveMessages('conv-uuid', USER_ID, [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ]);

    expect(chain.insert).toHaveBeenCalledWith([
      { conversation_id: 'conv-uuid', user_id: USER_ID, role: 'user', content: 'Hello' },
      { conversation_id: 'conv-uuid', user_id: USER_ID, role: 'assistant', content: 'Hi there' },
    ]);
  });

  it('logs on error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const chain = makeChain();
    chain.insert.mockReturnValue({ error: { message: 'RLS violation' } });
    mockFrom.mockReturnValue(chain);

    await saveMessages('conv-uuid', USER_ID, [{ role: 'user', content: 'test' }]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('saveMessages failed'), 'RLS violation');
    consoleSpy.mockRestore();
  });

  it('handles empty pairs array without error', async () => {
    const chain = makeChain();
    chain.insert.mockReturnValue({ error: null });
    mockFrom.mockReturnValue(chain);

    await saveMessages('conv-uuid', USER_ID, []);

    expect(chain.insert).toHaveBeenCalledWith([]);
  });
});

// ─── loadMessages ─────────────────────────────────────────────────────────────

describe('loadMessages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ordered messages for a conversation', async () => {
    const chain = makeChain();
    chain.order.mockResolvedValue({
      data: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ],
    });
    mockFrom.mockReturnValue(chain);

    const result = await loadMessages('conv-uuid');

    expect(result).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ]);
    expect(mockFrom).toHaveBeenCalledWith('messages');
    expect(chain.eq).toHaveBeenCalledWith('conversation_id', 'conv-uuid');
  });

  it('returns empty array when no messages exist', async () => {
    const chain = makeChain();
    chain.order.mockResolvedValue({ data: [] });
    mockFrom.mockReturnValue(chain);

    const result = await loadMessages('conv-uuid');

    expect(result).toEqual([]);
  });

  it('returns empty array when data is null', async () => {
    const chain = makeChain();
    chain.order.mockResolvedValue({ data: null });
    mockFrom.mockReturnValue(chain);

    const result = await loadMessages('conv-uuid');

    expect(result).toEqual([]);
  });
});

// ─── loadOnboardingConversation ───────────────────────────────────────────────

describe('loadOnboardingConversation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the conversation row when it exists', async () => {
    const row = { id: 'conv-uuid', dify_conversation_id: 'dify-123' };
    const chain = makeChain({ maybeSingle: vi.fn().mockResolvedValue({ data: row }) });
    mockFrom.mockReturnValue(chain);

    const result = await loadOnboardingConversation();

    expect(result).toEqual(row);
    expect(chain.eq).toHaveBeenCalledWith('workflow', 'onboarding');
  });

  it('returns null when no onboarding conversation exists', async () => {
    const chain = makeChain({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) });
    mockFrom.mockReturnValue(chain);

    const result = await loadOnboardingConversation();

    expect(result).toBeNull();
  });
});

// ─── loadDeepDiveConversations ────────────────────────────────────────────────

describe('loadDeepDiveConversations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty object when no deep-dive conversations exist', async () => {
    const chain = makeChain();
    chain.eq.mockResolvedValue({ data: [] });
    mockFrom.mockReturnValue(chain);

    const result = await loadDeepDiveConversations();

    expect(result).toEqual({});
  });

  it('returns null when DB returns null', async () => {
    const chain = makeChain();
    chain.eq.mockResolvedValue({ data: null });
    mockFrom.mockReturnValue(chain);

    const result = await loadDeepDiveConversations();

    expect(result).toEqual({});
  });

  it('returns map of category_id → conversation with messages', async () => {
    // First call: fetch conversations
    const convChain = makeChain();
    convChain.eq.mockResolvedValue({
      data: [
        { id: 'conv-1', category_id: 'product_technology', dify_conversation_id: 'dify-pt' },
      ],
    });

    // Second call: fetch messages for conv-1
    const msgChain = makeChain();
    msgChain.order.mockResolvedValue({
      data: [
        { role: 'user', content: 'Tell me more' },
        { role: 'assistant', content: 'Sure!' },
      ],
    });

    // mockFrom returns different chains per call
    mockFrom
      .mockReturnValueOnce(convChain)  // conversations fetch
      .mockReturnValueOnce(msgChain);  // messages fetch

    const result = await loadDeepDiveConversations();

    expect(result).toHaveProperty('product_technology');
    expect(result.product_technology.conversationDbId).toBe('conv-1');
    expect(result.product_technology.conversationId).toBe('dify-pt');
    expect(result.product_technology.messages).toHaveLength(2);
    expect(result.product_technology.messages[0]).toEqual({ role: 'user', content: 'Tell me more' });
  });

  it('skips categories with no messages', async () => {
    const convChain = makeChain();
    convChain.eq.mockResolvedValue({
      data: [{ id: 'conv-1', category_id: 'operations', dify_conversation_id: null }],
    });

    const msgChain = makeChain();
    msgChain.order.mockResolvedValue({ data: [] }); // no messages

    mockFrom.mockReturnValueOnce(convChain).mockReturnValueOnce(msgChain);

    const result = await loadDeepDiveConversations();

    expect(result).toEqual({});
  });
});
