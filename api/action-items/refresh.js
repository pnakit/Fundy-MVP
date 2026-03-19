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
 *   actionItemIds?: string[]   // optional — if omitted, refreshes all non-completed items
 *   skipRecentMinutes?: number  // skip items refreshed within this many minutes (default 15)
 * }
 *
 * Response:
 * {
 *   results: { [actionItemId]: { status, confidence, summary, evidence_count, evidence, refreshed_at } },
 *   skipped?: string[],
 *   mock?: boolean
 * }
 */

import { verifyAuth } from '../_auth.js';
import { getSupabaseAdmin } from '../_supabase.js';
import { generateEmbeddings } from '../knowledge/_embeddings.js';
import { semanticSearch } from '../knowledge/_knowledgeBase.js';
import { analyzeActionItem } from './_analyze.js';

const SEARCH_TOP_K = 5;
const SEARCH_THRESHOLD = 0.5;
const MAX_CONCURRENT_LLM = 10;
const DEFAULT_SKIP_RECENT_MINUTES = 15;
const MAX_EVIDENCE_SNIPPET_LENGTH = 200;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const userId = auth.user.sub;
  const { actionItemIds, skipRecentMinutes } = req.body || {};
  const skipMinutes = typeof skipRecentMinutes === 'number' ? skipRecentMinutes : DEFAULT_SKIP_RECENT_MINUTES;

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

  const { data: allItems, error: loadError } = await query;

  if (loadError) {
    console.error('[action-items/refresh] Failed to load action items:', loadError.message);
    return res.status(500).json({ error: `Failed to load action items: ${loadError.message}` });
  }

  if (!allItems || allItems.length === 0) {
    return res.status(200).json({ results: {} });
  }

  // P2: Skip items refreshed recently (staleness check)
  const cutoff = new Date(Date.now() - skipMinutes * 60 * 1000).toISOString();
  const skipped = [];
  const items = allItems.filter((item) => {
    const refreshedAt = item.custom_data?.refresh?.refreshed_at;
    if (refreshedAt && refreshedAt > cutoff) {
      skipped.push(item.id);
      return false;
    }
    return true;
  });

  if (items.length === 0) {
    return res.status(200).json({ results: {}, skipped });
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
          .then((results) =>
            // A2: Filter out self-referencing evidence — action item chat exchanges about
            // this item are not proof the gap has been closed
            results.filter((r) => r.metadata?.actionItemId !== item.id),
          )
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
              evidence: evidence.map((e) => ({
                content: e.content?.slice(0, MAX_EVIDENCE_SNIPPET_LENGTH) || '',
                source_type: e.source_type,
                score: e.score,
              })),
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

    return res.status(200).json({ results, ...(skipped.length > 0 && { skipped }) });
  } catch (err) {
    console.error('[action-items/refresh] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Persist refresh results into the custom_data column of each action item.
 * Reads existing custom_data first and merges to avoid overwriting other fields.
 */
async function persistResults(supabase, userId, results) {
  const ids = Object.keys(results);
  if (ids.length === 0) return;

  // Read current custom_data for all items in one query
  const { data: rows, error: readError } = await supabase
    .from('action_items')
    .select('id, custom_data')
    .eq('user_id', userId)
    .in('id', ids);

  if (readError) {
    console.error('[action-items/refresh] Failed to read custom_data for merge:', readError.message);
  }

  const existingData = new Map((rows || []).map((r) => [r.id, r.custom_data || {}]));

  const updates = Object.entries(results).map(([id, refreshResult]) => {
    const merged = { ...existingData.get(id), refresh: refreshResult };
    return supabase
      .from('action_items')
      .update({ custom_data: merged, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .then(({ error }) => {
        if (error) console.error(`[action-items/refresh] Failed to persist result for ${id}:`, error.message);
      });
  });
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
