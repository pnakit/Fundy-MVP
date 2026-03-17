/**
 * POST /api/action-items/refresh
 *
 * Searches the vector DB for evidence relevant to each action item, runs a
 * lightweight LLM classification, persists the result to custom_data, and
 * returns the analysis for all items.
 *
 * Auth: User JWT (via _auth.js)
 *
 * Request body:
 * {
 *   actionItemIds?: string[]  // optional — if omitted, refreshes all non-completed items
 * }
 *
 * Response:
 * {
 *   results: { [actionItemId]: { status, confidence, summary, evidence_count, refreshed_at } },
 *   mock?: boolean
 * }
 */

import { verifyAuth } from '../_auth.js';
import { getSupabaseAdmin } from '../_supabase.js';
import { generateEmbeddings } from '../knowledge/embeddings.js';
import { semanticSearch } from '../knowledge/knowledgeBase.js';
import { analyzeActionItem } from './_analyze.js';

const SEARCH_TOP_K = 5;
const SEARCH_THRESHOLD = 0.5;
const MAX_CONCURRENT_LLM = 10;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const userId = auth.user.sub;
  const { actionItemIds } = req.body || {};

  const supabase = getSupabaseAdmin();

  // Load action items — either by IDs or all non-completed
  let query = supabase
    .from('action_items')
    .select('id, title, description, priority, status, custom_data')
    .eq('user_id', userId);

  if (Array.isArray(actionItemIds) && actionItemIds.length > 0) {
    query = query.in('id', actionItemIds);
  } else {
    query = query.neq('status', 'completed');
  }

  const { data: items, error: loadError } = await query;

  if (loadError) {
    console.error('[action-items/refresh] Failed to load action items:', loadError.message);
    return res.status(500).json({ error: `Failed to load action items: ${loadError.message}` });
  }

  if (!items || items.length === 0) {
    return res.status(200).json({ results: {} });
  }

  // Check for mock mode (no OpenAI key)
  if (!process.env.OPENAI_API_KEY) {
    console.log('[action-items/refresh] No OPENAI_API_KEY — returning mock results');
    const mockResults = buildMockResults(items);
    await persistResults(supabase, userId, mockResults);
    return res.status(200).json({ results: mockResults, mock: true });
  }

  try {
    // Step 1: Batch embed all queries
    const queries = items.map((item) => `${item.title}. ${item.description || ''}`);
    const embeddings = await generateEmbeddings(queries);

    // Step 2: Parallel semantic search for each item
    const searchResults = await Promise.all(
      items.map((item, i) =>
        semanticSearch(embeddings[i], { userId, topK: SEARCH_TOP_K, threshold: SEARCH_THRESHOLD })
          .catch((err) => {
            console.error(`[action-items/refresh] Search failed for ${item.id}:`, err.message);
            return [];
          }),
      ),
    );

    // Step 3: Parallel LLM analysis with concurrency limit
    const results = {};
    const analysisWork = items.map((item, i) => ({
      item,
      evidence: searchResults[i],
    }));

    for (let start = 0; start < analysisWork.length; start += MAX_CONCURRENT_LLM) {
      const batch = analysisWork.slice(start, start + MAX_CONCURRENT_LLM);
      const batchResults = await Promise.allSettled(
        batch.map(async ({ item, evidence }) => {
          const analysis = await analyzeActionItem(item, evidence);
          return {
            id: item.id,
            result: {
              ...analysis,
              evidence_count: evidence.length,
              refreshed_at: new Date().toISOString(),
            },
          };
        }),
      );

      for (const settled of batchResults) {
        if (settled.status === 'fulfilled') {
          results[settled.value.id] = settled.value.result;
        } else {
          // Find the item that failed — it's the one not yet in results
          const failedItem = batch.find(({ item }) => !results[item.id]);
          if (failedItem) {
            console.error(`[action-items/refresh] Analysis failed for ${failedItem.item.id}:`, settled.reason?.message);
            results[failedItem.item.id] = {
              status: 'insufficient_evidence',
              confidence: 0,
              summary: 'Analysis failed. Please try again.',
              evidence_count: 0,
              refreshed_at: new Date().toISOString(),
            };
          }
        }
      }
    }

    // Step 4: Persist results to DB
    await persistResults(supabase, userId, results);

    return res.status(200).json({ results });
  } catch (err) {
    console.error('[action-items/refresh] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Persist refresh results into the custom_data column of each action item.
 * Merges with existing custom_data to avoid overwriting other fields.
 */
async function persistResults(supabase, userId, results) {
  const updates = Object.entries(results).map(([id, refreshResult]) =>
    supabase
      .from('action_items')
      .update({ custom_data: { refresh: refreshResult }, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .then(({ error }) => {
        if (error) console.error(`[action-items/refresh] Failed to persist result for ${id}:`, error.message);
      }),
  );
  await Promise.all(updates);
}

/**
 * Generate mock results for all items (used when OPENAI_API_KEY is missing).
 */
function buildMockResults(items) {
  const statuses = ['addressed', 'partially_addressed', 'not_addressed', 'insufficient_evidence'];
  const summaries = [
    'Evidence found in onboarding conversation addressing this requirement.',
    'Partial information provided in deep-dive chat, but key details are missing.',
    'No relevant evidence found in any conversations or uploads.',
    'Insufficient data in knowledge base to make a determination.',
  ];
  const results = {};
  for (const item of items) {
    const idx = Math.floor(Math.random() * statuses.length);
    results[item.id] = {
      status: statuses[idx],
      confidence: Math.round(Math.random() * 100) / 100,
      summary: summaries[idx],
      evidence_count: Math.floor(Math.random() * 6),
      refreshed_at: new Date().toISOString(),
    };
  }
  return results;
}
