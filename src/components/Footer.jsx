import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container-page grid gap-8 py-12 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-black text-white">
              T
            </span>
            <span className="font-extrabold text-slate-900">TechMart</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            A demo storefront built with React, Vite, Tailwind CSS, Supabase (Postgres + Auth) and
            Nodemailer, deployed on Vercel.
          </p>
        </div>

        <div className="text-sm">
          <h3 className="font-semibold text-slate-900">Shop</h3>
          <ul className="mt-3 space-y-2 text-slate-500">
            <li>
              <Link className="hover:text-brand-700" to="/shop">
                All products
              </Link>
            </li>
            <li>
              <Link className="hover:text-brand-700" to="/cart">
                Your cart
              </Link>
            </li>
            <li>
              <Link className="hover:text-brand-700" to="/orders">
                My orders
              </Link>
            </li>
          </ul>
        </div>

        <div className="text-sm">
          <h3 className="font-semibold text-slate-900">Support</h3>
          <ul className="mt-3 space-y-2 text-slate-500">
            <li>support@techmart.example</li>
            <li>+234 800 000 0000</li>
            <li>Mon - Fri, 9am - 5pm</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-100 py-5">
        <p className="container-page text-xs text-slate-400">
          &copy; {new Date().getFullYear()} TechMart. Demo project - no real payments are processed.
        </p>
      </div>
    </footer>
  );
}