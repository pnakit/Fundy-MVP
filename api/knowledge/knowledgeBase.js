/**
 * Knowledge base abstraction layer.
 * Provides a unified search interface that can swap between:
 *   - Internal Supabase pgvector (default)
 *   - External partner pgvector databases (future)
 *
 * Configuration is driven by environment variables and the app_config table.
 */

import { getSupabaseAdmin } from '../_supabase.js';

/**
 * @typedef {object} SearchResult
 * @property {string} content
 * @property {number} score - Similarity score (0-1)
 * @property {object} metadata
 * @property {string} [source_type]
 * @property {string} [source_id]
 * @property {number} [chunk_index]
 */

/**
 * @typedef {object} SearchOptions
 * @property {number} [topK=5]
 * @property {number} [threshold=0.7]
 * @property {string[]} [sourceTypes] - Filter by source_type ('conversation'|'file'|'summary')
 * @property {string} [userId] - Required for internal KB (RLS scoping)
 */

/**
 * Knowledge base configurations.
 * Internal config is built from environment variables.
 * External configs can be added here or loaded from app_config.
 */
function getKnowledgeBaseConfig(kbId) {
  if (kbId === 'internal' || !kbId) {
    return {
      id: 'internal',
      type: 'supabase',
      search: {
        dimensions: 1536,
        defaultTopK: 5,
        defaultThreshold: 0.7,
        distanceMetric: 'cosine',
        rpcFunctionName: 'search_embeddings',
      },
    };
  }

  // Future: load external KB configs from app_config table or env vars
  throw new Error(`Unknown knowledge base: ${kbId}`);
}

/**
 * Perform semantic search against a knowledge base.
 *
 * @param {number[]} embedding - Query embedding vector
 * @param {SearchOptions} options - Search options
 * @param {string} [kbId] - Knowledge base ID (defaults to ACTIVE_KNOWLEDGE_BASE env or 'internal')
 * @returns {Promise<SearchResult[]>}
 */
export async function semanticSearch(embedding, options = {}, kbId) {
  const resolvedKbId = kbId || process.env.ACTIVE_KNOWLEDGE_BASE || 'internal';
  const config = getKnowledgeBaseConfig(resolvedKbId);

  if (config.type === 'supabase') {
    return searchSupabase(embedding, options, config);
  }

  // Future: add 'postgres' adapter for external partner databases
  throw new Error(`Unsupported knowledge base type: ${config.type}`);
}

/**
 * Internal adapter: search via Supabase pgvector RPC function.
 */
async function searchSupabase(embedding, options, config) {
  const { topK = config.search.defaultTopK, threshold = config.search.defaultThreshold, sourceTypes, userId } = options;

  if (!userId) {
    throw new Error('userId is required for internal knowledge base search');
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc(config.search.rpcFunctionName, {
    p_user_id: userId,
    p_embedding: JSON.stringify(embedding),
    p_top_k: topK,
    p_similarity_threshold: threshold,
    p_source_types: sourceTypes || null,
  });

  if (error) {
    throw new Error(`Knowledge base search failed: ${error.message}`);
  }

  return (data || []).map((row) => ({
    content: row.content,
    score: row.similarity,
    metadata: row.metadata,
    source_type: row.source_type,
    source_id: row.source_id,
    chunk_index: row.chunk_index,
  }));
}

/**
 * Get the default knowledge base ID.
 */
export function getActiveKnowledgeBase() {
  return process.env.ACTIVE_KNOWLEDGE_BASE || 'internal';
}
