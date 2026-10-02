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
const resolvedUrl = isSupabaseConfigured ? url : 'https://placeholder.supabase.co';
const resolvedAnonKey = isSupabaseConfigured ? anonKey : 'placeholder-anon-key';

export const supabase = createClient(resolvedUrl, resolvedAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Needed so the ?code= returned by Google OAuth is picked up on /auth/callback
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

let authSettingsCache = null;

/**
 * Reads the project's public auth settings (`GET /auth/v1/settings`) so the UI
 * can tell which sign-in providers are actually switched on.
 *
 * This matters for Google. `signInWithOAuth()` navigates the whole browser to
 * Supabase's `/auth/v1/authorize` endpoint, and when the provider is disabled
 * Supabase *renders* a JSON error page as the response. The browser has already
 * left the app by then, so no try/catch of ours can ever see it - the shopper
 * just gets raw JSON. Asking first keeps them inside our own error UI.
 *
 * Cached for the life of the page: enabling a provider is a dashboard change,
 * so a reload is the natural way to pick it up.
 *
 * @returns {Promise<object|null>} the settings payload, or null when they could
 *   not be read (offline, placeholder credentials, unexpected response).
 */
export async function fetchAuthSettings() {
  if (!isSupabaseConfigured) return null;
  if (authSettingsCache) return authSettingsCache;

  try {
    const response = await fetch(`${resolvedUrl}/auth/v1/settings`, {
      headers: { apikey: resolvedAnonKey, Authorization: `Bearer ${resolvedAnonKey}` },
    });
    if (!response.ok) return null;
    authSettingsCache = await response.json();
    return authSettingsCache;
  } catch (error) {
    console.warn('[supabase] could not read auth settings:', error?.message);
    return null;
  }
}

/**
 * Is a given OAuth provider enabled for this project?
 *
 * @returns {Promise<boolean|null>} `true`/`false` when the settings were read,
 *   or `null` when unknown - callers should only block UI on an explicit false.
 */
export async function isProviderEnabled(provider) {
  const settings = await fetchAuthSettings();
  if (!settings?.external) return null;
  return Boolean(settings.external[provider]);
}