import { supabase, isSupabaseConfigured } from '../../lib/supabase-client';
import { getErrorMessage, isAuthError } from '../../lib/error-messages';

const NOT_CONFIGURED =
  'Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env and restart the dev server.';

/**
 * Creates the order.
 *
 * The browser only sends product ids and quantities - it never sends a price.
 * supabase/schema.sql -> place_order() re-reads price and stock from the
 * products table, validates availability, calculates subtotal/delivery/total,
 * writes the order + items and reduces stock, all in one transaction.
 *
 * @param {object} customer  full_name, email, phone, address, city, state, country
 * @param {Array}  items     [{ product_id, quantity }]
 * @returns {Promise<object>} { id, order_number, subtotal, delivery_fee, total, status, created_at }
 */
export async function placeOrder(customer, items) {
  if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('Your session has expired. Please sign in again to place your order.');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Your cart is empty.');
  }

  const payload = items.map((item) => ({
    product_id: item.product_id,
    quantity: Math.trunc(Number(item.quantity) || 0),
  }));

  const { data, error } = await supabase.rpc('place_order', {
    p_customer: customer,
    p_items: payload,
  });

  if (error) {
    if (isAuthError(error)) {
      throw new Error('Your session has expired. Please sign in again to place your order.');
    }
    throw new Error(getErrorMessage(error, 'We could not place your order. Please try again.'));
  }

  if (!data?.id) {
    throw new Error('The order was not created. Please try again.');
  }

  return data;
}

export async function updateOrderStatus(orderId, status) {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[orders] could not update status:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[orders] status update exception:', err);
    return null;
  }
}

/**
 * Asks the serverless function in /api to email the confirmation over SMTP
 * with Nodemailer. The SMTP credentials stay on the server; this call just
 * forwards the caller's Supabase access token so the function can verify who
 * is asking.
 *
 * Email failure never invalidates an order, so this resolves with
 * { emailSent: false, error } instead of throwing.
 */
export async function sendOrderConfirmationEmail(orderId) {
  if (!isSupabaseConfigured) {
    return { emailSent: false, error: 'Supabase is not configured, so no email was sent.' };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { emailSent: false, error: 'You must be signed in to receive a confirmation email.' };
  }

  try {
    const response = await fetch('/api/send-order-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ orderId }),
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      return {
        emailSent: false,
        error: payload.error || `The email service responded with ${response.status}.`,
      };
    }

    return { emailSent: Boolean(payload.emailSent), message: payload.message, error: payload.error };
  } catch (error) {
    console.error('[orders] confirmation email request failed:', error);
    return {
      emailSent: false,
      error:
        'We could not reach the email service. Your order is safe - we will email you shortly.',
    };
  }
}

/** The signed-in user's orders, newest first, with their line items. */
export async function fetchMyOrders(userId) {
  if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED);
  if (!userId) throw new Error('You must be signed in to view your orders.');

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(getErrorMessage(error, 'We could not load your orders.'));
  return data ?? [];
}

export async function fetchOrderById(orderId) {
  if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED);

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .maybeSingle();

  if (error) throw new Error(getErrorMessage(error, 'We could not load that order.'));
  return data ?? null;
}
