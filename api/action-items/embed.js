/**
 * POST /api/action-items/embed
 *
 * Embeds an action item chat exchange into the knowledge base so that
 * uploaded documents and conversation content enrich future evaluations.
 *
 * Auth: User JWT (via _auth.js)
 *
 * Request body:
 * {
 *   conversationDbId: string (UUID — Supabase conversation row ID),
 *   actionItemId:     string (UUID — the action item this exchange belongs to),
 *   userMessage:      string,
 *   assistantMessage: string,
 *   metadata?:        object (e.g. { actionTitle, sourceType, sourceId })
 * }
 */

import { verifyAuth } from '../_auth.js';
import { getSupabaseAdmin } from '../_supabase.js';
import { generateEmbeddings } from '../knowledge/embeddings.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const userId = auth.user.sub;
  const { conversationDbId, actionItemId, userMessage, assistantMessage, metadata = {} } = req.body;

  if (!actionItemId || !userMessage || !assistantMessage) {
    return res.status(400).json({ error: 'actionItemId, userMessage, and assistantMessage are required' });
  }

  // Combine user + assistant as a single chunk for semantic retrieval
  const content = `Q: ${userMessage}\nA: ${assistantMessage}`;

  try {
    const [embedding] = await generateEmbeddings([content]);
    const supabase = getSupabaseAdmin();

    // Use actionItemId as the source_id so we can look up all chunks for a given item.
    // chunk_index is the current timestamp (ms) to avoid collisions across multiple exchanges.
    const chunkIndex = Date.now();

    const { error } = await supabase.from('document_embeddings').upsert(
      [
        {
          user_id: userId,
          source_type: 'conversation',
          source_id: conversationDbId || actionItemId,
          chunk_index: chunkIndex,
          content,
          embedding: JSON.stringify(embedding),
          metadata: { actionItemId, ...metadata },
        },
      ],
      { onConflict: 'source_type,source_id,chunk_index' },
    );

    if (error) {
      return res.status(500).json({ error: `Failed to store embedding: ${error.message}` });
    }

    return res.status(200).json({ stored: 1, source_id: conversationDbId || actionItemId });
  } catch (err) {
    console.error('[action-items/embed] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
