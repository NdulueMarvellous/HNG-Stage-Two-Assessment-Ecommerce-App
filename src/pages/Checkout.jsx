import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, EmptyState, Spinner } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { fetchProductsByIds } from '../lib/products';
import { placeOrder, sendOrderConfirmationEmail } from '../lib/orders';
import { getErrorMessage, validateCheckout } from '../lib/errors';
import { formatPrice } from '../lib/format';

const EMPTY_FORM = {
  full_name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  country: '',
};

const FIELDS = [
  { name: 'full_name', label: 'Full name', autoComplete: 'name', placeholder: 'Ada Lovelace' },
  { name: 'email', label: 'Email address', type: 'email', autoComplete: 'email', placeholder: 'ada@example.com' },
  { name: 'phone', label: 'Phone number', type: 'tel', autoComplete: 'tel', placeholder: '0803 000 0000' },
  { name: 'address', label: 'Delivery address', autoComplete: 'street-address', placeholder: '12 Marina Road, Flat 3' },
  { name: 'city', label: 'City', autoComplete: 'address-level2', placeholder: 'Lagos' },
  { name: 'state', label: 'State / Region', autoComplete: 'address-level1', placeholder: 'Lagos State' },
  { name: 'country', label: 'Country', autoComplete: 'country-name', placeholder: 'Nigeria' },
];

