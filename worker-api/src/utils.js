import {
  ALLOWED_CAFE_SLUGS,
  ALLOWED_CUSTOMER_THEMES,
  ALLOWED_MANAGED_ROLES,
  STATUS_FLOW
} from "./constants";

import { defaultAssetPathForItem } from "./itemImageMap";

export function jsonError(c, status, message) {
  return c.json({ message }, status);
}

export function parseBoolean(value, fallback = false) {
  if (typeof value === "undefined" || value === null) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

export function normalizeRole(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ALLOWED_MANAGED_ROLES.has(normalized) ? normalized : null;
}

export function normalizeCafeSlug(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeTheme(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ALLOWED_CUSTOMER_THEMES.has(normalized) ? normalized : null;
}

export function dedupeIntegerIds(values = []) {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value > 0))];
}

export function parseIntegerArray(rawValue) {
  if (typeof rawValue === "undefined") {
    return undefined;
  }

  if (rawValue === null) {
    return [];
  }

  if (Array.isArray(rawValue)) {
    return dedupeIntegerIds(rawValue.map((value) => Number(value)));
  }

  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return dedupeIntegerIds(parsed.map((value) => Number(value)));
      }
    } catch (_error) {
      const parsedCsv = trimmed
        .split(",")
        .map((value) => Number(value.trim()));
      return dedupeIntegerIds(parsedCsv);
    }
  }

  return [];
}

export function parseStringArray(rawValue) {
  if (typeof rawValue === "undefined") {
    return undefined;
  }

  if (rawValue === null) {
    return [];
  }

  const normalize = (value) => String(value || "").trim().toLowerCase();

  if (Array.isArray(rawValue)) {
    return [...new Set(rawValue.map(normalize).filter(Boolean))];
  }

  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.map(normalize).filter(Boolean))];
      }
    } catch (_error) {
      return [...new Set(trimmed.split(",").map(normalize).filter(Boolean))];
    }
  }

  return [];
}

export function parseCafeSlugs(rawValue, fallbackToDefault = false, defaultCafeSlugs = []) {
  const parsed = parseStringArray(rawValue);
  const filtered = (parsed || []).filter((slug) => ALLOWED_CAFE_SLUGS.has(slug));

  if (!filtered.length && fallbackToDefault) {
    return [...defaultCafeSlugs];
  }

  return filtered;
}

export function formatOrderNumber(sequence) {
  return String(sequence).padStart(2, "0");
}

export function isValidNextStatus(currentStatus, nextStatus) {
  const currentIndex = STATUS_FLOW.indexOf(currentStatus);
  const nextIndex = STATUS_FLOW.indexOf(nextStatus);
  if (currentIndex === -1 || nextIndex === -1) {
    return false;
  }

  if (currentStatus === "Pending" && nextStatus === "Ready") {
    return true;
  }

  return nextIndex === currentIndex || nextIndex === currentIndex + 1;
}

export function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export function normalizeCategoryRelation(value) {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value;
}

export function resolveItemImage(itemName, rawImage) {
  const value = String(rawImage || "").trim();
  if (!value) {
    return defaultAssetPathForItem(itemName);
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("/asset/")) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return defaultAssetPathForItem(itemName) || value;
  }

  return value;
}

export function mapMenuItemPayload(row, extrasByItemId, cafesByItemId) {
  const category = normalizeCategoryRelation(row.categories);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    image: resolveItemImage(row.name, row.image),
    allow_customization: Boolean(row.allow_customization),
    category_id: row.category_id,
    category_name: category?.name || null,
    category_group_name: category?.group_name || null,
    category_theme: category?.theme || null,
    extras: extrasByItemId.get(row.id) || [],
    cafe_slugs: cafesByItemId.get(row.id) || []
  };
}

export function parseOrderPayload(order, items = []) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    cafeSlug: order.cafe_slug,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    tableNumber: order.table_number,
    orderDate: order.order_date,
    orderSequence: order.order_sequence,
    status: order.status,
    createdAt: order.created_at,
    items: items.map((item) => ({
      id: item.id,
      menuItemId: item.menu_item_id,
      quantity: item.quantity,
      itemName: item.item_name,
      itemPrice: Number(item.item_price),
      extras: (item.extras || []).map((extra) => ({
        id: extra.id,
        extraId: extra.extra_id,
        extraName: extra.extra_name,
        extraPrice: Number(extra.extra_price)
      }))
    }))
  };
}

export function resolveOriginAllowed(origin, clientUrlRaw) {
  if (!origin) {
    return true;
  }

  const allowed = String(clientUrlRaw || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!allowed.length) {
    return true;
  }

  return allowed.includes(origin);
}

export function toSafeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
