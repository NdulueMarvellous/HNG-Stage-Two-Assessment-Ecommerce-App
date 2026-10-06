/**
 * Store-wide constants.
 *
 * DELIVERY_FEE / FREE_DELIVERY_THRESHOLD are for display only: the same two
 * numbers live in supabase/schema.sql (place_order) where the real totals are
 * calculated. Keep them in sync if you change them.
 */
export const STORE_NAME = import.meta.env.VITE_STORE_NAME || 'TechMart';
export const CURRENCY = import.meta.env.VITE_CURRENCY || 'NGN';
export const DELIVERY_FEE = Number(import.meta.env.VITE_DELIVERY_FEE ?? 2500);
export const FREE_DELIVERY_THRESHOLD = Number(import.meta.env.VITE_FREE_DELIVERY_THRESHOLD ?? 150000);

/** Largest quantity a shopper may put in the cart for a single product. */
export const MAX_PER_ITEM = 10;

export const ORDER_STATUSES = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-sky-100 text-sky-800',
  processing: 'bg-indigo-100 text-indigo-800',
  shipped: 'bg-violet-100 text-violet-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
};

export const PAYMENT_METHODS = {
  card: { id: 'card', name: 'Credit / Debit Card (Stripe)', desc: 'Pay instantly with Visa, Mastercard, or Verve' },
  pod: { id: 'pod', name: 'Pay on Delivery', desc: 'Pay with cash or POS transfer upon arrival' },
};

export const SUPPORT = {
  email: 'support@techmart.example',
  phone: '+234 800 000 0000',
};

