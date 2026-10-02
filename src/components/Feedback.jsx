const VARIANTS = {
  error: {
    wrapper: 'border-rose-200 bg-rose-50 text-rose-900',
    title: 'Something went wrong',
  },
  warning: { wrapper: 'border-amber-200 bg-amber-50 text-amber-900', title: 'Heads up' },
  success: { wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-900', title: 'Success' },
  info: { wrapper: 'border-sky-200 bg-sky-50 text-sky-900', title: 'Info' },
};

/**
 * Inline message block used for page-level errors, warnings and notices.
 *
 * Exported both as a named export (used by the pages) and as the module
 * default (used by ErrorBoundary), so every import style keeps working.
 */
export function Alert({ variant = 'error', title, children, onRetry, retryLabel = 'Try again' }) {
  const style = VARIANTS[variant] || VARIANTS.info;

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${style.wrapper}`} role="alert">
      <p className="font-semibold">{title || style.title}</p>
      {children ? <div className="mt-1 leading-relaxed">{children}</div> : null}
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-secondary btn-sm mt-3">
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-xl">🛍️</span>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {description ? <p className="max-w-md text-sm text-slate-500">{description}</p> : null}
      {action}
    </div>
  );
}

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="container-page flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
      <Spinner className="h-8 w-8 text-brand-600" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

/** Skeleton cards shown while the catalogue loads. */
export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card overflow-hidden">
          <div className="aspect-square animate-pulse bg-slate-100" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default Alert;