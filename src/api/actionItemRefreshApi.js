/**
 * Client-side API wrapper for action item refresh.
 *
 * Calls POST /api/action-items/refresh or returns mock results
 * when VITE_DIFY_MOCK is true or the endpoint is unavailable (dev mode).
 */

import { supabase } from './supabaseClient';

/**
 * Get the current JWT for authenticated API calls.
 */
async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Check if we should use client-side mock mode.
 */
function shouldUseMock() {
  return import.meta.env.VITE_DIFY_MOCK === 'true';
}

/**
 * Refresh action item analysis by searching the vector DB and running LLM classification.
 *
 * @param {string[]} [actionItemIds] - Optional list of IDs to refresh. If omitted, refreshes all non-completed.
 * @returns {Promise<{ results: Object, mock?: boolean }>}
 */
export async function refreshActionItems(actionItemIds) {
  if (shouldUseMock()) {
    return generateMockResults(actionItemIds);
  }

  const authHeaders = await getAuthHeaders();

  let response;
  try {
    response = await fetch('/api/action-items/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ actionItemIds }),
    });
  } catch (err) {
    console.error('[actionItemRefreshApi] Network error:', err.message);
    throw new Error('Network error — please check your connection and try again.');
  }

  // 404 in dev (no Vercel serverless) → fall back to mock
  if (response.status === 404) {
    console.warn('[actionItemRefreshApi] Endpoint not found (dev mode?) — falling back to mock');
    return generateMockResults(actionItemIds);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Refresh failed (${response.status})`);
  }

  return response.json();
}

/**
 * Generate mock refresh results for development/testing.
 */
function generateMockResults(actionItemIds) {
  const statuses = ['addressed', 'partially_addressed', 'not_addressed', 'insufficient_evidence'];
  const summaries = [
    'Evidence found in onboarding conversation addressing this requirement.',
    'Partial information provided in deep-dive chat, but key details are missing.',
    'No relevant evidence found in any conversations or uploads.',
    'Insufficient data in knowledge base to make a determination.',
  ];

  const ids = actionItemIds || [];
  const results = {};
  for (const id of ids) {
    const idx = Math.floor(Math.random() * statuses.length);
    results[id] = {
      status: statuses[idx],
      confidence: Math.round(Math.random() * 100) / 100,
      summary: summaries[idx],
      evidence_count: Math.floor(Math.random() * 6),
      refreshed_at: new Date().toISOString(),
    };
  }

  return { results, mock: true };
}
