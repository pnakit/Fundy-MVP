/**
 * Data access layer — thin adapter wrapping supabase-js.
 *
 * Phase 1: Auth methods only.
 * Later phases will add conversations, evaluations, action items, files, vectors.
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
