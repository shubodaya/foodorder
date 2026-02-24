export const CAFE_CONFIGS = [
  {
    slug: "raysdiner",
    label: "Rays Diner"
  },
  {
    slug: "lovesgrove",
    label: "Loves Grove"
  },
  {
    slug: "cosmiccafe",
    label: "Cosmic Cafe"
  }
];

export const DEFAULT_CAFE_SLUG = "raysdiner";

export function normalizeCafeSlug(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidCafeSlug(value) {
  const slug = normalizeCafeSlug(value);
  return CAFE_CONFIGS.some((cafe) => cafe.slug === slug);
}

export function getCafeConfig(value) {
  const slug = normalizeCafeSlug(value);
  return CAFE_CONFIGS.find((cafe) => cafe.slug === slug) || null;
}
