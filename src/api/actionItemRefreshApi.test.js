/**
 * Tests for actionItemRefreshApi.js — client-side refresh wrapper.
 *
 * Key invariants:
 * - Mock mode returns valid structure without network call
 * - 404 fallback to mock (dev mode without Vercel)
 * - Auth header included in request
 * - Network errors throw with user-friendly message
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockGetSession = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
  },
}));

import { refreshActionItems } from './actionItemRefreshApi';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockAuth(token = 'test-jwt-token') {
  mockGetSession.mockResolvedValue({ data: { session: { access_token: token } } });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('refreshActionItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_DIFY_MOCK', 'false');
  });

  it('returns mock results when VITE_DIFY_MOCK is true', async () => {
    vi.stubEnv('VITE_DIFY_MOCK', 'true');

    const result = await refreshActionItems(['item-1', 'item-2']);

    expect(result.mock).toBe(true);
    expect(result.results['item-1']).toHaveProperty('status');
    expect(result.results['item-1']).toHaveProperty('confidence');
    expect(result.results['item-1']).toHaveProperty('refreshed_at');
    expect(result.results['item-2']).toHaveProperty('status');
  });

  it('includes auth header in request', async () => {
    mockAuth('my-jwt');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ results: {} }),
    });

    await refreshActionItems(['item-1']);

    const [_url, opts] = globalThis.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer my-jwt');
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('falls back to mock on 404 (dev mode)', async () => {
    mockAuth();
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await refreshActionItems(['item-1']);

    expect(result.mock).toBe(true);
    expect(result.results['item-1']).toHaveProperty('status');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Endpoint not found'));
    consoleSpy.mockRestore();
  });

  it('throws on network error with user-friendly message', async () => {
    mockAuth();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(refreshActionItems(['item-1'])).rejects.toThrow('Network error');
    consoleSpy.mockRestore();
  });

  it('throws on non-404 error responses', async () => {
    mockAuth();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal server error' }),
    });

    await expect(refreshActionItems(['item-1'])).rejects.toThrow('Internal server error');
  });
});
