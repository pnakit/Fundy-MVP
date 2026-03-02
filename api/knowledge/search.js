import { verifyWebhook } from '../_webhookAuth.js';
import { generateEmbedding } from './embeddings.js';
import { semanticSearch } from './knowledgeBase.js';

/**
 * POST /api/knowledge/search
 *
 * Single-query vector search endpoint. Returns raw chunks with scores.
 * Designed for Dify iteration loops — call once per keyword/query,
 * review results, and aggregate in Dify before sending to LLM.
 *
 * Auth: webhook secret via X-Webhook-Secret header or ?secret= query param
 *
 * POST body (JSON):
 * {
 *   "user_id": "UUID",                     // Required — scopes search to user's data
 *   "query": "search terms",               // Required — what to search for
 *   "top_k": 5,                            // Optional — max chunks to return (default: 5)
 *   "threshold": 0.5,                      // Optional — min similarity 0-1 (default: 0.5)
 *   "source_types": ["conversation"]        // Optional — filter: conversation, file, summary
 * }
 *
 * Response:
 * {
 *   "query": "search terms",
 *   "results": [
 *     {
 *       "content": "User: We have a proprietary ML pipeline...",
 *       "score": 0.87,
 *       "source_type": "conversation",
 *       "source_id": "uuid",
 *       "chunk_index": 2,
 *       "metadata": { "workflow": "onboarding", ... }
 *     }
 *   ],
 *   "total": 3
 * }
 *
 * Usage in Dify:
 * 1. Define keywords as a list variable (or in a Code node)
 * 2. Use an Iteration node to loop through keywords
 * 3. Each iteration calls this endpoint with one keyword
 * 4. Check relevance (score threshold, or LLM judge)
 * 5. Append relevant results to an aggregated context variable
 * 6. After iteration, pass aggregated context to the LLM evaluation node
 */

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth
  const secretFromQuery = req.query?.secret;
  if (secretFromQuery) {
    req.headers = req.headers || {};
    req.headers['x-webhook-secret'] = secretFromQuery;
  }

  const auth = verifyWebhook(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  // Parse params
  let params;
  if (req.method === 'GET') {
    params = {
      user_id: req.query?.user_id,
      query: req.query?.query,
      top_k: req.query?.top_k ? parseInt(req.query.top_k, 10) : 5,
      threshold: req.query?.threshold ? parseFloat(req.query.threshold) : 0.5,
      source_types: req.query?.source_types?.split(','),
    };
  } else {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_e) { body = {}; }
    }
    params = {
      user_id: body?.user_id || req.query?.user_id,
      query: body?.query,
      top_k: body?.top_k || 5,
      threshold: body?.threshold || 0.5,
      source_types: body?.source_types,
    };
  }

  const { user_id, query, top_k, threshold, source_types } = params;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }
  if (!query) {
    return res.status(400).json({ error: 'query is required' });
  }

  try {
    const embedding = await generateEmbedding(query);
    const results = await semanticSearch(
      embedding,
      { topK: top_k, threshold, userId: user_id, sourceTypes: source_types || null },
    );

    return res.status(200).json({
      query,
      results: results.map((r) => ({
        content: r.content,
        score: r.score,
        source_type: r.source_type,
        source_id: r.source_id,
        chunk_index: r.chunk_index,
        metadata: r.metadata,
      })),
      total: results.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Search failed' });
  }
}
