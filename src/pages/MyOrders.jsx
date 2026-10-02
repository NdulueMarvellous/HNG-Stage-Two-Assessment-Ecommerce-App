import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, EmptyState, PageLoader, Spinner } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchMyOrders } from '../lib/products';
import { sendOrderConfirmationEmail } from '../lib/orders';
import { getErrorMessage } from '../lib/errors';
import { formatPrice, formatDate } from '../lib/format';
import { ORDER_STATUSES } from '../lib/constants';

export default function MyOrders() {
  const { user } = useAuth();
  const toast = useToast();

  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [sendingId, setSendingId] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      setOrders(await fetchMyOrders(user?.id));
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err, 'We could not load your orders.'));
      setStatus('error');
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function resend(order) {
    setSendingId(order.id);
    const result = await sendOrderConfirmationEmail(order.id);
    if (result.emailSent) toast.success(result.message || 'Confirmation email sent.');
    else toast.error(result.error || 'We could not send the email.');
    setSendingId(null);
  }

  if (status === 'loading') return <PageLoader label="Loading your orders…" />;

  if (status === 'error') {
    return (
      <div className="container-page py-16">
        <Alert title="We could not load your orders" onRetry={load}>
          <p>{error}</p>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My orders</h1>
          <p className="mt-2 text-sm text-slate-500">
            Every order placed with your account, newest first.
          </p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={load}>
          Refresh
        </button>
      </header>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Once you place an order it will show up here with its items, totals and status."
          action={
            <Link to="/shop" className="btn-primary">
              Start shopping
            </Link>
          }
        />
      ) : (
        <ul className="space-y-5">
          {orders.map((order) => {
            const items = order.order_items ?? [];
            const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

            return (
              <li key={order.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-base font-semibold text-slate-900">{order.order_number}</h2>
                      <span
                        className={`badge capitalize ${
                          ORDER_STATUSES[order.status] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Placed {formatDate(order.created_at)} · {totalQuantity} item
                      {totalQuantity === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">{formatPrice(order.total)}</p>
                    <p className="text-xs text-slate-500">
                      incl. {Number(order.delivery_fee) === 0 ? 'free delivery' : formatPrice(order.delivery_fee) + ' delivery'}
                    </p>
                  </div>
                </div>

                <ul className="mt-4 space-y-1 border-t border-slate-100 pt-4 text-sm">
                  {items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-4 text-slate-600">
                      <span>
                        {item.quantity} × {item.product_name}
                      </span>
                      <span className="font-medium text-slate-800">{formatPrice(item.line_total)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                  <div className="text-xs leading-relaxed text-slate-500">
                    Delivered to <strong className="text-slate-700">{order.full_name}</strong>,{' '}
                    {order.city}, {order.state}, {order.country}
                  </div>
                  <button
                    type="button"
                    className="btn-secondary btn-sm ml-auto"
                    onClick={() => resend(order)}
                    disabled={sendingId === order.id}
                  >
                    {sendingId === order.id ? <Spinner className="h-3.5 w-3.5" /> : null}
                    {sendingId === order.id ? 'Sending…' : 'Resend confirmation email'}
                  </button>
                  <Link to={`/order-success/${order.id}`} className="btn-ghost btn-sm">
                    View receipt
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}