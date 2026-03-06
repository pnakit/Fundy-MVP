/**
 * Data access layer — thin adapter wrapping supabase-js.
 *
 * Phase 1: Auth methods (sign-in, OTP, sign-out, session).
 * Phase 2: Data reads + writes for summary, evaluation, investments, action items.
 */

import { supabase } from './supabaseClient';

// ─── Auth ────────────────────────────────────────────────────────────

/**
 * Send a magic link / OTP code to the user's email.
 * Supabase will send an email with a 6-digit code.
 */
export async function signInWithOtp(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
}

/**
 * Verify the OTP code the user received via email.
 * On success, Supabase sets the session (JWT stored in localStorage).
 */
export async function verifyOtp(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) throw error;
  return data;
}

/**
 * Sign out the current user. Clears the session from localStorage.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get the current session (contains user + JWT).
 * Returns null if not authenticated.
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Get the current user from the session.
 * Returns null if not authenticated.
 */
export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

/**
 * Subscribe to auth state changes (sign in, sign out, token refresh).
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return data.subscription.unsubscribe;
}

// ─── Onboarding Summary ──────────────────────────────────────────────

/**
 * Load the current user's saved onboarding summary.
 * Returns null if none exists (first-time user).
 */
export async function loadOnboardingSummary() {
  const { data } = await supabase
    .from('onboarding_summaries')
    .select('summary_data, onboarding_phase')
    .single();
  return data ? { summaryData: data.summary_data, phase: data.onboarding_phase } : null;
}

// ─── Evaluation ───────────────────────────────────────────────────────

/**
 * Load the current user's saved evaluation result.
 * Returns null if no evaluation has been run yet.
 */
export async function loadEvaluation() {
  const { data } = await supabase
    .from('evaluations')
    .select('maturity_stage, dimensions, performance_metrics')
    .single();
  return data || null;
}

// ─── Investments ──────────────────────────────────────────────────────

/**
 * Load the IDs of investments the user has selected.
 * Returns an array of investment_type strings.
 */
export async function loadInvestmentSelections() {
  const { data } = await supabase
    .from('investment_selections')
    .select('investment_type')
    .eq('selected', true);
  return data?.map((r) => r.investment_type) || [];
}

/**
 * Upsert an investment selection for the current user.
 * @param {string} investmentType - The investment ID
 * @param {boolean} selected - Whether it is selected
 */
export async function upsertInvestmentSelection(investmentType, selected) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return;
  const { error } = await supabase.from('investment_selections').upsert(
    { user_id: userData.user.id, investment_type: investmentType, selected },
    { onConflict: 'user_id,investment_type' },
  );
  if (error) console.error('[dataAccess] upsertInvestmentSelection failed:', error.message);
}

// ─── Action Items ─────────────────────────────────────────────────────

/**
 * Load all action items for the current user, ordered by creation time.
 */
export async function loadActionItems() {
  const { data } = await supabase.from('action_items').select('*').order('created_at');
  return data || [];
}

/**
 * Upsert an action item. Uses item.id as the primary key so re-saving is idempotent.
 * @param {object} item - Action item state object
 * @param {string} userId - Supabase user ID
 */
export async function saveActionItem(item, userId) {
  const { error } = await supabase.from('action_items').upsert(
    {
      id: item.id,
      user_id: userId,
      title: item.title,
      description: item.description || null,
      priority: item.priority || null,
      status: item.status || 'pending',
      source_type: item.sourceType || null,
      source_id: item.sourceId || null,
      dimension_id: item.dimensionId || null,
      action_key: item.actionKey || null,
      file_ids: [],
      custom_data: {},
    },
    { onConflict: 'id' },
  );
  if (error) console.error('[dataAccess] saveActionItem failed:', error.message);
}

/**
 * Update the status of an action item.
 * @param {string} itemId - Action item UUID
 * @param {string} status - 'pending' | 'in-progress' | 'completed'
 */
export async function updateActionItemStatus(itemId, status) {
  const { error } = await supabase.from('action_items').update({ status }).eq('id', itemId);
  if (error) console.error('[dataAccess] updateActionItemStatus failed:', error.message);
}

/**
 * Delete all action items whose source_id matches the given value.
 * Used when an investment is deselected to remove its generated actions.
 * @param {string} sourceId - The investment ID
 */
export async function deleteActionItemsBySourceId(sourceId) {
  const { error } = await supabase.from('action_items').delete().eq('source_id', sourceId);
  if (error) console.error('[dataAccess] deleteActionItemsBySourceId failed:', error.message);
}
