import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Spinner } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../lib/errors';
import { isSupabaseConfigured } from '../lib/supabase';

const REDIRECT_KEY = 'techmart.redirectAfterAuth';

export default function Login() {
  const {
    isAuthenticated,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    googleEnabled,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const redirectTo = location.state?.from || searchParams.get('next') || '/shop';
  const cameFromProtected = location.state?.reason === 'protected';

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) navigate(redirectTo, { replace: true });
  }, [loading, isAuthenticated, navigate, redirectTo]);

  async function handleGoogle() {
    setError('');
    setBusy(true);
    try {
      window.sessionStorage.setItem(REDIRECT_KEY, redirectTo);
      await signInWithGoogle();
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
      } else if (mode === 'signup') {
        if (password.length < 8) throw new Error('Your password must be at least 8 characters long.');
        const { needsEmailConfirmation } = await signUpWithEmail(email, password, fullName);
        if (needsEmailConfirmation) {
          toast.info('Check your inbox to confirm your email address, then sign in.');
          setMode('signin');
        } else {
          toast.success('Account created - you are signed in.');
          navigate(redirectTo, { replace: true });
        }
      } else if (mode === 'forgot') {
        if (!email) throw new Error('Please enter your email address to reset your password.');
        await resetPassword(email);
        setResetSent(true);
        toast.success('Password reset link sent to your email.');
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
        <div className="card p-7 shadow-lift">
          <h1 className="text-2xl font-bold text-slate-900">
            {mode === 'signin'
              ? 'Sign in'
              : mode === 'signup'
                ? 'Create an account'
                : 'Reset your password'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {mode === 'forgot'
              ? 'Enter your email address and we will send you a link to reset your password.'
              : cameFromProtected
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
              <Alert title="Authentication Notice">
                <p>{error}</p>
              </Alert>
            </div>
          ) : null}

          {resetSent && mode === 'forgot' ? (
            <div className="mt-5">
              <Alert variant="success" title="Check your inbox">
                <p>We sent a password reset link to <strong>{email}</strong>. Follow the instructions to reset your password.</p>
              </Alert>
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setResetSent(false);
                }}
                className="btn-primary mt-4 w-full"
              >
                Back to Sign in
              </button>
            </div>
          ) : (
            <>
              {mode !== 'forgot' && (
                <>
                  {googleEnabled === false ? (
                    <div className="mt-5">
                      <Alert variant="warning" title="Google sign-in is not enabled">
                        <p>
                          Google provider is disabled in Supabase. Use email/password or enable Google under{' '}
                          <strong>Authentication &rarr; Providers</strong>.
                        </p>
                      </Alert>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={busy || !isSupabaseConfigured || googleEnabled === false}
                    className="btn-secondary mt-6 flex w-full items-center justify-center gap-3"
                  >
                    {busy ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                    )}
                    Continue with Google
                  </button>

                  <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
                    <span className="h-px flex-1 bg-slate-200" />
                    or use email
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>
                </>
              )}

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

                {mode !== 'forgot' && (
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="label" htmlFor="login-password">
                        Password
                      </label>
                      {mode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setMode('forgot');
                            setError('');
                          }}
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative mt-1">
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        className="input pr-10"
                        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="At least 8 characters"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <button type="submit" className="btn-primary w-full" disabled={busy || !isSupabaseConfigured}>
                  {busy ? <Spinner className="h-4 w-4" /> : null}
                  {mode === 'signin'
                    ? 'Sign in'
                    : mode === 'signup'
                      ? 'Create account'
                      : 'Send reset link'}
                </button>
              </form>

              <div className="mt-5 text-center text-sm text-slate-500">
                {mode === 'forgot' ? (
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      setMode('signin');
                      setError('');
                    }}
                  >
                    ← Back to Sign in
                  </button>
                ) : mode === 'signin' ? (
                  <>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      className="link font-semibold"
                      onClick={() => {
                        setMode('signup');
                        setError('');
                      }}
                    >
                      Create one
                    </button>
                  </>
                ) : (
                  <>
                    Already registered?{' '}
                    <button
                      type="button"
                      className="link font-semibold"
                      onClick={() => {
                        setMode('signin');
                        setError('');
                      }}
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Secured by Supabase Auth with PKCE and OAuth 2.0 verification.
        </p>
      </div>
    </div>
  );
}
