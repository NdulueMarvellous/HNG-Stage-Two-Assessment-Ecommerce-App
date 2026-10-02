import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageLoader } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const REDIRECT_KEY = 'techmart.redirectAfterAuth';

/**
 * Landing route for the OAuth redirect (Google sends the browser back here
 * with ?code=...). The Supabase client is created with detectSessionInUrl,
 * so it exchanges the code for a session on load. This page simply waits for
 * the session and then forwards the user on - back to checkout if that is
 * where they started, otherwise the shop.
 */
export default function AuthCallback() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error_description') || params.get('error');
    if (oauthError) {
      setError(oauthError.replace(/\+/g, ' '));
      setWaiting(false);
      return;
    }

    // Give the client a moment to exchange the code for a session.
    const timeout = window.setTimeout(() => setWaiting(false), 8000);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (loading || !waiting) return;
    if (isAuthenticated) {
      const target = window.sessionStorage.getItem(REDIRECT_KEY) || '/shop';
      window.sessionStorage.removeItem(REDIRECT_KEY);
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, loading, waiting, navigate]);

  // Also resolve the session directly, in case the auth event fired before mount.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active || !data.session) return;
      const target = window.sessionStorage.getItem(REDIRECT_KEY) || '/shop';
      window.sessionStorage.removeItem(REDIRECT_KEY);
      navigate(target, { replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="container-page py-20">
        <div className="card mx-auto max-w-md p-7 text-center">
          <h1 className="text-xl font-bold text-slate-900">We could not sign you in</h1>
          <p className="mt-3 text-sm text-slate-600">{error}</p>
          <p className="mt-2 text-xs text-slate-400">
            If this keeps happening, check the Google OAuth redirect URI configured in the Google
            Cloud Console and Supabase (see README).
          </p>
          <Link to="/login" className="btn-primary mt-5">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!waiting && !isAuthenticated) {
    return (
      <div className="container-page py-20">
        <div className="card mx-auto max-w-md p-7 text-center">
          <h1 className="text-xl font-bold text-slate-900">Sign-in did not complete</h1>
          <p className="mt-3 text-sm text-slate-600">
            We did not receive a valid session from the provider. Please try again.
          </p>
          <Link to="/login" className="btn-primary mt-5">
            Try again
          </Link>
        </div>
      </div>
    );
  }

  return <PageLoader label="Finishing sign-in…" />;
}