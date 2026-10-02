import { isValidEmail, digitsOnly } from './format';

const FALLBACK = 'Something went wrong. Please try again.';

/**
 * Auth / database / network messages are technical by default, so the most
 * common ones are translated into something a shopper can act on. Messages
 * raised by place_order() in Postgres are already human readable and are
 * passed through unchanged.
 */
const RULES = [
  [/invalid login credentials/i, 'That email and password combination is not correct.'],
  [/email not confirmed/i, 'Please confirm your email address before signing in.'],
  [/user already registered|already been registered/i, 'An account with that email already exists. Try signing in.'],
  [/password should be at least (\d+)/i, 'Your password must be at least 8 characters long.'],
  [/signups not allowed|signup is disabled/i, 'New sign-ups are currently disabled for this project.'],
  [/provider is not enabled|unsupported provider/i, 'Google sign-in is not enabled yet. Enable it in Supabase -> Authentication -> Providers.'],
  [/jwt expired|token has expired|invalid claim/i, 'Your session has expired. Please sign in again.'],
  [/invalid api key|no api key found/i, 'Supabase credentials look wrong. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'],
  [/failed to fetch|networkerror|load failed|network request failed|err_network|fetch failed/i, 'We could not reach the server. Check your internet connection and try again.'],
  [/row-level security|permission denied|not authorized|42501/i, 'You do not have permission to do that.'],
  [/duplicate key value|23505/i, 'That record already exists.'],
  [/only has \d+ left in stock/i, null], // pass through: message from place_order()
  [/is no longer available/i, null],
  [/please enter|your cart|sign in before placing/i, null],
  [/could not find the function|place_order/i, 'The order function is missing. Run supabase/schema.sql in your Supabase project.'],
  [/relation .* does not exist|42p01/i, 'A database table is missing. Run supabase/schema.sql in your Supabase project.'],
];

export function getErrorMessage(error, fallback = FALLBACK) {
  if (!error) return fallback;

  const raw = (typeof error === 'string' ? error : error.message || error.error_description || '').trim();
  if (!raw) return fallback;

  for (const [pattern, replacement] of RULES) {
    if (pattern.test(raw)) {
      if (replacement === null) return stripPrefix(raw);
      return replacement;
    }
  }

  // Postgres RAISE EXCEPTION messages arrive as "CODE: message".
  return stripPrefix(raw);
}

function stripPrefix(message) {
  return message.replace(/^[A-Z_]{4,}:\s*/, '').replace(/^error:\s*/i, '').trim() || FALLBACK;
}

export function isAuthError(error) {
  const message = String(error?.message || '');
  return /jwt|token|session|not authenticated|sign in/i.test(message) || error?.status === 401;
}

/** Validates the checkout form. Returns { field: 'message' } and [] errors. */
export function validateCheckout(values) {
  const errors = {};
  const fullName = String(values.full_name || '').trim();
  const email = String(values.email || '').trim();
  const phone = String(values.phone || '').trim();
  const address = String(values.address || '').trim();
  const city = String(values.city || '').trim();
  const state = String(values.state || '').trim();
  const country = String(values.country || '').trim();

  if (fullName.length < 3) errors.full_name = 'Please enter your full name (at least 3 characters).';
  else if (fullName.length > 80) errors.full_name = 'That name is too long.';

  if (!isValidEmail(email)) errors.email = 'Please enter a valid email address, e.g. name@example.com.';

  const phoneDigits = digitsOnly(phone);
  if (phoneDigits.length < 10) errors.phone = 'Please enter a valid phone number (at least 10 digits).';
  else if (phoneDigits.length > 15) errors.phone = 'That phone number looks too long.';

  if (address.length < 5) errors.address = 'Please enter your full delivery address.';
  else if (address.length > 160) errors.address = 'Please shorten the address (max 160 characters).';

  if (city.length < 2) errors.city = 'Please enter your city.';
  if (state.length < 2) errors.state = 'Please enter your state or region.';
  if (country.length < 2) errors.country = 'Please enter your country.';

  return { errors, isValid: Object.keys(errors).length === 0 };
}