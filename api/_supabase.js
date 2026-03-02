import { createClient } from '@supabase/supabase-js';

let supabaseAdmin;

/**
 * Get the Supabase admin client (service_role key, bypasses RLS).
 * Lazily initialized and cached for the lifetime of the serverless function.
 */
export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    supabaseAdmin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseAdmin;
}
