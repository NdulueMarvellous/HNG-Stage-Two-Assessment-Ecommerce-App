import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center justify-center py-24 text-center">
      <p className="text-6xl font-black text-brand-600">404</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        The page you were looking for does not exist or has moved. Try the shop instead.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/shop" className="btn-primary">
          Go to shop
        </Link>
        <Link to="/" className="btn-secondary">
          Back home
        </Link>
      </div>
    </div>
  );
}