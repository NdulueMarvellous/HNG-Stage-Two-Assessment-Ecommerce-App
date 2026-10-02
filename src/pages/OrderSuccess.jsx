import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Alert, PageLoader, Spinner } from '../components/Feedback';
import { useToast } from '../context/ToastContext';
import { fetchOrderById } from '../lib/products';
import { sendOrderConfirmationEmail } from '../lib/orders';
import { getErrorMessage } from '../lib/errors';
import { formatPrice, formatDate } from '../lib/format';
import { ORDER_STATUSES } from '../lib/constants';

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

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl">
        <div className="card overflow-hidden">
          <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-2xl text-white">
              ✓
            </span>
            <h1 className="mt-4 text-2xl font-bold text-emerald-900">
              Thank you, your order is confirmed
            </h1>
            <p className="mt-2 text-sm text-emerald-800">
              Order <span className="font-semibold">{order.order_number}</span> was placed on{' '}
              {formatDate(order.created_at)}.
            </p>
          </div>

          <div className="space-y-6 p-6">
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
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Order summary
              </h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                        {item.quantity}×
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.product_name}</p>
                        <p className="text-xs text-slate-500">{formatPrice(item.unit_price)} each</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
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
                <dt className="font-semibold text-slate-900">Total</dt>
                <dd className="font-bold text-slate-900">{formatPrice(order.total)}</dd>
              </div>
            </dl>

            <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </h3>
                <p className="mt-2">
                  <span
                    className={`badge capitalize ${
                      ORDER_STATUSES[order.status] || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {order.status}
                  </span>
                </p>
                <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Receipt email
                </h3>
                <p className="mt-2 break-all text-sm text-slate-700">{order.email}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
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