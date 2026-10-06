import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { Alert, ProductGridSkeleton } from '../components/Feedback';
import { fetchProducts } from '../features/catalog/catalog-service';
import { getErrorMessage } from '../lib/error-messages';
import { STORE_NAME } from '../lib/store-config';

const HIGHLIGHTS = [
  { title: 'Real authentication', body: 'Sign in with Google through Supabase Auth.' },
  { title: 'Live stock', body: 'Stock is checked and reduced in Postgres at checkout.' },
  { title: 'Email receipts', body: 'Order confirmations are sent over SMTP with Nodemailer.' },
];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const rows = await fetchProducts();
      setProducts(rows);
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err, 'We could not load the catalogue.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const featured = useMemo(() => products.filter((product) => product.stock > 0).slice(0, 4), [products]);
  const categories = useMemo(() => [...new Set(products.map((product) => product.category))].sort(), [products]);

  return (
    <div>
      <section className="border-b border-slate-200 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white">
        <div className="container-page grid gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="badge bg-white/15 text-brand-100">New season essentials</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Everyday tech and gear, delivered to your door.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-brand-100">
              Browse the catalogue, add what you like to your cart and check out securely. Your order
              is stored in {STORE_NAME} and a confirmation lands in your inbox.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/shop" className="btn bg-white text-brand-800 hover:bg-brand-50">
                Start shopping
              </Link>
              <Link to="/cart" className="btn border border-white/40 text-white hover:bg-white/10">
                View cart
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {HIGHLIGHTS.map((item) => (
              <div key={item.title} className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-brand-100">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        {status === 'error' ? (
          <Alert title="The shop is unavailable" onRetry={load}>
            <p>{error}</p>
          </Alert>
        ) : (
          <>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Featured products</h2>
                <p className="mt-1 text-sm text-slate-500">A few of our best-selling items.</p>
              </div>
              <Link to="/shop" className="link text-sm">
                View all products →
              </Link>
            </div>

            {status === 'loading' ? (
              <ProductGridSkeleton count={4} />
            ) : featured.length === 0 ? (
              <Alert variant="warning" title="No products yet">
                Add products to the <code>products</code> table (see <code>supabase/seed.sql</code>) and
                they will appear here.
              </Alert>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {featured.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {categories.length > 0 ? (
        <section className="border-t border-slate-200 bg-white py-14">
          <div className="container-page">
            <h2 className="text-2xl font-bold text-slate-900">Shop by category</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {categories.map((category) => (
                <Link
                  key={category}
                  to={`/shop?category=${encodeURIComponent(category)}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                >
                  {category}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}