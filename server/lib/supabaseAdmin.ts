/**
 * Server-side Supabase client (service role).
 *
 * SECURITY RULES:
 * - This module must NEVER be imported from frontend (src/**) code.
 * - SUPABASE_SERVICE_ROLE_KEY bypasses Row Level Security; it is only
 *   read from the environment on the server and never committed.
 * - On Vercel, set these as encrypted environment variables.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    'Supabase is not configured. Set SUPABASE_URL (or VITE_SUPABASE_URL) ' +
      'and SUPABASE_SERVICE_ROLE_KEY as environment variables.'
  );
}

export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export { SUPABASE_URL };
