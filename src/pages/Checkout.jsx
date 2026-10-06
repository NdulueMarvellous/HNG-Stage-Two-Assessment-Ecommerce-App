import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, EmptyState, Spinner } from '../components/Feedback';
import { useAuth } from '../features/auth/AuthContext';
import { useCart } from '../features/commerce/CartContext';
import { useToast } from '../features/notifications/ToastContext';
import { fetchProductsByIds } from '../features/catalog/catalog-service';
import { placeOrder, sendOrderConfirmationEmail, updateOrderStatus } from '../features/commerce/order-service';
import { getErrorMessage, validateCheckout } from '../lib/error-messages';
import { formatPrice } from '../lib/formatters';
import { PAYMENT_METHODS } from '../lib/store-config';

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
  const [paymentMethod, setPaymentMethod] = useState('card'); // 'card' | 'pod'

  // Card details state
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardErrors, setCardErrors] = useState({});

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
    setCardName(
      profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || '',
    );
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
  }, [refreshCart]);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  }

  function formatCardNumber(val) {
    const raw = val.replace(/\D/g, '').slice(0, 16);
    return raw.replace(/(\d{4})/g, '$1 ').trim();
  }

  function formatExpiry(val) {
    const raw = val.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 2) return `${raw.slice(0, 2)}/${raw.slice(2)}`;
    return raw;
  }

  function fillTestCard(brand = 'visa') {
    if (brand === 'visa') {
      setCardNumber('4242 4242 4242 4242');
      setCardExpiry('12/28');
      setCardCvc('123');
      setCardName(form.full_name || 'Ada Lovelace');
    } else {
      setCardNumber('5555 5555 5555 4444');
      setCardExpiry('08/29');
      setCardCvc('789');
      setCardName(form.full_name || 'Ada Lovelace');
    }
    setCardErrors({});
    toast.info(`Filled Stripe test ${brand.toUpperCase()} card details.`);
  }

  function validateCard() {
    if (paymentMethod !== 'card') return true;
    const cErrors = {};
    const cleanNum = cardNumber.replace(/\s/g, '');
    if (cleanNum.length < 15) cErrors.number = 'Please enter a valid 16-digit card number.';
    if (!cardExpiry || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry)) {
      cErrors.expiry = 'Enter valid MM/YY.';
    }
    if (cardCvc.length < 3) cErrors.cvc = 'Enter 3 or 4-digit CVC.';
    if (!cardName.trim()) cErrors.name = 'Cardholder name is required.';

    setCardErrors(cErrors);
    return Object.keys(cErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submittingRef.current) return;
    setSubmitError('');

    if (items.length === 0) {
      setSubmitError('Your cart is empty, so there is nothing to order.');
      return;
    }

    const { errors: fieldErrors, isValid } = validateCheckout(form);
    setErrors(fieldErrors);
    if (!isValid) {
      setSubmitError('Please correct the delivery details before placing your order.');
      return;
    }

    if (!validateCard()) {
      setSubmitError('Please correct the payment card details.');
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
      // Simulate Stripe card authorization if paid by card
      if (paymentMethod === 'card') {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      // Create authoritative order in Supabase
      const order = await placeOrder(form, items);

      // If paid by card, update order status to confirmed
      if (paymentMethod === 'card') {
        try {
          await updateOrderStatus(order.id, 'confirmed');
          order.status = 'confirmed';
        } catch {
          // best-effort
        }
      }

      // Remember delivery details
      try {
        await updateProfile(form);
      } catch (profileError) {
        console.warn('[checkout] could not save profile details:', profileError);
      }

      clearCart();

      // Trigger SMTP email confirmation
      const email = await sendOrderConfirmationEmail(order.id);
      if (email.emailSent) {
        toast.success(email.message || 'Confirmation email sent.');
      } else {
        toast.warning(email.error || 'Order placed! Confirmation email is pending.');
      }

      navigate(`/order-success/${order.id}`, {
        replace: true,
        state: { email, paymentMethod: PAYMENT_METHODS[paymentMethod]?.name || 'Card' },
      });
    } catch (error) {
      const message = getErrorMessage(error, 'We could not place your order. Please try again.');
      setSubmitError(message);
      toast.error(message);

      try {
        reconcile(await fetchProductsByIds(loadedProductIds));
      } catch {
        // ignore
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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Secure Checkout</h1>
        <p className="mt-2 text-sm text-slate-500">
          Signed in as <span className="font-semibold text-slate-700">{user?.email}</span>. Your order
          will be saved to your account and emailed to you.
        </p>
      </header>

      {submitError ? (
        <div className="mb-6">
          <Alert title="We could not complete your order">
            <p>{submitError}</p>
          </Alert>
        </div>
      ) : null}

      {hasStockIssues ? (
        <div className="mb-6">
          <Alert variant="warning" title="Stock changed" onRetry={refreshCart}>
            <p>One or more items in your cart are unavailable. Update the cart before placing your order.</p>
          </Alert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-8 lg:grid-cols-3">
          <section className="space-y-6 lg:col-span-2">
            {/* Delivery Details Card */}
            <div className="card p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    1
                  </span>
                  <h2 className="text-lg font-semibold text-slate-900">Delivery details</h2>
                </div>
                {refreshing ? (
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    <Spinner className="h-3.5 w-3.5 text-brand-500" /> verifying stock…
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
                        disabled={submitting}
                      />
                      {errors[field.name] ? (
                        <p className="mt-1 text-xs font-medium text-rose-600">{errors[field.name]}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment Method Card */}
            <div className="card p-6 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  2
                </span>
                <h2 className="text-lg font-semibold text-slate-900">Payment method</h2>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {Object.values(PAYMENT_METHODS).map((method) => {
                  const isChecked = paymentMethod === method.id;
                  return (
                    <label
                      key={method.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${isChecked
                          ? 'border-brand-600 bg-brand-50/50 ring-1 ring-brand-600'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.id}
                        checked={isChecked}
                        onChange={() => setPaymentMethod(method.id)}
                        className="mt-1 h-4 w-4 text-brand-600 focus:ring-brand-500"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{method.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{method.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Stripe Card Details Form */}
              {paymentMethod === 'card' && (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Card details
                      </span>
                      <span className="badge bg-emerald-100 text-emerald-800 text-[10px]">
                        256-bit Encrypted
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fillTestCard('visa')}
                        className="btn-ghost btn-sm text-xs font-medium text-brand-600 hover:text-brand-800"
                      >
                        + Test Visa
                      </button>
                      <button
                        type="button"
                        onClick={() => fillTestCard('mastercard')}
                        className="btn-ghost btn-sm text-xs font-medium text-brand-600 hover:text-brand-800"
                      >
                        + Test Mastercard
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="label" htmlFor="card-name">
                        Cardholder name
                      </label>
                      <input
                        id="card-name"
                        type="text"
                        className={`input ${cardErrors.name ? 'input-error' : ''}`}
                        placeholder="Ada Lovelace"
                        value={cardName}
                        onChange={(e) => {
                          setCardName(e.target.value);
                          setCardErrors((prev) => ({ ...prev, name: undefined }));
                        }}
                        disabled={submitting}
                      />
                      {cardErrors.name && (
                        <p className="mt-1 text-xs text-rose-600">{cardErrors.name}</p>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="label" htmlFor="card-number">
                        Card number
                      </label>
                      <div className="relative">
                        <input
                          id="card-number"
                          type="text"
                          maxLength={19}
                          className={`input pr-12 font-mono tracking-wider ${cardErrors.number ? 'input-error' : ''
                            }`}
                          placeholder="4242 4242 4242 4242"
                          value={cardNumber}
                          onChange={(e) => {
                            setCardNumber(formatCardNumber(e.target.value));
                            setCardErrors((prev) => ({ ...prev, number: undefined }));
                          }}
                          disabled={submitting}
                        />
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-bold text-slate-400">
                          💳
                        </span>
                      </div>
                      {cardErrors.number && (
                        <p className="mt-1 text-xs text-rose-600">{cardErrors.number}</p>
                      )}
                    </div>

                    <div>
                      <label className="label" htmlFor="card-expiry">
                        Expiry date
                      </label>
                      <input
                        id="card-expiry"
                        type="text"
                        maxLength={5}
                        className={`input font-mono ${cardErrors.expiry ? 'input-error' : ''}`}
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(e) => {
                          setCardExpiry(formatExpiry(e.target.value));
                          setCardErrors((prev) => ({ ...prev, expiry: undefined }));
                        }}
                        disabled={submitting}
                      />
                      {cardErrors.expiry && (
                        <p className="mt-1 text-xs text-rose-600">{cardErrors.expiry}</p>
                      )}
                    </div>

                    <div>
                      <label className="label" htmlFor="card-cvc">
                        CVC / Security code
                      </label>
                      <input
                        id="card-cvc"
                        type="password"
                        maxLength={4}
                        className={`input font-mono ${cardErrors.cvc ? 'input-error' : ''}`}
                        placeholder="123"
                        value={cardCvc}
                        onChange={(e) => {
                          setCardCvc(e.target.value.replace(/\D/g, ''));
                          setCardErrors((prev) => ({ ...prev, cvc: undefined }));
                        }}
                        disabled={submitting}
                      />
                      {cardErrors.cvc && (
                        <p className="mt-1 text-xs text-rose-600">{cardErrors.cvc}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Order Summary Sidebar */}
          <aside className="lg:col-span-1">
            <div className="card p-5 lg:sticky lg:top-24 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Review your order</h2>

              <ul className="mt-4 divide-y divide-slate-100 max-h-72 overflow-y-auto">
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

              <dl className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">
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

              <button
                type="submit"
                className="btn-primary mt-5 w-full py-3"
                disabled={submitting || hasStockIssues}
              >
                {submitting ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    {paymentMethod === 'card' ? 'Processing Stripe payment…' : 'Placing order…'}
                  </>
                ) : paymentMethod === 'card' ? (
                  `Pay ${formatPrice(total)} with Stripe`
                ) : (
                  'Place order (Pay on Delivery)'
                )}
              </button>

              <p className="mt-3 text-center text-xs text-slate-400">
                🔒 Safe 256-bit SSL encrypted transaction.
              </p>

              <Link to="/cart" className="btn-ghost mt-2 w-full text-center">
                Back to cart
              </Link>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
