import { supabase, isSupabaseConfigured } from '../../lib/supabase-client';
import { getErrorMessage } from '../../lib/error-messages';

const NOT_CONFIGURED =
  'Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env and restart the dev server.';

function assertConfigured() {
  if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED);
}

/** Loads the whole catalogue (products are public + read-only via RLS). */
export async function fetchProducts() {
  assertConfigured();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw new Error(getErrorMessage(error, 'We could not load the products.'));
  return data ?? [];
}

export async function fetchProductById(id) {
  assertConfigured();
  const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();

  if (error) throw new Error(getErrorMessage(error, 'We could not load this product.'));
  return data ?? null;
}

/**
 * Refreshes price/stock for the ids still in the cart and returns the products
 * that are still purchasable, so stale cached data cannot mislead the shopper.
 */
export async function fetchProductsByIds(ids) {
  assertConfigured();
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const { data, error } = await supabase.from('products').select('*').in('id', ids);
  if (error) throw new Error(getErrorMessage(error, 'We could not refresh your cart.'));
  return data ?? [];
}
