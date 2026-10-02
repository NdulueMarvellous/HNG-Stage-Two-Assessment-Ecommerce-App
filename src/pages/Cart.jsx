import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, EmptyState, Spinner } from '../components/Feedback';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchProductsByIds } from '../lib/products';
import { getErrorMessage } from '../lib/errors';
import { formatPrice, FALLBACK_IMAGE } from '../lib/format';
import { FREE_DELIVERY_THRESHOLD, MAX_PER_ITEM } from '../lib/constants';

export default function Cart() {
  const {
    items,
    isEmpty,
    subtotal,
    deliveryFee,
    total,
    totalQuantity,
    updateQuantity,
    removeItem,
    clearCart,
    reconcile,
    loadedProductIds,
  } = useCart();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  /** Re-checks prices and stock against the database before checkout. */
  const refresh = useCallback(async () => {
    if (loadedProductIds.length === 0) return;
    setRefreshing(true);
    setRefreshError('');
    try {
      const products = await fetchProductsByIds(loadedProductIds);
      const { removed, changed, unavailable } = reconcile(products);

      if (removed > 0) toast.warning(`${removed} item(s) were removed because they are no longer sold.`);
      if (changed > 0) toast.info('Some quantities were adjusted to match available stock.');
      if (unavailable > 0) toast.error('Some items are out of stock and cannot be ordered right now.');
      if (removed === 0 && changed === 0 && unavailable === 0) toast.success('Cart is up to date.');
    } catch (error) {
      setRefreshError(getErrorMessage(error, 'We could not refresh your cart.'));
    } finally {
      setRefreshing(false);
    }
  }, [loadedProductIds, reconcile, toast]);

  useEffect(() => {
    refresh();
    // Only re-run when the set of products in the cart changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedProductIds.join(',')]);

  const remainingForFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);

  function handleQuantityChange(item, nextValue) {
    const result = updateQuantity(item.product_id, nextValue);
    if (result.status === 'clamped') {
      toast.warning(`Only ${result.limit} available - quantity set to ${result.quantity}.`);
    }
  }

  function handleRemove(item) {
    removeItem(item.product_id);
    toast.info(`"${item.product?.name || 'Item'}" removed from your cart.`);
  }

  if (isEmpty) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title="Your cart is empty"
          description="Browse the shop and add a few products - they are saved here, even if you sign in afterwards."
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
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Your cart</h1>
          <p className="mt-2 text-sm text-slate-500">
            {totalQuantity} item{totalQuantity === 1 ? '' : 's'} ready to order.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={refresh} disabled={refreshing}>
            {refreshing ? <Spinner className="h-3.5 w-3.5" /> : null}
            {refreshing ? 'Refreshing…' : 'Refresh prices & stock'}
          </button>
          <button
            type="button"
            className="btn-danger btn-sm"
            onClick={() => {
              clearCart();
              toast.info('Cart cleared.');
            }}
          >
            Clear cart
          </button>
        </div>
      </div>

      {refreshError ? (
        <div className="mb-6">
          <Alert variant="warning" title="Could not refresh your cart" onRetry={refresh}>
            <p>{refreshError}</p>
          </Alert>
        </div>
      ) : null}
<div className="grid gap-8 lg:grid-cols-3">
        <ul className="space-y-4 lg:col-span-2">
          {items.map((item) => {
            const product = item.product || {};
            const cap = Math.max(1, Math.min(item.stock, MAX_PER_ITEM));

            return (
              <li key={item.product_id} className="card flex flex-col gap-4 p-4 sm:flex-row">
                <Link
                  to={`/product/${item.product_id}`}
                  className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100"
                >
                  <img
                    src={product.image_url || FALLBACK_IMAGE}
                    alt={product.name || 'Product'}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = FALLBACK_IMAGE;
                    }}
                  />
                </Link>

                <div className="flex flex-1 flex-col">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                        {product.category || 'Product'}
                      </p>
                      <Link
                        to={`/product/${item.product_id}`}
                        className="text-sm font-semibold text-slate-900 hover:text-brand-700"
                      >
                        {product.name || 'Unavailable product'}
                      </Link>
                      <p className="mt-1 text-sm text-slate-500">{formatPrice(item.price)} each</p>
                    </div>
                    <p className="text-base font-bold text-slate-900">{formatPrice(item.lineTotal)}</p>
                  </div>

                  {!item.available ? (
                    <p className="mt-2 text-xs font-semibold text-rose-700">
                      Out of stock - remove this item to continue.
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="flex items-center rounded-lg border border-slate-300 bg-white">
                      <button
                        type="button"
                        className="px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                        onClick={() => handleQuantityChange(item, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        aria-label={`Decrease quantity of ${product.name || 'item'}`}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={cap}
                        value={item.quantity}
                        onChange={(event) => handleQuantityChange(item, event.target.value)}
                        className="w-12 border-x border-slate-200 py-1.5 text-center text-sm font-semibold focus:outline-none"
                        aria-label="Quantity"
                      />
                      <button
                        type="button"
                        className="px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                        onClick={() => handleQuantityChange(item, item.quantity + 1)}
                        disabled={item.quantity >= cap}
                        aria-label={`Increase quantity of ${product.name || 'item'}`}
                      >
                        +
                      </button>
                    </div>

                    <span className="text-xs text-slate-500">{item.stock} in stock</span>

                    <button
                      type="button"
                      className="btn-ghost btn-sm ml-auto text-rose-600 hover:bg-rose-50"
                      onClick={() => handleRemove(item)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
<aside className="lg:col-span-1">
          <div className="card p-5 lg:sticky lg:top-24">
            <h2 className="text-lg font-semibold text-slate-900">Order summary</h2>

            <dl className="mt-4 space-y-2 text-sm">
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

            {remainingForFreeDelivery > 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                Spend {formatPrice(remainingForFreeDelivery)} more for free delivery.
              </p>
            ) : (
              <p className="mt-3 text-xs font-medium text-emerald-700">Free delivery unlocked.</p>
            )}

            <button
              type="button"
              className="btn-primary mt-5 w-full"
              onClick={() => navigate(isAuthenticated ? '/checkout' : '/login?next=/checkout')}
            >
              {isAuthenticated ? 'Proceed to checkout' : 'Sign in to check out'}
            </button>

            {!isAuthenticated ? (
              <p className="mt-3 text-xs text-slate-500">
                Sign in with Google to place your order - your cart will be waiting for you.
              </p>
            ) : null}

            <Link to="/shop" className="btn-ghost mt-2 w-full">
              Continue shopping
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}