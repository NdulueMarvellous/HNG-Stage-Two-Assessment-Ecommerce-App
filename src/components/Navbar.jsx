import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { STORE_NAME } from '../lib/constants';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/shop', label: 'Shop' },
];

export default function Navbar() {
  const { isAuthenticated, displayName, avatarUrl, loading } = useAuth();
  const { totalQuantity } = useCart();

  const cartLabel = totalQuantity > 0 ? `Cart (${totalQuantity})` : 'Cart';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-4">
        <Link to="/" className="flex items-center gap-2" aria-label={`${STORE_NAME} home`}>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-lg font-black text-white">
            T
          </span>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">{STORE_NAME}</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/orders"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            My Orders
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link to="/cart" className="btn-secondary btn-sm sm:hidden" aria-label={`Open cart, ${totalQuantity} item(s)`}>
            {cartLabel}
          </Link>
          <Link to="/cart" className="btn-secondary btn-sm hidden sm:inline-flex">
            {cartLabel}
          </Link>

          {loading ? (
            <span className="h-9 w-20 animate-pulse rounded-xl bg-slate-100" />
          ) : isAuthenticated ? (
            <Link
              to="/orders"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 transition hover:bg-slate-50"
              title={`Signed in as ${displayName}`}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-6 w-6 rounded-lg object-cover"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">
                  {(displayName || 'U').charAt(0).toUpperCase()}
                </span>
              )}
              <span className="max-w-[10rem] truncate text-sm font-medium text-slate-700">
                {displayName}
              </span>
            </Link>
          ) : (
            <Link to="/login" className="btn-primary btn-sm">
              Sign in
            </Link>
          )}
        </div>
      </div>

      <nav className="container-page flex items-center gap-1 pb-3 sm:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            {item.label}
          </Link>
        ))}
        <Link
          to="/orders"
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          My Orders
        </Link>
      </nav>
    </header>
  );
}