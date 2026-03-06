/**
 * POST /api/evaluation/save
 *
 * Persists the completed evaluation results for the authenticated user.
 * Called by the client after the streaming evaluation finishes successfully.
 *
 * Auth: User JWT (via _auth.js)
 *
 * Request body:
 * {
 *   evaluationData: {
 *     companyName: string,
 *     overallMaturity: { level: number, name: string },
 *     overallPerformance: { score: number, label: string },
 *     description: string,
 *     dimensions: Array<{...}>
 *   }
 * }
 */

import { verifyAuth } from '../_auth.js';
import { getSupabaseAdmin } from '../_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const userId = auth.user.sub;
  const { evaluationData } = req.body;

  if (!evaluationData?.dimensions || !Array.isArray(evaluationData.dimensions)) {
    return res.status(400).json({ error: 'evaluationData with dimensions array is required' });
  }

  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from('evaluations').upsert(
    {
      user_id: userId,
      maturity_stage: {
        overallMaturity: evaluationData.overallMaturity,
        description: evaluationData.description,
        companyName: evaluationData.companyName,
      },
      dimensions: evaluationData.dimensions,
      performance_metrics: {
        overallPerformance: evaluationData.overallPerformance,
      },
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    console.error('[evaluation/save] Failed to upsert evaluation:', error.message);
    return res.status(500).json({ error: `Failed to save evaluation: ${error.message}` });
  }

  return res.status(200).json({ success: true });
}
