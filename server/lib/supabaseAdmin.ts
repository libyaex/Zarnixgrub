/**
 * Server-side Supabase client (service role).
 *
 * SECURITY RULES:
 * - Never import this module from frontend (src/**) code.
 * - SUPABASE_SERVICE_ROLE_KEY bypasses Row Level Security; it is read only
 *   from the server environment and never committed.
 *
 * NOTE: this module no longer throws at import time. A missing variable used
 * to crash the whole serverless function (every /api call returned 500 and the
 * app silently fell back to the login page). Now the server boots, /api/health
 * reports what is missing, and requireAuth answers with a clear error code.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

export const supabaseAdmin = createClient(
  SUPABASE_URL || 'http://127.0.0.1:54321',
  SERVICE_ROLE_KEY || 'service-role-key-not-configured',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/** Host only (never the key) — used by /api/health to detect project mismatch. */
export const SUPABASE_HOST = (() => {
  try {
    return SUPABASE_URL ? new URL(SUPABASE_URL).host : '';
  } catch {
    return 'invalid-url';
  }
})();

export { SUPABASE_URL };
