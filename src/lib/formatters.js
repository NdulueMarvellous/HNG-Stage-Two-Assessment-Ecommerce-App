import { CURRENCY } from './store-config';

const LOCALES = { NGN: 'en-NG', USD: 'en-US', GBP: 'en-GB', EUR: 'de-DE' };

/** Formats a number as money, e.g. 189000 -> "₦189,000.00". */
export function formatPrice(value, currency = CURRENCY) {
  const amount = Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(LOCALES[currency] || 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${currency} ${safe.toFixed(2)}`;
  }
}

/** Formats an ISO timestamp, e.g. "2 October 2026, 14:05". */
export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatShortDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(String(email || '').trim());
}

export function digitsOnly(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

/** Product image shown when a product has no image or the image fails to load. */
export const FALLBACK_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
     <rect width="600" height="600" fill="#f1f5f9"/>
     <g fill="none" stroke="#94a3b8" stroke-width="14" stroke-linecap="round" stroke-linejoin="round">
       <rect x="170" y="200" width="260" height="200" rx="18"/>
       <circle cx="230" cy="260" r="20"/>
       <path d="M190 370l80-80 60 60 45-45 55 65"/>
     </g>
     <text x="300" y="470" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" fill="#94a3b8">No image</text>
   </svg>`,
)}`;
