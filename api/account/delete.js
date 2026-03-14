/**
 * POST /api/account/delete
 *
 * Permanently deletes all data associated with the authenticated user.
 * The auth account (auth.users row) is preserved — the user stays logged in
 * and can start fresh on the next visit.
 *
 * Auth: User JWT (via _auth.js)
 * Request body: {} (empty — user ID comes entirely from the verified JWT)
 *
 * Response:
 *   200 { success: true, tablesCleared: N }
 *   207 { success: false, errors: [...] }  — partial failure, some tables cleared
 *   401 — auth failure
 */

import { verifyAuth } from '../_auth.js';
import { getSupabaseAdmin } from '../_supabase.js';

const DATA_TABLES = [
  'document_embeddings',
  'file_metadata',
  'action_items',
  'investment_selections',
  'investment_recommendations',
  // messages is handled separately (no direct user_id column)
  'conversations',
  'onboarding_summaries',
  'evaluations',
  'user_profiles',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const userId = auth.user.sub;
  const supabase = getSupabaseAdmin();
  const errors = [];

  // Delete messages first — no user_id column, must go via conversation IDs
  try {
    const { data: convRows } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId);

    if (convRows && convRows.length > 0) {
      const convIds = convRows.map((r) => r.id);
      const { error } = await supabase.from('messages').delete().in('conversation_id', convIds);
      if (error) errors.push(`messages: ${error.message}`);
    }
  } catch (err) {
    errors.push(`messages: ${err.message}`);
  }

  // Delete all other tables by user_id
  for (const table of DATA_TABLES) {
    try {
      const { error } = await supabase.from(table).delete().eq('user_id', userId);
      if (error) errors.push(`${table}: ${error.message}`);
    } catch (err) {
      errors.push(`${table}: ${err.message}`);
    }
  }

  // Audit log — insert regardless of partial errors so we always have a record
  try {
    await supabase.from('deletion_audit').insert({
      deleted_user_id: userId,
      deleted_at: new Date().toISOString(),
      deleted_by: 'user_request',
    });
  } catch (_err) {
    // Audit failure is non-blocking
  }

  if (errors.length > 0) {
    console.error('[account/delete] Partial failure for user', userId, errors);
    return res.status(207).json({ success: false, errors });
  }

  return res.status(200).json({ success: true, tablesCleared: DATA_TABLES.length + 1 }); // +1 for messages
}
