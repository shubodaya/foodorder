function getBrowserHost() {
  if (typeof window === "undefined") {
    return "localhost";
  }

  return window.location.hostname || "localhost";
}

function getBrowserProtocol() {
  if (typeof window === "undefined") {
    return "http:";
  }

  return window.location.protocol || "http:";
}

function isLoopbackHost(hostname) {
  const normalized = String(hostname || "").toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function resolveConfiguredUrl(configuredUrl) {
  if (!configuredUrl) {
    return "";
  }

  const browserHost = getBrowserHost();

  try {
    const parsed = new URL(configuredUrl);

    if (isLoopbackHost(parsed.hostname) && !isLoopbackHost(browserHost)) {
      parsed.hostname = browserHost;
    }

    return normalizeBaseUrl(parsed.toString());
  } catch (_error) {
    return normalizeBaseUrl(configuredUrl);
  }
}

export function getApiBaseUrl() {
  const configured = resolveConfiguredUrl(import.meta.env.VITE_API_URL);
  if (configured) {
    return configured;
  }

  const browserHost = getBrowserHost();
  const browserProtocol = getBrowserProtocol();
  if (isLoopbackHost(browserHost)) {
    return `${browserProtocol}//${browserHost}:5000/api`;
  }

  return `${browserProtocol}//${browserHost}/api`;
}

export function getAssetBaseUrl() {
  const configured = resolveConfiguredUrl(import.meta.env.VITE_ASSET_BASE_URL);
  if (configured) {
    return configured;
  }

  if (typeof window === "undefined") {
    return "";
  }

  return normalizeBaseUrl(window.location.origin);
}

export function resolveAssetUrl(path, baseOverride = "") {
  const value = String(path || "").trim();
  if (!value) {
    return "";
  }

  if (/^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }

  const base = normalizeBaseUrl(baseOverride || getAssetBaseUrl());
  if (!base) {
    return value.startsWith("/") ? value : `/${value}`;
  }

  return value.startsWith("/") ? `${base}${value}` : `${base}/${value}`;
}
