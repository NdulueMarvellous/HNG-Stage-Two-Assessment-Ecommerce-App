import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Alert, PageLoader, Spinner } from '../components/Feedback';
import { useToast } from '../features/notifications/ToastContext';
import { fetchOrderById, sendOrderConfirmationEmail } from '../features/commerce/order-service';
import { getErrorMessage } from '../lib/error-messages';
import { formatPrice, formatDate } from '../lib/formatters';
import { ORDER_STATUSES } from '../lib/store-config';

export default function OrderSuccess() {
  const { orderId } = useParams();
  const location = useLocation();
  const toast = useToast();

  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [email, setEmail] = useState(location.state?.email ?? null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const row = await fetchOrderById(orderId);
      if (!row) {
        setStatus('not-found');
        return;
      }
      setOrder(row);
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err, 'We could not load your order.'));
      setStatus('error');
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  async function resendEmail() {
    setSending(true);
    const result = await sendOrderConfirmationEmail(orderId);
    setEmail(result);
    if (result.emailSent) toast.success(result.message || 'Confirmation email sent.');
    else toast.error(result.error || 'We could not send the email.');
    setSending(false);
  }

  if (status === 'loading') return <PageLoader label="Loading your order…" />;

  if (status === 'error' || status === 'not-found') {
    return (
      <div className="container-page py-16">
        <Alert
          variant={status === 'not-found' ? 'warning' : 'error'}
          title={status === 'not-found' ? 'Order not found' : 'We could not load your order'}
          onRetry={status === 'error' ? load : undefined}
        >
          <p>
            {status === 'not-found'
              ? 'This order does not exist, or it belongs to a different account.'
              : error}
          </p>
          <Link to="/orders" className="link mt-3 inline-block">
            Go to my orders
          </Link>
        </Alert>
      </div>
    );
  }

  const items = order.order_items ?? [];
  const paymentMethodName = location.state?.paymentMethod || 'Credit / Debit Card (Stripe)';

  function copyOrderNumber() {
    navigator.clipboard.writeText(order.order_number);
    toast.success(`Copied ${order.order_number} to clipboard!`);
  }

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl">
        <div className="card overflow-hidden shadow-lift">
          <div className="border-b border-emerald-100 bg-gradient-to-b from-emerald-50 to-white px-6 py-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-2xl text-white shadow-sm">
              ✓
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-emerald-950">
              Thank you, your order is placed!
            </h1>
            <div className="mt-2.5 flex items-center justify-center gap-2 text-sm text-emerald-800">
              <span>Order Number: <strong className="font-mono font-bold text-slate-900">{order.order_number}</strong></span>
              <button
                type="button"
                onClick={copyOrderNumber}
                className="rounded p-1 text-slate-500 hover:bg-emerald-100 hover:text-slate-700"
                title="Copy order number"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Placed on {formatDate(order.created_at)}</p>
          </div>

          <div className="space-y-6 p-6 sm:p-8">
            {email ? (
              email.emailSent ? (
                <Alert variant="success" title="Confirmation email sent">
                  <p>
                    A receipt has been emailed to <strong>{order.email}</strong>.
                  </p>
                </Alert>
              ) : (
                <Alert variant="warning" title="Order placed, email pending">
                  <p>{email.error || 'We could not send the confirmation email yet.'}</p>
                  <button
                    type="button"
                    className="btn-secondary btn-sm mt-3"
                    onClick={resendEmail}
                    disabled={sending}
                  >
                    {sending ? <Spinner className="h-3.5 w-3.5" /> : null}
                    {sending ? 'Sending…' : 'Resend confirmation email'}
                  </button>
                </Alert>
              )
            ) : (
              <Alert variant="info" title="Want a copy of your receipt?">
                <button
                  type="button"
                  className="btn-secondary btn-sm mt-1"
                  onClick={resendEmail}
                  disabled={sending}
                >
                  {sending ? <Spinner className="h-3.5 w-3.5" /> : null}
                  {sending ? 'Sending…' : 'Email me the confirmation'}
                </button>
              </Alert>
            )}

            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Purchased Items
              </h2>
              <ul className="mt-3 divide-y divide-slate-100 border-y border-slate-100">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                        {item.quantity}×
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.product_name}</p>
                        <p className="text-xs text-slate-500">{formatPrice(item.unit_price)} each</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-slate-900">
                      {formatPrice(item.line_total)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <dl className="space-y-2 border-t border-slate-200 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="font-medium text-slate-900">{formatPrice(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Delivery fee</dt>
                <dd className="font-medium text-slate-900">
                  {Number(order.delivery_fee) === 0 ? 'FREE' : formatPrice(order.delivery_fee)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-3 text-base">
                <dt className="font-bold text-slate-900">Total Paid</dt>
                <dd className="font-extrabold text-slate-900">{formatPrice(order.total)}</dd>
              </div>
            </dl>

            <div className="grid gap-4 rounded-2xl bg-slate-50 p-5 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Delivery address
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  <strong className="block text-slate-900">{order.full_name}</strong>
                  {order.address}
                  <br />
                  {order.city}, {order.state}
                  <br />
                  {order.country}
                  <br />
                  {order.phone}
                </p>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Payment & Status
                </h3>
                <div className="mt-2 space-y-1 text-sm">
                  <p className="text-slate-600">
                    Payment Method: <span className="font-semibold text-slate-900">{paymentMethodName}</span>
                  </p>
                  <p className="text-slate-600">
                    Order Status:{' '}
                    <span
                      className={`badge capitalize ml-1 ${
                        ORDER_STATUSES[order.status] || 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {order.status}
                    </span>
                  </p>
                  <p className="text-slate-600">
                    Receipt sent to: <span className="font-medium text-slate-900">{order.email}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/orders" className="btn-primary">
                View my orders
              </Link>
              <Link to="/shop" className="btn-secondary">
                Continue shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}