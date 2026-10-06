import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [copiedId, setCopiedId] = useState(null);

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

  function handleCopyOrderNumber(orderNumber, orderId) {
    navigator.clipboard.writeText(orderNumber);
    setCopiedId(orderId);
    toast.success(`Copied ${orderNumber} to clipboard!`);
    setTimeout(() => setCopiedId(null), 2500);
  }

  const filteredOrders = useMemo(() => {
    if (selectedStatus === 'all') return orders;
    return orders.filter((o) => o.status === selectedStatus);
  }, [orders, selectedStatus]);

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
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Orders</h1>
          <p className="mt-2 text-sm text-slate-500">
            Track and view every order placed with your account.
          </p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={load}>
          Refresh orders
        </button>
      </header>

      {/* Filter Tabs */}
      {orders.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setSelectedStatus('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${selectedStatus === 'all'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
          >
            All Orders ({orders.length})
          </button>
          {['pending', 'confirmed', 'delivered'].map((st) => {
            const count = orders.filter((o) => o.status === st).length;
            if (count === 0) return null;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${selectedStatus === st
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                {st} ({count})
              </button>
            );
          })}
        </div>
      )}

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
      ) : filteredOrders.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-500">No orders with status "{selectedStatus}".</p>
          <button
            type="button"
            onClick={() => setSelectedStatus('all')}
            className="btn-secondary btn-sm mt-3"
          >
            Show all orders
          </button>
        </div>
      ) : (
        <ul className="space-y-5">
          {filteredOrders.map((order) => {
            const items = order.order_items ?? [];
            const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

            return (
              <li key={order.id} className="card p-5 shadow-sm transition hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-base font-bold text-slate-900">{order.order_number}</h2>
                      <button
                        type="button"
                        onClick={() => handleCopyOrderNumber(order.order_number, order.id)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        title="Copy order number"
                      >
                        {copiedId === order.id ? (
                          <span className="text-xs text-emerald-600 font-semibold">✓ Copied</span>
                        ) : (
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                      <span
                        className={`badge capitalize text-xs font-semibold ${ORDER_STATUSES[order.status] || 'bg-slate-100 text-slate-700'
                          }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Placed on {formatDate(order.created_at)} · {totalQuantity} item
                      {totalQuantity === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-slate-900">{formatPrice(order.total)}</p>
                    <p className="text-xs text-slate-500">
                      incl. {Number(order.delivery_fee) === 0 ? 'free delivery' : formatPrice(order.delivery_fee) + ' delivery'}
                    </p>
                  </div>
                </div>

                <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm">
                  {items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-4 text-slate-600">
                      <span>
                        <strong className="text-slate-900">{item.quantity}×</strong> {item.product_name}
                      </span>
                      <span className="font-semibold text-slate-900">{formatPrice(item.line_total)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                  <div className="text-xs leading-relaxed text-slate-500">
                    Delivered to <strong className="text-slate-700">{order.full_name}</strong>,{' '}
                    {order.address}, {order.city}, {order.state}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => resend(order)}
                      disabled={sendingId === order.id}
                    >
                      {sendingId === order.id ? <Spinner className="h-3.5 w-3.5" /> : null}
                      {sendingId === order.id ? 'Sending…' : 'Email receipt'}
                    </button>
                    <Link to={`/order-success/${order.id}`} className="btn-ghost btn-sm">
                      View full receipt →
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
