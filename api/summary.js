/**
 * POST /api/summary
 *
 * Persists the onboarding summary for the authenticated user and embeds it
 * into the vector store so KB search can retrieve user-specific content.
 *
 * Auth: User JWT (via _auth.js)
 *
 * Request body:
 * {
 *   onboardingSummary: object (with categories array),
 *   onboardingPhase: string (default: 'summary')
 * }
 *
 * Response:
 * {
 *   success: true,
 *   summaryId: string (UUID),
 *   chunksEmbedded: number
 * }
 *
 * Embedding failure is non-fatal — summary is saved and 200 is returned even
 * if OpenAI is unavailable. chunksEmbedded will be 0 in that case.
 */

import { verifyAuth } from './_auth.js';
import { getSupabaseAdmin } from './_supabase.js';
import { chunkSummary, chunkConversation } from './_chunking.js';
import { generateEmbeddings } from './knowledge/_embeddings.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const userId = auth.user.sub;
  const { onboardingSummary, onboardingPhase = 'summary' } = req.body;

  if (!onboardingSummary?.categories || !Array.isArray(onboardingSummary.categories)) {
    return res.status(400).json({ error: 'onboardingSummary with categories array is required' });
  }

  const supabase = getSupabaseAdmin();

  // Step 1: Upsert summary (one row per user)
  const { data: summaryRow, error: upsertErr } = await supabase
    .from('onboarding_summaries')
    .upsert(
      { user_id: userId, summary_data: onboardingSummary, onboarding_phase: onboardingPhase },
      { onConflict: 'user_id' },
    )
    .select('id')
    .single();

  if (upsertErr) {
    console.error('[summary] Failed to upsert summary:', upsertErr.message);
    return res.status(500).json({ error: `Failed to save summary: ${upsertErr.message}` });
  }

  const summaryId = summaryRow.id;

  // Step 2: Chunk + embed (non-fatal if OpenAI is unavailable)
  let chunksEmbedded = 0;
  try {
    const chunks = chunkSummary(onboardingSummary);

    if (chunks.length > 0) {
      const texts = chunks.map((c) => c.content);
      const embeddings = await generateEmbeddings(texts);

      const rows = chunks.map((chunk, i) => ({
        user_id: userId,
        source_type: 'summary',
        source_id: summaryId,
        chunk_index: chunk.chunk_index ?? i,
        content: chunk.content,
        embedding: JSON.stringify(embeddings[i]),
        metadata: chunk.metadata || {},
      }));

      const { error: embedErr } = await supabase
        .from('document_embeddings')
        .upsert(rows, { onConflict: 'source_type,source_id,chunk_index' });

      if (embedErr) {
        console.error('[summary] Failed to upsert embeddings:', embedErr.message);
      } else {
        chunksEmbedded = rows.length;
      }
    }
  } catch (embedEx) {
    console.error('[summary] Embedding step failed (summary still saved):', embedEx.message);
  }

  // Step 3: Embed onboarding conversation messages (non-fatal)
  let conversationChunksEmbedded = 0;
  try {
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('workflow', 'onboarding')
      .single();

    if (conv) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conv.id)
        .order('created_at');

      if (msgs?.length > 0) {
        const chunks = chunkConversation(msgs, { workflow: 'onboarding' });

        if (chunks.length > 0) {
          const texts = chunks.map((c) => c.content);
          const embeddings = await generateEmbeddings(texts);

          const rows = chunks.map((chunk, i) => ({
            user_id: userId,
            source_type: 'conversation',
            source_id: conv.id,
            chunk_index: chunk.chunk_index ?? i,
            content: chunk.content,
            embedding: JSON.stringify(embeddings[i]),
            metadata: chunk.metadata || {},
          }));

          const { error: convEmbedErr } = await supabase
            .from('document_embeddings')
            .upsert(rows, { onConflict: 'source_type,source_id,chunk_index' });

          if (convEmbedErr) {
            console.error('[summary] Failed to upsert conversation embeddings:', convEmbedErr.message);
          } else {
            conversationChunksEmbedded = rows.length;
          }
        }
      }
    }
  } catch (convEmbedEx) {
    console.error('[summary] Conversation embedding failed (non-fatal):', convEmbedEx.message);
  }

  return res.status(200).json({ success: true, summaryId, chunksEmbedded, conversationChunksEmbedded });
}
