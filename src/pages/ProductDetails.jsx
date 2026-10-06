import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { Alert, PageLoader } from '../components/Feedback';
import { useCart } from '../features/commerce/CartContext';
import { useToast } from '../features/notifications/ToastContext';
import { fetchProductById, fetchProducts } from '../features/catalog/catalog-service';
import { getErrorMessage } from '../lib/error-messages';
import { formatPrice, FALLBACK_IMAGE } from '../lib/formatters';
import { MAX_PER_ITEM } from '../lib/store-config';

export default function ProductDetails() {
  const { id } = useParams();
  const { addItem, updateQuantity } = useCart();
  const toast = useToast();

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const row = await fetchProductById(id);
      if (!row) {
        setStatus('not-found');
        return;
      }
      setProduct(row);
      setQuantity(1);
      setStatus('ready');

      // Related items are a bonus - never let a failure break the page.
      try {
        const all = await fetchProducts();
        setRelated(
          all.filter((item) => item.category === row.category && item.id !== row.id).slice(0, 4),
        );
      } catch {
        setRelated([]);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'We could not load this product.'));
      setStatus('error');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (status === 'loading') return <PageLoader label="Loading product…" />;

  if (status === 'error') {
    return (
      <div className="container-page py-16">
        <Alert title="We could not load this product" onRetry={load}>
          <p>{error}</p>
        </Alert>
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="container-page py-16">
        <Alert variant="warning" title="Product not found">
          <p>This product may have been removed or is no longer available.</p>
          <Link to="/shop" className="link mt-3 inline-block">
            ← Back to the shop
          </Link>
        </Alert>
      </div>
    );
  }

  const stock = Number(product.stock ?? 0);
  const maxQuantity = Math.max(1, Math.min(stock, MAX_PER_ITEM));

  function clamp(next) {
    const value = Math.trunc(Number(next) || 1);
    return Math.min(Math.max(value, 1), maxQuantity);
  }

  function handleAdd() {
    const result = addItem(product, quantity);
    if (result.status === 'out-of-stock') {
      toast.error('This product just went out of stock.');
      return;
    }
    if (result.status === 'limit-reached') {
      toast.warning('Your cart already holds the maximum available quantity.');
      return;
    }
    toast.success(`${quantity} × ${product.name} added to your cart.`);
  }

  function handleBuyNow() {
    const result = addItem(product, quantity);
    if (result.status === 'out-of-stock') {
      toast.error('This product just went out of stock.');
      return;
    }
    updateQuantity(product.id, quantity);
    toast.success('Added to your cart - review it before checking out.');
  }

  return (
    <div className="container-page py-10">
      <nav className="mb-6 text-sm text-slate-500">
        <Link to="/" className="hover:text-brand-700">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link
          to={`/shop?category=${encodeURIComponent(product.category)}`}
          className="hover:text-brand-700"
        >
          {product.category}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <img
            src={product.image_url || FALLBACK_IMAGE}
            alt={product.name}
            className="aspect-square w-full object-cover"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = FALLBACK_IMAGE;
            }}
          />
        </div>

        <div>
          <span className="badge bg-brand-50 text-brand-700">{product.category}</span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{product.name}</h1>

          <p className="mt-4 text-3xl font-extrabold text-slate-900">{formatPrice(product.price)}</p>

          <p className="mt-2 text-sm">
            {stock > 0 ? (
              <span
                className={
                  stock <= 5 ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'
                }
              >
                {stock <= 5 ? `Only ${stock} left in stock` : `In stock (${stock} available)`}
              </span>
            ) : (
              <span className="font-semibold text-rose-700">Out of stock</span>
            )}
          </p>

          <p className="mt-6 whitespace-pre-line leading-relaxed text-slate-600">
            {product.description || 'No description provided for this product yet.'}
          </p>
{stock > 0 ? (
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <div className="flex items-center rounded-xl border border-slate-300 bg-white">
                <button
                  type="button"
                  className="px-4 py-2.5 text-lg font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                  onClick={() => setQuantity((current) => clamp(current - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={maxQuantity}
                  value={quantity}
                  onChange={(event) => setQuantity(clamp(event.target.value))}
                  className="w-14 border-x border-slate-200 py-2.5 text-center text-sm font-semibold focus:outline-none"
                  aria-label="Quantity"
                />
                <button
                  type="button"
                  className="px-4 py-2.5 text-lg font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                  onClick={() => setQuantity((current) => clamp(current + 1))}
                  disabled={quantity >= maxQuantity}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <button type="button" className="btn-primary flex-1 sm:flex-none" onClick={handleAdd}>
                Add to cart
              </button>
              <button type="button" className="btn-secondary" onClick={handleBuyNow}>
                Buy now
              </button>
            </div>
          ) : (
            <div className="mt-8">
              <button type="button" className="btn-secondary cursor-not-allowed sm:w-auto" disabled>
                Out of stock
              </button>
            </div>
          )}

          <p className="mt-4 text-xs text-slate-400">
            Maximum {maxQuantity} per order · quantities are re-checked when you check out.
          </p>
        </div>
      </div>
{related.length > 0 ? (
        <section className="mt-16">
          <h2 className="mb-5 text-xl font-bold text-slate-900">More in {product.category}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}