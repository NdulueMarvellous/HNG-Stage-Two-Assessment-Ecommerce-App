import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Spinner } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../lib/errors';
import { isSupabaseConfigured } from '../lib/supabase';

const REDIRECT_KEY = 'techmart.redirectAfterAuth';

export default function Login() {
  const { isAuthenticated, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const redirectTo = location.state?.from || searchParams.get('next') || '/shop';
  const cameFromProtected = location.state?.reason === 'protected';

  const [mode, setMode] = useState('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && isAuthenticated) navigate(redirectTo, { replace: true });
  }, [loading, isAuthenticated, navigate, redirectTo]);

  async function handleGoogle() {
    setError('');
    setBusy(true);
    try {
      // Remember where the shopper was heading so the OAuth redirect can return there.
      window.sessionStorage.setItem(REDIRECT_KEY, redirectTo);
      await signInWithGoogle();
      // The browser leaves for Google here, so busy stays true on purpose.
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        toast.success('Welcome back!');
        navigate(redirectTo, { replace: true });
      } else {
        if (password.length < 8) throw new Error('Your password must be at least 8 characters long.');
        const { needsEmailConfirmation } = await signUpWithEmail(email, password, fullName);
        if (needsEmailConfirmation) {
          toast.info('Check your inbox to confirm your email address, then sign in.');
          setMode('signin');
        } else {
          toast.success('Account created - you are signed in.');
          navigate(redirectTo, { replace: true });
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-md">
        <div className="card p-7">
          <h1 className="text-2xl font-bold text-slate-900">
            {mode === 'signin' ? 'Sign in' : 'Create an account'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {cameFromProtected
              ? 'Please sign in to continue to your checkout or orders.'
              : 'Sign in to place orders, save your details and track your history.'}
          </p>

          {!isSupabaseConfigured ? (
            <div className="mt-5">
              <Alert variant="warning" title="Supabase is not configured">
                <p>
                  Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your{' '}
                  <code>.env</code> file and restart the dev server.
                </p>
              </Alert>
            </div>
          ) : null}

          {error ? (
            <div className="mt-5">
              <Alert title="Sign-in failed">
                <p>{error}</p>
              </Alert>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy || !isSupabaseConfigured}
            className="btn-secondary mt-6 w-full"
          >
            {busy ? <Spinner className="h-4 w-4" /> : null}
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or use email
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === 'signup' ? (
              <div>
                <label className="label" htmlFor="login-name">
                  Full name
                </label>
                <input
                  id="login-name"
                  className="input"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Ada Lovelace"
                />
              </div>
            ) : null}

            <div>
              <label className="label" htmlFor="login-email">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                className="input"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                className="input"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={busy || !isSupabaseConfigured}>
              {busy ? <Spinner className="h-4 w-4" /> : null}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            {mode === 'signin' ? "Don't have an account?" : 'Already registered?'}{' '}
            <button
              type="button"
              className="link"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError('');
              }}
            >
              {mode === 'signin' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Authentication is handled by Supabase Auth. Google sign-in is configured in the Google Cloud
          Console and enabled in the Supabase dashboard.
        </p>
      </div>
    </div>
  );
}