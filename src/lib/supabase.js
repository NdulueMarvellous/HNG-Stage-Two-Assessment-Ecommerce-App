import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * True once real credentials are present in .env.
 * The UI shows a setup banner when this is false so the app never fails
 * silently on a fresh clone.
 */
export const isSupabaseConfigured =
  Boolean(url && anonKey) &&
  !String(url).includes('your-project-ref') &&
  !String(anonKey).includes('your-anon');

// Placeholders let the app boot and render (with the banner) instead of
// throwing while the client is being created.
export const supabase = createClient(
  isSupabaseConfigured ? url : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? anonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Needed so the ?code= returned by Google OAuth is picked up on /auth/callback
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
);