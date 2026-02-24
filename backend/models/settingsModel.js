import pool from "../config/db.js";

const CUSTOMER_THEME_KEY = "customer_portal_theme";
const DEFAULT_CUSTOMER_THEME = "dark";
const ALLOWED_CUSTOMER_THEMES = new Set(["dark", "light"]);

function normalizeTheme(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ALLOWED_CUSTOMER_THEMES.has(normalized) ? normalized : null;
}

export function isAllowedCustomerTheme(value) {
  return Boolean(normalizeTheme(value));
}

export async function getCustomerPortalTheme() {
  const { rows } = await pool.query(
    "SELECT value FROM app_settings WHERE key = $1 LIMIT 1",
    [CUSTOMER_THEME_KEY]
  );

  const stored = rows[0]?.value;
  return normalizeTheme(stored) || DEFAULT_CUSTOMER_THEME;
}

export async function setCustomerPortalTheme(theme) {
  const normalized = normalizeTheme(theme);
  if (!normalized) {
    throw Object.assign(new Error("Invalid customer portal theme"), { status: 400 });
  }

  const { rows } = await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
     RETURNING value, updated_at`,
    [CUSTOMER_THEME_KEY, normalized]
  );

  return {
    customerPortalTheme: rows[0]?.value || DEFAULT_CUSTOMER_THEME,
    updatedAt: rows[0]?.updated_at || null
  };
}
