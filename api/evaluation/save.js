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
  const { evaluationData, actionItems: newActionItems = [], investmentRecommendations } = req.body;

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
      investment_data: investmentRecommendations || null,
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    console.error('[evaluation/save] Failed to upsert evaluation:', error.message);
    return res.status(500).json({ error: `Failed to save evaluation: ${error.message}` });
  }

  console.log(`[evaluation/save] Saved evaluation for user ${userId}, investment_data=${!!investmentRecommendations}`);

  // Merge evaluation action items — insert only new action_keys, preserve existing with user modifications
  let actionItemsAdded = 0;
  if (Array.isArray(newActionItems) && newActionItems.length > 0) {
    const { data: existing } = await supabase
      .from('action_items')
      .select('action_key')
      .eq('user_id', userId)
      .eq('source_type', 'evaluation')
      .not('action_key', 'is', null);

    const existingKeys = new Set((existing || []).map((r) => r.action_key));

    const toInsert = newActionItems
      .filter((item) => !item.actionKey || !existingKeys.has(item.actionKey))
      .map((item) => ({
        user_id: userId,
        title: item.title,
        description: item.description || '',
        priority: item.priority || 'medium',
        status: 'pending',
        source_type: 'evaluation',
        source_id: item.sourceId || null,
        dimension_id: item.dimensionId || null,
        action_key: item.actionKey || null,
        file_ids: [],
        custom_data: {},
      }));

    if (toInsert.length > 0) {
      const { error: actionErr } = await supabase.from('action_items').insert(toInsert);
      if (actionErr) {
        console.error('[evaluation/save] Failed to insert action items:', actionErr.message);
      } else {
        actionItemsAdded = toInsert.length;
        console.log(`[evaluation/save] Inserted ${actionItemsAdded} action items`);
      }
    }
  }

  return res.status(200).json({ success: true, actionItemsAdded });
}
