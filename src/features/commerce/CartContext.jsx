import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { MAX_PER_ITEM, DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from '../../lib/store-config';

const CartContext = createContext(null);
const STORAGE_KEY = 'techmart.cart.v1';

/**
 * The cart lives in localStorage so it survives a refresh and the redirect
 * to Google and back.
 *
 * Only product id + quantity are stored (never prices). Stock is checked
 * against the product's `stock` value and is clipped to MAX_PER_ITEM, and the
 * server re-checks everything in place_order() before any order is written.
 */
function readStoredCart() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((line) => ({
        product_id: String(line?.product_id || ''),
        quantity: Math.min(Math.max(Math.trunc(Number(line?.quantity) || 0), 1), MAX_PER_ITEM),
        product: line?.product && typeof line.product === 'object' ? line.product : null,
      }))
      .filter((line) => line.product_id);
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [lines, setLines] = useState(readStoredCart);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch (error) {
      console.warn('[cart] could not persist cart:', error);
    }
  }, [lines]);

  const loadedProductIds = useMemo(() => lines.map((line) => line.product_id), [lines]);

  /** Adds a product (or increases its quantity), never exceeding its stock. */
  const addItem = useCallback((product, quantity = 1) => {
    const stock = Number(product?.stock ?? 0);
    const requested = Math.max(1, Math.trunc(Number(quantity) || 1));

    let result = { status: 'ok', quantity: requested };

    setLines((current) => {
      const existing = current.find((line) => line.product_id === product.id);
      const nextQuantity = Math.min((existing?.quantity || 0) + requested, stock, MAX_PER_ITEM);

      if (stock <= 0) {
        result = { status: 'out-of-stock', quantity: 0 };
        return current;
      }
      if (nextQuantity <= (existing?.quantity || 0)) {
        result = {
          status: 'limit-reached',
          quantity: existing?.quantity || 0,
          limit: Math.min(stock, MAX_PER_ITEM),
        };
        return current;
      }

      result = { status: existing ? 'increased' : 'added', quantity: nextQuantity };

      if (existing) {
        return current.map((line) =>
          line.product_id === product.id ? { ...line, quantity: nextQuantity, product } : line,
        );
      }
      return [...current, { product_id: product.id, quantity: nextQuantity, product }];
    });

    return result;
  }, []);

  /** Sets an exact quantity; 0 (or less) removes the line. */
  const updateQuantity = useCallback((productId, quantity) => {
    const next = Math.trunc(Number(quantity) || 0);
    let result = { status: 'ok' };

    setLines((current) => {
      const line = current.find((item) => item.product_id === productId);
      if (!line) return current;

      if (next <= 0) {
        result = { status: 'removed' };
        return current.filter((item) => item.product_id !== productId);
      }

      const stock = Number(line.product?.stock ?? Number.MAX_SAFE_INTEGER);
      const cap = Math.min(stock, MAX_PER_ITEM);
      const applied = Math.min(next, cap);
      if (applied < next) result = { status: 'clamped', quantity: applied, limit: cap };

      return current.map((item) =>
        item.product_id === productId ? { ...item, quantity: applied } : item,
      );
    });

    return result;
  }, []);

  const removeItem = useCallback((productId) => {
    setLines((current) => current.filter((line) => line.product_id !== productId));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  /**
   * Refreshes every line against fresh product rows (price + stock) and drops
   * products that have been removed from the catalogue. Returns a summary so
   * the caller can warn the shopper.
   */
  const reconcile = useCallback(
    (products) => {
      const byId = new Map((products || []).map((product) => [product.id, product]));
      const next = [];
      let removed = 0;
      let changed = 0;
      let unavailable = 0;

      for (const line of lines) {
        const product = byId.get(line.product_id);
        if (!product) {
          removed += 1;
          continue;
        }
        if (Number(product.stock ?? 0) <= 0) unavailable += 1;

        const cap = Math.min(Math.max(Number(product.stock ?? 0), 1), MAX_PER_ITEM);
        const quantity = Math.min(line.quantity, cap);
        if (quantity !== line.quantity) changed += 1;

        next.push({ ...line, quantity, product });
      }

      setLines(next);
      return { removed, changed, unavailable };
    },
    [lines],
  );

  const items = useMemo(
    () =>
      lines.map((line) => {
        const price = Number(line.product?.price ?? 0);
        return {
          ...line,
          price,
          stock: Number(line.product?.stock ?? 0),
          lineTotal: price * line.quantity,
          available: Boolean(line.product) && Number(line.product?.stock ?? 0) > 0,
          exceedsStock: Boolean(line.product) && line.quantity > Number(line.product.stock),
        };
      }),
    [lines],
  );

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.available ? item.lineTotal : 0), 0),
    [items],
  );

  const deliveryFee = subtotal <= 0 || subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const total = subtotal + deliveryFee;
  const totalQuantity = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const hasStockIssues = items.some((item) => !item.available || item.exceedsStock);

  const value = useMemo(
    () => ({
      items,
      lines,
      loadedProductIds,
      subtotal,
      deliveryFee,
      total,
      totalQuantity,
      itemCount: items.length,
      isEmpty: items.length === 0,
      hasStockIssues,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      reconcile,
    }),
    [
      items,
      lines,
      loadedProductIds,
      subtotal,
      deliveryFee,
      total,
      totalQuantity,
      hasStockIssues,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      reconcile,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside a <CartProvider>.');
  return context;
}