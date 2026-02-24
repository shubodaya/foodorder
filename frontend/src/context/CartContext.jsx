import { createContext, useContext, useMemo, useState } from "react";

import { DEFAULT_CAFE_SLUG, normalizeCafeSlug } from "../constants/cafes";

const STORAGE_KEY = "rays_cart";

const CartContext = createContext(null);

function normalizeExtras(extras = []) {
  return extras
    .map((extra) => ({
      extraId: Number(extra.extraId ?? extra.id),
      name: extra.name || extra.extraName,
      price: Number(extra.price ?? extra.extraPrice ?? 0)
    }))
    .filter((extra) => Number.isInteger(extra.extraId) && extra.extraId > 0)
    .sort((a, b) => a.extraId - b.extraId);
}

function buildCartItemId(cafeSlug, menuItemId, extras = []) {
  const extraPart = extras.map((extra) => extra.extraId).join("-");
  return `${cafeSlug}:${menuItemId}:${extraPart}`;
}

function normalizeCartItem(item) {
  const selectedExtras = normalizeExtras(item.selectedExtras || item.extras || []);
  const menuItemId = Number(item.id);
  const cafeSlug = normalizeCafeSlug(item.cafeSlug) || DEFAULT_CAFE_SLUG;

  return {
    cartItemId: item.cartItemId || buildCartItemId(cafeSlug, menuItemId, selectedExtras),
    cafeSlug,
    id: menuItemId,
    name: item.name,
    price: Number(item.price),
    image: item.image || null,
    quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
    selectedExtras
  };
}

function loadInitialCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalizeCartItem(item))
      .filter((item) => Number.isInteger(item.id) && item.id > 0);
  } catch (_error) {
    return [];
  }
}

function calculateLineTotal(item) {
  const extrasTotal = item.selectedExtras.reduce((sum, extra) => sum + Number(extra.price), 0);
  return (Number(item.price) + extrasTotal) * Number(item.quantity);
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadInitialCart);

  const persist = (nextItems) => {
    setItems(nextItems);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
  };

  const addItem = (item, cafeSlug = DEFAULT_CAFE_SLUG) => {
    const normalizedCafeSlug = normalizeCafeSlug(cafeSlug) || DEFAULT_CAFE_SLUG;
    const normalized = normalizeCartItem({ ...item, quantity: 1, cafeSlug: normalizedCafeSlug });
    const existing = items.find((entry) => entry.cartItemId === normalized.cartItemId);

    if (existing) {
      persist(items.map((entry) => (
        entry.cartItemId === normalized.cartItemId
          ? { ...entry, quantity: entry.quantity + 1 }
          : entry
      )));
      return;
    }

    persist([...items, normalized]);
  };

  const setItemQuantity = (cartItemId, quantity) => {
    if (quantity <= 0) {
      persist(items.filter((item) => item.cartItemId !== cartItemId));
      return;
    }

    persist(items.map((item) => (item.cartItemId === cartItemId ? { ...item, quantity } : item)));
  };

  const removeItem = (cartItemId) => {
    persist(items.filter((item) => item.cartItemId !== cartItemId));
  };

  const clearCart = () => {
    persist([]);
  };

  const clearCafeCart = (cafeSlug) => {
    const normalizedCafeSlug = normalizeCafeSlug(cafeSlug) || DEFAULT_CAFE_SLUG;
    persist(items.filter((item) => item.cafeSlug !== normalizedCafeSlug));
  };

  const getCafeItems = (cafeSlug) => {
    const normalizedCafeSlug = normalizeCafeSlug(cafeSlug) || DEFAULT_CAFE_SLUG;
    return items.filter((item) => item.cafeSlug === normalizedCafeSlug);
  };

  const getCafeCount = (cafeSlug) => getCafeItems(cafeSlug).reduce((sum, item) => sum + item.quantity, 0);
  const getCafeSubtotal = (cafeSlug) => getCafeItems(cafeSlug).reduce((sum, item) => sum + calculateLineTotal(item), 0);

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + calculateLineTotal(item), 0);

  const value = useMemo(
    () => ({
      items,
      totalCount,
      subtotal,
      addItem,
      setItemQuantity,
      removeItem,
      clearCart,
      clearCafeCart,
      getCafeItems,
      getCafeCount,
      getCafeSubtotal
    }),
    [items, totalCount, subtotal]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
