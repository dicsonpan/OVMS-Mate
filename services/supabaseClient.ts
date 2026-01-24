import { createClient } from '@supabase/supabase-js';

// In a real Vercel deployment, these are process.env.NEXT_PUBLIC_SUPABASE_URL 
// but for this standalone environment, we check if they exist or use placeholders.
// You MUST set these in your Vercel project settings.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export const isSupabaseConfigured = () => !!supabase;