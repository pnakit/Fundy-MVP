import { verifyWebhook } from '../_webhookAuth.js';
import { getSupabaseAdmin } from '../_supabase.js';
import { generateEmbeddings } from './embeddings.js';

/**
 * POST /api/knowledge/embed
 *
 * Embedding ingestion endpoint. Accepts text chunks, generates embeddings
 * via OpenAI, and upserts into the document_embeddings table.
 *
 * Auth: webhook secret (for internal/pipeline use, not frontend-facing)
 *
 * Request body:
 * {
 *   user_id: string (UUID),
 *   source_type: 'conversation' | 'file' | 'summary',
 *   source_id: string (UUID, optional),
 *   chunks: [{ content: string, chunk_index: number, metadata?: object }]
 * }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = verifyWebhook(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { user_id, source_type, source_id, chunks } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }
  if (!source_type) {
    return res.status(400).json({ error: 'source_type is required' });
  }
  if (!chunks || chunks.length === 0) {
    return res.status(400).json({ error: 'chunks array is required and must not be empty' });
  }

  try {
    // Batch generate embeddings for all chunks
    const texts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(texts);

    const supabase = getSupabaseAdmin();

    // Build rows for upsert
    const rows = chunks.map((chunk, i) => ({
      user_id,
      source_type,
      source_id: source_id || null,
      chunk_index: chunk.chunk_index ?? i,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[i]),
      metadata: chunk.metadata || {},
    }));

    const { error } = await supabase
      .from('document_embeddings')
      .upsert(rows, { onConflict: 'source_type,source_id,chunk_index' });

    if (error) {
      return res.status(500).json({ error: `Failed to store embeddings: ${error.message}` });
    }

    return res.status(200).json({
      stored: rows.length,
      source_type,
      source_id: source_id || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
