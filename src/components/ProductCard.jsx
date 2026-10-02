import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatPrice, FALLBACK_IMAGE } from '../lib/format';

/** Stock badge wording + colours. */
function stockBadge(stock) {
  if (stock <= 0) return { label: 'Out of stock', className: 'bg-rose-100 text-rose-700' };
  if (stock <= 5) return { label: `Only ${stock} left`, className: 'bg-amber-100 text-amber-800' };
  return { label: 'In stock', className: 'bg-emerald-100 text-emerald-700' };
}

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const stock = Number(product.stock ?? 0);
  const badge = stockBadge(stock);

  function handleAdd() {
    setBusy(true);
    const result = addItem(product, 1);
    setBusy(false);

    if (result.status === 'out-of-stock') {
      toast.error(`"${product.name}" is out of stock.`);
      return;
    }
    if (result.status === 'limit-reached') {
      toast.warning(`You already have the maximum available quantity of "${product.name}".`);
      return;
    }
    toast.success(`"${product.name}" added to your cart.`);
  }

  return (
    <article className="card group flex flex-col overflow-hidden transition hover:shadow-lift">
      <Link to={`/product/${product.id}`} className="relative block aspect-square overflow-hidden bg-slate-100">
        <img
          src={product.image_url || FALLBACK_IMAGE}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = FALLBACK_IMAGE;
          }}
        />
        <span className={`badge absolute left-3 top-3 ${badge.className}`}>{badge.label}</span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{product.category}</p>
        <h3 className="mt-1 line-clamp-2 flex-1 text-sm font-semibold text-slate-900">
          <Link to={`/product/${product.id}`} className="hover:text-brand-700">
            {product.name}
          </Link>
        </h3>
        <p className="mt-2 text-lg font-bold text-slate-900">{formatPrice(product.price)}</p>

        <button
          type="button"
          onClick={handleAdd}
          disabled={busy || stock <= 0}
          className={stock > 0 ? 'btn-primary mt-3 w-full' : 'btn-secondary mt-3 w-full'}
        >
          {stock > 0 ? 'Add to cart' : 'Out of stock'}
        </button>
      </div>
    </article>
  );
}