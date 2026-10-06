import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { Alert, EmptyState, ProductGridSkeleton } from '../components/Feedback';
import { fetchProducts } from '../features/catalog/catalog-service';
import { getErrorMessage } from '../lib/error-messages';


const SORTS = {
  featured: { label: 'Featured', compare: (a, b) => a.name.localeCompare(b.name) },
  'price-asc': { label: 'Price: Low to High', compare: (a, b) => a.price - b.price },
  'price-desc': { label: 'Price: High to Low', compare: (a, b) => b.price - a.price },
  name: { label: 'Name: A to Z', compare: (a, b) => a.name.localeCompare(b.name) },
};

const PRICE_RANGES = [
  { id: 'all', label: 'All Prices', min: 0, max: Infinity },
  { id: 'under-50k', label: 'Under ₦50,000', min: 0, max: 50000 },
  { id: '50k-150k', label: '₦50k – ₦150k', min: 50000, max: 150000 },
  { id: '150k-500k', label: '₦150k – ₦500k', min: 150000, max: 500000 },
  { id: 'above-500k', label: '₦500k+', min: 500000, max: Infinity },
];

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState(searchParams.get('category') || 'All');
  const [sort, setSort] = useState('featured');
  const [priceRange, setPriceRange] = useState('all');
  const [inStockOnly, setInStockOnly] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchInput]);

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

  // Sync category from URL param
  useEffect(() => {
    const fromUrl = searchParams.get('category');
    if (fromUrl && fromUrl !== category) setCategory(fromUrl);
  }, [searchParams, category]);

  const categories = useMemo(() => {
    const list = ['All', ...[...new Set(products.map((p) => p.category))].sort()];
    return list;
  }, [products]);

  const activeRange = useMemo(
    () => PRICE_RANGES.find((r) => r.id === priceRange) || PRICE_RANGES[0],
    [priceRange],
  );

  const visible = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();

    const filtered = products.filter((product) => {
      const matchesCategory = category === 'All' || product.category === category;
      const matchesStock = !inStockOnly || product.stock > 0;
      const matchesPrice =
        product.price >= activeRange.min && product.price <= activeRange.max;
      const matchesSearch =
        !needle ||
        product.name.toLowerCase().includes(needle) ||
        product.category.toLowerCase().includes(needle) ||
        String(product.description || '').toLowerCase().includes(needle);

      return matchesCategory && matchesStock && matchesPrice && matchesSearch;
    });

    const comparator = SORTS[sort]?.compare || SORTS.featured.compare;
    return [...filtered].sort(comparator);
  }, [products, category, debouncedSearch, sort, inStockOnly, activeRange]);

  function chooseCategory(next) {
    setCategory(next);
    if (next === 'All') setSearchParams({}, { replace: true });
    else setSearchParams({ category: next }, { replace: true });
  }

  function resetFilters() {
    setSearchInput('');
    setDebouncedSearch('');
    setSort('featured');
    setPriceRange('all');
    setInStockOnly(false);
    chooseCategory('All');
  }

  const filtersActive =
    Boolean(debouncedSearch) ||
    category !== 'All' ||
    inStockOnly ||
    priceRange !== 'all' ||
    sort !== 'featured';

  return (
    <div className="container-page py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Catalogue</h1>
        <p className="mt-2 text-sm text-slate-500">
          {status === 'ready'
            ? `Showing ${visible.length} of ${products.length} product${products.length === 1 ? '' : 's'}`
            : 'Loading the catalogue…'}
        </p>
      </header>

      {/* Category Pills */}
      <div className="mb-6 flex flex-wrap items-center gap-2 overflow-x-auto pb-2">
        {categories.map((item) => {
          const count =
            item === 'All' ? products.length : products.filter((p) => p.category === item).length;
          const isSelected = category === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => chooseCategory(item)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                isSelected
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{item}</span>
              <span
                className={`text-xs ${
                  isSelected ? 'text-brand-100 font-semibold' : 'text-slate-400'
                }`}
              >
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="card mb-8 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="label" htmlFor="shop-search">
            Search products
          </label>
          <div className="relative">
            <input
              id="shop-search"
              type="search"
              className="input pr-9"
              placeholder="Search by name, specs or category…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setDebouncedSearch('');
                }}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="shop-price">
            Price range
          </label>
          <select
            id="shop-price"
            className="input"
            value={priceRange}
            onChange={(event) => setPriceRange(event.target.value)}
          >
            {PRICE_RANGES.map((range) => (
              <option key={range.id} value={range.id}>
                {range.label}
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

        <div className="flex flex-wrap items-center justify-between gap-4 lg:col-span-4 border-t border-slate-100 pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={inStockOnly}
              onChange={(event) => setInStockOnly(event.target.checked)}
            />
            In stock only
          </label>

          {filtersActive && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Active filters:</span>
              {category !== 'All' && (
                <span className="badge bg-slate-100 text-slate-700">
                  {category}
                  <button
                    type="button"
                    onClick={() => chooseCategory('All')}
                    className="ml-1 text-slate-400 hover:text-slate-600"
                  >
                    ×
                  </button>
                </span>
              )}
              {debouncedSearch && (
                <span className="badge bg-slate-100 text-slate-700">
                  "{debouncedSearch}"
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setDebouncedSearch('');
                    }}
                    className="ml-1 text-slate-400 hover:text-slate-600"
                  >
                    ×
                  </button>
                </span>
              )}
              {priceRange !== 'all' && (
                <span className="badge bg-slate-100 text-slate-700">
                  {activeRange.label}
                  <button
                    type="button"
                    onClick={() => setPriceRange('all')}
                    className="ml-1 text-slate-400 hover:text-slate-600"
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                type="button"
                className="btn-ghost btn-sm text-xs font-semibold text-brand-600 hover:text-brand-800"
                onClick={resetFilters}
              >
                Clear all
              </button>
            </div>
          )}
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
          description="Try adjusting your search query, price range, or category filter to discover more products."
          action={
            <button type="button" className="btn-primary" onClick={resetFilters}>
              Reset all filters
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