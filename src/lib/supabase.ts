import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
  throw new Error('[nayba] VITE_SUPABASE_URL is not set. See .env.example.');
}
if (!supabaseAnonKey || supabaseAnonKey === 'placeholder') {
  throw new Error('[nayba] VITE_SUPABASE_ANON_KEY is not set. See .env.example.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
