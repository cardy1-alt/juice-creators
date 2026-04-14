import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
  throw new Error('[nayba] VITE_SUPABASE_URL is not set. See .env.example.');
}
if (!supabaseAnonKey || supabaseAnonKey === 'placeholder') {
  throw new Error('[nayba] VITE_SUPABASE_ANON_KEY is not set. See .env.example.');
}

// Snapshot the URL hash BEFORE creating the Supabase client. With
// detectSessionInUrl: true (the default), createClient processes any
// auth tokens in window.location.hash and strips them via history
// .replaceState before React even renders. Without this snapshot, the
// app loses the "type=recovery"/"type=invite" signal and treats the
// post-recovery sign-in as a normal sign-in (skipping the
// "set your password" UI). Read once, here, and export for App.tsx.
export const initialAuthHash =
  typeof window !== 'undefined' ? window.location.hash : '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
