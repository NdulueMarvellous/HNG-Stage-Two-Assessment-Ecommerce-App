import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { Alert, EmptyState, ProductGridSkeleton } from '../components/Feedback';
import { fetchProducts } from '../lib/products';
import { getErrorMessage } from '../lib/errors';

const SORTS = {
  featured: { label: 'Featured', compare: (a, b) => a.name.localeCompare(b.name) },
  'price-asc': { label: 'Price: low to high', compare: (a, b) => a.price - b.price },
  'price-desc': { label: 'Price: high to low', compare: (a, b) => b.price - a.price },
  name: { label: 'Name: A to Z', compare: (a, b) => a.name.localeCompare(b.name) },
};

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(searchParams.get('category') || 'All');
  const [sort, setSort] = useState('featured');
  const [inStockOnly, setInStockOnly] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      setProducts(await fetchProducts());
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err, 'We could not load the catalogue.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Keeps the category in sync with a ?category= link coming from the home page.
  useEffect(() => {
    const fromUrl = searchParams.get('category');
    if (fromUrl && fromUrl !== category) setCategory(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const categories = useMemo(
    () => ['All', ...[...new Set(products.map((product) => product.category))].sort()],
    [products],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();

    const filtered = products.filter((product) => {
      const matchesCategory = category === 'All' || product.category === category;
      const matchesStock = !inStockOnly || product.stock > 0;
      const matchesSearch =
        !needle ||
        product.name.toLowerCase().includes(needle) ||
        product.category.toLowerCase().includes(needle) ||
        String(product.description || '').toLowerCase().includes(needle);

      return matchesCategory && matchesStock && matchesSearch;
    });

    const comparator = SORTS[sort]?.compare || SORTS.featured.compare;
    return [...filtered].sort(comparator);
  }, [products, category, search, sort, inStockOnly]);

  function chooseCategory(next) {
    setCategory(next);
    if (next === 'All') setSearchParams({}, { replace: true });
    else setSearchParams({ category: next }, { replace: true });
  }

  function resetFilters() {
    setSearch('');
    setSort('featured');
    setInStockOnly(false);
    chooseCategory('All');
  }

  const filtersActive = Boolean(search) || category !== 'All' || inStockOnly || sort !== 'featured';

  return (
    <div className="container-page py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Shop</h1>
        <p className="mt-2 text-sm text-slate-500">
          {status === 'ready'
            ? `${visible.length} of ${products.length} product${products.length === 1 ? '' : 's'}`
            : 'Loading the catalogue…'}
        </p>
      </header>

      <div className="card mb-8 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="label" htmlFor="shop-search">
            Search products
          </label>
          <input
            id="shop-search"
            type="search"
            className="input"
            placeholder="Search by name, category or description…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="shop-category">
            Category
          </label>
          <select
            id="shop-category"
            className="input"
            value={category}
            onChange={(event) => chooseCategory(event.target.value)}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="shop-sort">
            Sort by
          </label>
          <select
            id="shop-sort"
            className="input"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            {Object.entries(SORTS).map(([value, option]) => (
              <option key={value} value={value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 lg:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={inStockOnly}
              onChange={(event) => setInStockOnly(event.target.checked)}
            />
            In stock only
          </label>

          {filtersActive ? (
            <button type="button" className="btn-ghost btn-sm" onClick={resetFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
      </div>
{status === 'error' ? (
        <Alert title="We could not load the catalogue" onRetry={load}>
          <p>{error}</p>
        </Alert>
      ) : status === 'loading' ? (
        <ProductGridSkeleton count={8} />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No products match your filters"
          description="Try a different search term, or clear the filters to see the full catalogue."
          action={
            <button type="button" className="btn-primary" onClick={resetFilters}>
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}