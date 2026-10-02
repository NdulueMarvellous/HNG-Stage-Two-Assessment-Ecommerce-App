import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getErrorMessage } from '../lib/errors';

const AuthContext = createContext(null);

/**
 * Owns the Supabase Auth session and the signed-in user's profile row.
 *
 * Google OAuth is the main flow (signInWithGoogle), with email/password kept
 * as a fallback. `onAuthStateChange` keeps React in sync with the session,
 * including after the OAuth redirect back to /auth/callback and after the
 * hourly token refresh.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    if (!userId || !isSupabaseConfigured) return null;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) {
      // A missing profile row is not fatal: checkout simply starts empty.
      console.warn('[auth] could not load profile:', error.message);
      return null;
    }
    return data;
  }, []);

  useEffect(() => {
    let active = true;

    async function init() {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        if (data.session?.user) setProfile(await fetchProfile(data.session.user.id));
      } catch (error) {
        console.error('[auth] session lookup failed:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    init();

    let subscription = null;
    if (isSupabaseConfigured) {
      const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (!active) return;
        setSession(nextSession ?? null);
        setUser(nextSession?.user ?? null);

        if (event === 'SIGNED_OUT' || !nextSession?.user) {
          setProfile(null);
        } else {
          // Fire and forget; the UI updates as soon as the session lands.
          fetchProfile(nextSession.user.id).then((row) => {
            if (active) setProfile(row);
          });
        }

        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setLoading(false);
      });
      subscription = data.subscription;
    }

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  /** Google OAuth - redirects to Google, then back to <origin>/auth/callback. */
  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured yet. Add your keys to .env to enable sign-in.');
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw new Error(getErrorMessage(error));
  }, []);

  const signInWithEmail = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured yet. Add your keys to .env to enable sign-in.');
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: String(email).trim(),
      password,
    });
    if (error) throw new Error(getErrorMessage(error));
  }, []);

  const signUpWithEmail = useCallback(async (email, password, fullName) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured yet. Add your keys to .env to enable sign-in.');
    }
    const { data, error } = await supabase.auth.signUp({
      email: String(email).trim(),
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw new Error(getErrorMessage(error));
    // With email confirmation switched on there is no session until the user
    // clicks the link, so let the caller know.
    return { needsEmailConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(getErrorMessage(error));
    setProfile(null);
  }, []);

  /** Saves checkout details on the profile so the form is pre-filled next time. */
  const updateProfile = useCallback(
    async (updates) => {
      if (!user) throw new Error('You must be signed in to update your profile.');
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, email: user.email, ...updates }, { onConflict: 'id' })
        .select()
        .maybeSingle();
      if (error) throw new Error(getErrorMessage(error));
      setProfile(data);
      return data;
    },
    [user],
  );

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      isAuthenticated: Boolean(user),
      displayName:
        profile?.full_name ||
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.email ||
        '',
      avatarUrl:
        profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      updateProfile,
      refreshProfile: () => (user ? fetchProfile(user.id).then(setProfile) : Promise.resolve(null)),
    }),
    [
      session,
      user,
      profile,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      updateProfile,
      fetchProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an <AuthProvider>.');
  return context;
}