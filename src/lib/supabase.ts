import { createClient } from '@supabase/supabase-js';

// Configuration comes ONLY from environment variables (VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY). A hardcoded fallback used to point the browser at
// a different project than the server and caused sign-in failures.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your-anon-key'
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

export const getSupabaseConfigStatus = () => ({
  configured: isSupabaseConfigured,
  url: supabaseUrl ? `${supabaseUrl.substring(0, 16)}...` : 'غير محدد',
});