export default function Checkout() {
  const { user, profile, updateProfile } = useAuth();
  const {
    items,
    isEmpty,
    subtotal,
    deliveryFee,
    total,
    hasStockIssues,
    clearCart,
    reconcile,
    loadedProductIds,
  } = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Guards against double clicks / double submits creating two orders.
  const submittingRef = useRef(false);

  // Pre-fill from the profile, then fall back to the Google account details.
  useEffect(() => {
    setForm({
      full_name:
        profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || '',
      email: profile?.email || user?.email || '',
      phone: profile?.phone || '',
      address: profile?.address || '',
      city: profile?.city || '',
      state: profile?.state || '',
      country: profile?.country || '',
    });
  }, [profile, user]);

  /** Prices and stock are refreshed from the database on arrival. */
  const refreshCart = useCallback(async () => {
    if (loadedProductIds.length === 0) return;
    setRefreshing(true);
    try {
      reconcile(await fetchProductsByIds(loadedProductIds));
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'We could not verify your cart against the database.'));
    } finally {
      setRefreshing(false);
    }
  }, [loadedProductIds, reconcile]);

  useEffect(() => {
    refreshCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submittingRef.current) return; // duplicate-submission guard
    setSubmitError('');

    if (items.length === 0) {
      setSubmitError('Your cart is empty, so there is nothing to order.');
      return;
    }

    const { errors: fieldErrors, isValid } = validateCheckout(form);
    setErrors(fieldErrors);
    if (!isValid) {
      setSubmitError('Please correct the highlighted fields before placing your order.');
      return;
    }

    if (hasStockIssues) {
      setSubmitError(
        'Some items in your cart are no longer available in the quantity you selected. Please update your cart.',
      );
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      // The server re-prices the cart and reduces stock. Nothing about price,
      // delivery fee or total is trusted from this form.
      const order = await placeOrder(form, items);

      // Remember the delivery details for next time (best effort only).
      try {
        await updateProfile(form);
      } catch (profileError) {
        console.warn('[checkout] could not save profile details:', profileError);
      }

      clearCart();

      // The order exists now - email failure must not look like a failed order.
      const email = await sendOrderConfirmationEmail(order.id);
      if (email.emailSent) {
        toast.success(email.message || 'Confirmation email sent.');
      } else {
        toast.warning(email.error || 'We could not send the confirmation email.');
      }

      navigate(`/order-success/${order.id}`, { replace: true, state: { email } });
    } catch (error) {
      const message = getErrorMessage(error, 'We could not place your order. Please try again.');
      setSubmitError(message);
      toast.error(message);

      // Show the shopper the current stock so they can fix the cart.
      try {
        reconcile(await fetchProductsByIds(loadedProductIds));
      } catch {
        /* the alert above already explains the failure */
      }

      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (isEmpty && !submitting) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title="Nothing to check out"
          description="Your cart is empty. Add a product and come back to complete your order."
          action={
            <Link to="/shop" className="btn-primary">
              Browse products
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Checkout</h1>
        <p className="mt-2 text-sm text-slate-500">
          Signed in as <span className="font-medium text-slate-700">{user?.email}</span>. Your order
          will be saved to your account and a confirmation email will be sent to the address below.
        </p>
      </header>

      {submitError ? (
        <div className="mb-6">
          <Alert title="We could not place your order">
            <p>{submitError}</p>
          </Alert>
        </div>
      ) : null}

      {hasStockIssues ? (
        <div className="mb-6">
          <Alert variant="warning" title="Stock changed" onRetry={refreshCart}>
            <p>
              One or more items in your cart are unavailable. Update the cart before placing your
              order.
            </p>
          </Alert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-8 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Delivery details</h2>
                {refreshing ? (
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    <Spinner className="h-3.5 w-3.5 text-brand-500" /> checking prices & stock…
                  </span>
                ) : null}
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {FIELDS.map((field) => {
                  const isWide = field.name === 'address';
                  return (
                    <div key={field.name} className={isWide ? 'sm:col-span-2' : ''}>
                      <label className="label" htmlFor={`checkout-${field.name}`}>
                        {field.label}
                      </label>
                      <input
                        id={`checkout-${field.name}`}
                        name={field.name}
                        type={field.type || 'text'}
                        autoComplete={field.autoComplete}
                        placeholder={field.placeholder}
                        value={form[field.name]}
                        onChange={(event) => setField(field.name, event.target.value)}
                        className={`input ${errors[field.name] ? 'input-error' : ''}`}
                        aria-invalid={Boolean(errors[field.name])}
                        aria-describedby={errors[field.name] ? `checkout-${field.name}-error` : undefined}
                        disabled={submitting}
                      />
                      {errors[field.name] ? (
                        <p id={`checkout-${field.name}-error`} className="mt-1.5 text-xs font-medium text-rose-600">
                          {errors[field.name]}
                        </p>
                      ) : null}
                    </div>
                  );
                })}

                <div className="sm:col-span-2 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
                  Your details are stored with the order so we can deliver it and email your receipt.
                  They are only visible to you and the store.
                </div>
              </div>
            </div>
          </section>

          <aside className="lg:col-span-1">
            <div className="card p-5 lg:sticky lg:top-24">
              <h2 className="text-lg font-semibold text-slate-900">Review your order</h2>

              <ul className="mt-4 divide-y divide-slate-100">
                {items.map((item) => (
                  <li key={item.product_id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {item.product?.name || 'Product'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatPrice(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-slate-900">
                      {formatPrice(item.lineTotal)}
                    </p>
                  </li>
                ))}
              </ul>

              <dl className="mt-2 space-y-2 border-t border-slate-200 pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd className="font-medium text-slate-900">{formatPrice(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Delivery fee</dt>
                  <dd className="font-medium text-slate-900">
                    {deliveryFee === 0 ? 'FREE' : formatPrice(deliveryFee)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-3 text-base">
                  <dt className="font-semibold text-slate-900">Total</dt>
                  <dd className="font-bold text-slate-900">{formatPrice(total)}</dd>
                </div>
              </dl>

              <button type="submit" className="btn-primary mt-5 w-full" disabled={submitting || hasStockIssues}>
                {submitting ? (
                  <>
                    <Spinner className="h-4 w-4" /> Placing order…
                  </>
                ) : (
                  'Place order'
                )}
              </button>

              <p className="mt-3 text-center text-xs text-slate-400">
                The final total is calculated on the server when the order is created.
              </p>

              <Link to="/cart" className="btn-ghost mt-2 w-full">
                Back to cart
              </Link>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}