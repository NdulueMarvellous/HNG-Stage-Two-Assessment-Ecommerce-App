import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { isSupabaseConfigured } from '../lib/supabase';

/** Shown when .env still holds the placeholder keys, so the cause is obvious. */
function SetupBanner() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="container-page py-2.5 text-sm text-amber-900">
        <strong className="font-semibold">Setup needed:</strong> copy <code>.env.example</code> to{' '}
        <code>.env</code>, add your Supabase and SMTP (email) keys, then restart the dev server.
      </div>
    </div>
  );
}

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <SetupBanner />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}