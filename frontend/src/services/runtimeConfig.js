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

function resolveServiceUrl(configuredUrl, defaultPort, defaultPath = "") {
  const browserHost = getBrowserHost();
  const browserProtocol = getBrowserProtocol();

  if (configuredUrl) {
    try {
      const parsed = new URL(configuredUrl);

      if (isLoopbackHost(parsed.hostname) && !isLoopbackHost(browserHost)) {
        parsed.hostname = browserHost;
      }

      return parsed.toString().replace(/\/$/, "");
    } catch (_error) {
      // Fall through to safe default.
    }
  }

  const safePath = defaultPath.startsWith("/") ? defaultPath : `/${defaultPath}`;
  return `${browserProtocol}//${browserHost}:${defaultPort}${safePath}`;
}

function resolveSocketFromApiUrl(apiUrl) {
  if (!apiUrl) {
    return null;
  }

  try {
    const parsed = new URL(apiUrl);
    parsed.pathname = parsed.pathname.replace(/\/api\/?$/, "");
    return parsed.toString().replace(/\/$/, "");
  } catch (_error) {
    return null;
  }
}

export function getApiBaseUrl() {
  return resolveServiceUrl(import.meta.env.VITE_API_URL, 5000, "/api");
}

export function getSocketBaseUrl() {
  const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL;
  if (configuredSocketUrl) {
    return resolveServiceUrl(configuredSocketUrl, 5000, "");
  }

  const derivedFromApi = resolveSocketFromApiUrl(import.meta.env.VITE_API_URL);
  if (derivedFromApi) {
    return derivedFromApi;
  }

  return resolveServiceUrl(null, 5000, "");
}

export function getAssetBaseUrl() {
  return getApiBaseUrl().replace(/\/api\/?$/, "");
}
