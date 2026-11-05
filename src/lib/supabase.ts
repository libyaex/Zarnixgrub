import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aiykqnnalulmoggparnc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpeWtxbm5hbHVsbW9nZ3Bhcm5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MjE1MTQsImV4cCI6MjEwOTM5NzUxNH0.kou2moLLd6qvHZgq4V_K4T60c-XMwmw0AzN-K90QCL0';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your-anon-key'
);

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export const getSupabaseConfigStatus = () => {
  return {
    configured: isSupabaseConfigured,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 16)}...` : 'غير محدد',
  };
};
