import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

import { DEFAULT_CAFE_SLUG, getCafeConfig, isValidCafeSlug, normalizeCafeSlug } from "../constants/cafes";
import { login as loginStaff } from "../services/authService";
import { getPublicOrders, setOrderStatus } from "../services/orderService";
import { getPublicSettings } from "../services/settingsService";

const BOARD_AUTH_STORAGE_KEY = "rays_board_staff_auth";
const ORDER_BOARD_REFRESH_MS = 3000;

function sortByCreatedAt(a, b) {
  return new Date(a.createdAt) - new Date(b.createdAt);
}

function formatBoardNumber(orderNumber) {
  const raw = String(orderNumber || "").trim();
  const suffixMatch = raw.match(/(\d+)$/);
  return suffixMatch ? suffixMatch[1] : raw;
}

function normalizeTheme(value) {
  return String(value || "").trim().toLowerCase() === "light" ? "light" : "dark";
}

function getBoardThemeStorageKey(cafeSlug) {
  return `rays_board_theme_${cafeSlug}`;
}

function getStoredBoardTheme(cafeSlug) {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(getBoardThemeStorageKey(cafeSlug));
  return value ? normalizeTheme(value) : null;
}

function loadStoredBoardStaffAuth() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(BOARD_AUTH_STORAGE_KEY) || "null");
    if (!parsed?.token || !parsed?.user) {
      return null;
    }

    const role = String(parsed.user.role || "").toLowerCase();
    if (role !== "admin" && role !== "kitchen") {
      return null;
    }

    return parsed;
  } catch (_error) {
    return null;
  }
}

function saveBoardStaffAuth(authPayload) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(BOARD_AUTH_STORAGE_KEY, JSON.stringify(authPayload));
}

function clearStoredBoardStaffAuth() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(BOARD_AUTH_STORAGE_KEY);
}

export default function OrderBoardPage() {
  const { cafeSlug: rawCafeSlug } = useParams();
  const cafeSlug = normalizeCafeSlug(rawCafeSlug);
  const validCafe = isValidCafeSlug(cafeSlug);
  const activeCafeSlug = validCafe ? cafeSlug : DEFAULT_CAFE_SLUG;
  const cafe = getCafeConfig(activeCafeSlug);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [boardTheme, setBoardTheme] = useState("dark");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [actionNotice, setActionNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [clearing, setClearing] = useState(false);

  const [staffAuth, setStaffAuth] = useState(loadStoredBoardStaffAuth);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const settingsMenuRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!validCafe) {
      return undefined;
    }

    let mounted = true;

    const loadBoardOrders = async (showLoading) => {
      if (showLoading) {
        setLoading(true);
        setError("");
        setOrders([]);
      }

      try {
        const data = await getPublicOrders(activeCafeSlug);
        if (!mounted) {
          return;
        }
        setOrders(data || []);
      } catch (_error) {
        if (mounted && showLoading) {
          setError("Unable to load order board.");
        }
      } finally {
        if (mounted && showLoading) {
          setLoading(false);
        }
      }
    };

    loadBoardOrders(true);
    const interval = setInterval(() => loadBoardOrders(false), ORDER_BOARD_REFRESH_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeCafeSlug, validCafe]);

  useEffect(() => {
    if (!validCafe) {
      return undefined;
    }

    let mounted = true;
    const storedTheme = getStoredBoardTheme(activeCafeSlug);

    if (storedTheme) {
      setBoardTheme(storedTheme);
      return undefined;
    }

    getPublicSettings()
      .then((settings) => {
        if (mounted) {
          setBoardTheme(normalizeTheme(settings?.customerPortalTheme));
        }
      })
      .catch(() => {
        if (mounted) {
          setBoardTheme("dark");
        }
      });

    return () => {
      mounted = false;
    };
  }, [activeCafeSlug, validCafe]);

  useEffect(() => {
    if (!validCafe || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(getBoardThemeStorageKey(activeCafeSlug), normalizeTheme(boardTheme));
  }, [activeCafeSlug, boardTheme, validCafe]);

  useEffect(() => {
    if (!settingsOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!settingsMenuRef.current?.contains(event.target)) {
        setSettingsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [settingsOpen]);

  useEffect(() => {
    setSelectedOrderIds([]);
  }, [selectionMode]);

  useEffect(() => {
    setActionError("");
    setActionNotice("");
  }, [activeCafeSlug]);

  const readyOrders = useMemo(
    () => orders.filter((order) => order.status === "Ready").sort(sortByCreatedAt),
    [orders]
  );

  const preparingOrders = useMemo(
    () => orders
      .filter((order) => order.status === "Pending" || order.status === "Preparing")
      .sort(sortByCreatedAt),
    [orders]
  );

  const clock = useMemo(
    () => new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    [now]
  );

  const readyOrderIds = useMemo(() => readyOrders.map((order) => order.id), [readyOrders]);
  const preparingOrderIds = useMemo(() => preparingOrders.map((order) => order.id), [preparingOrders]);

  useEffect(() => {
    if (!selectionMode) {
      return;
    }

    const allowedIds = selectionMode === "ready" ? readyOrderIds : preparingOrderIds;
    const allowedSet = new Set(allowedIds);
    setSelectedOrderIds((current) => current.filter((id) => allowedSet.has(id)));
  }, [selectionMode, readyOrderIds, preparingOrderIds]);

  const openAuthModal = () => {
    setShowAuthModal(true);
    setSettingsOpen(false);
    setAuthError("");
  };

  const closeAuthModal = () => {
    setShowAuthModal(false);
    setAuthLoading(false);
    setAuthError("");
    setAuthPassword("");
  };

  const signOutBoardStaff = () => {
    setStaffAuth(null);
    clearStoredBoardStaffAuth();
    setSelectionMode(null);
    setSelectedOrderIds([]);
    setSettingsOpen(false);
    setActionNotice("Staff control session signed out.");
    setActionError("");
  };

  const submitBoardAuth = async (event) => {
    event.preventDefault();

    if (!authEmail.trim() || !authPassword) {
      setAuthError("Email and password are required.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");

    try {
      const auth = await loginStaff({
        email: authEmail.trim().toLowerCase(),
        password: authPassword
      });

      const role = String(auth?.user?.role || "").toLowerCase();
      if (role !== "admin" && role !== "kitchen") {
        setAuthError("Only admin or kitchen users can control this board.");
        setAuthLoading(false);
        return;
      }

      setStaffAuth(auth);
      saveBoardStaffAuth(auth);
      setShowAuthModal(false);
      setAuthPassword("");
      setActionError("");
      setActionNotice(`Controls enabled for ${auth.user.name} (${auth.user.role}).`);
    } catch (_error) {
      setAuthError("Invalid email or password.");
    } finally {
      setAuthLoading(false);
    }
  };

  const requireStaffAuth = () => {
    if (staffAuth?.token) {
      return true;
    }

    setActionError("Staff login required to clear orders from this screen.");
    openAuthModal();
    return false;
  };

  const toggleTheme = () => {
    setBoardTheme((current) => (current === "dark" ? "light" : "dark"));
    setSettingsOpen(false);
  };

  const beginSelection = (mode) => {
    if (!requireStaffAuth()) {
      return;
    }

    setSelectionMode(mode);
    setSettingsOpen(false);
    setActionError("");
    setActionNotice(`Selection mode: ${mode === "ready" ? "Ready For Collection" : "Preparing"}. Tap numbers, then clear selected.`);
  };

  const cancelSelection = () => {
    setSelectionMode(null);
    setSelectedOrderIds([]);
    setSettingsOpen(false);
  };

  const toggleOrderSelection = (orderId, mode) => {
    if (selectionMode !== mode) {
      return;
    }

    setSelectedOrderIds((current) => (
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId]
    ));
  };

  const clearSelectedOrders = async () => {
    if (!selectionMode || !selectedOrderIds.length || clearing) {
      return;
    }

    if (!requireStaffAuth()) {
      return;
    }

    setClearing(true);
    setActionError("");
    setActionNotice("");

    const scopedOrders = selectionMode === "ready" ? readyOrders : preparingOrders;
    const selectedOrderSet = new Set(selectedOrderIds);
    const ordersToClear = scopedOrders.filter((order) => selectedOrderSet.has(order.id));

    let clearedCount = 0;
    let failedCount = 0;
    let authFailed = false;

    for (const order of ordersToClear) {
      try {
        if (order.status === "Ready") {
          await setOrderStatus(order.id, "Completed", { token: staffAuth.token });
        } else {
          await setOrderStatus(order.id, "Ready", { token: staffAuth.token });
          await setOrderStatus(order.id, "Completed", { token: staffAuth.token });
        }
        clearedCount += 1;
      } catch (requestError) {
        const statusCode = requestError?.response?.status;
        if (statusCode === 401 || statusCode === 403) {
          authFailed = true;
          break;
        }

        failedCount += 1;
      }
    }

    if (authFailed) {
      setStaffAuth(null);
      clearStoredBoardStaffAuth();
      setSelectionMode(null);
      setSelectedOrderIds([]);
      setActionError("Staff session expired. Please sign in again to clear orders.");
      setClearing(false);
      openAuthModal();
      return;
    }

    if (clearedCount) {
      setActionNotice(`${clearedCount} order${clearedCount > 1 ? "s" : ""} cleared.`);
    }

    if (failedCount) {
      setActionError("Some selected orders could not be cleared.");
    }

    setSelectionMode(null);
    setSelectedOrderIds([]);
    setSettingsOpen(false);
    setClearing(false);
  };

  const isLightTheme = boardTheme === "light";
  const sectionClass = isLightTheme ? "bg-slate-100 text-slate-900" : "bg-slate-950 text-white";
  const clockClass = isLightTheme
    ? "rounded-2xl border border-slate-300 bg-white px-4 py-2 text-xl font-black tracking-wider text-slate-900 md:text-3xl"
    : "rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-xl font-black tracking-wider md:text-3xl";
  const menuButtonClass = isLightTheme
    ? "rounded-2xl border border-slate-300 bg-white p-2 text-slate-700 shadow-soft transition hover:bg-slate-100"
    : "rounded-2xl border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20";
  const dropdownClass = isLightTheme
    ? "absolute right-0 top-12 z-30 w-80 space-y-1 rounded-2xl border border-slate-300 bg-white p-2 shadow-panel"
    : "absolute right-0 top-12 z-30 w-80 space-y-1 rounded-2xl border border-white/15 bg-slate-900/95 p-2 shadow-panel";
  const dropdownItemClass = isLightTheme
    ? "w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
    : "w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-white/90 transition hover:bg-white/10";
  const noticeClass = isLightTheme
    ? "rounded-2xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900"
    : "rounded-2xl bg-blue-500/20 px-4 py-3 text-sm text-blue-100";
  const errorClass = isLightTheme
    ? "rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
    : "rounded-2xl bg-red-600/20 px-4 py-3 text-sm text-red-200";
  const loadingClass = isLightTheme
    ? "rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
    : "rounded-2xl bg-white/10 px-4 py-3 text-sm";

  if (!validCafe) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <section className={`min-h-screen px-4 py-6 md:px-8 md:py-10 ${sectionClass}`}>
        <div className="w-full space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${isLightTheme ? "text-slate-600" : "text-white/70"}`}>Live Order Screen</p>
              <h1 className="text-3xl font-black uppercase md:text-5xl">{cafe?.label}</h1>
            </div>

            <div ref={settingsMenuRef} className="relative flex items-center gap-2">
              <div className={clockClass}>{clock}</div>
              <button
                type="button"
                aria-label="Order board settings"
                className={menuButtonClass}
                onClick={() => setSettingsOpen((current) => !current)}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                  <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.8" />
                  <path
                    d="M19.4 15.1a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6h.2a2 2 0 1 1 0 4H20a1 1 0 0 0-.9.6Z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {settingsOpen && (
                <div className={dropdownClass}>
                  {staffAuth?.user ? (
                    <div className={`rounded-xl px-3 py-2 text-xs ${isLightTheme ? "bg-slate-100 text-slate-700" : "bg-white/10 text-white/80"}`}>
                      Signed in: {staffAuth.user.name} ({staffAuth.user.role})
                    </div>
                  ) : (
                    <button type="button" className={dropdownItemClass} onClick={openAuthModal}>
                      Staff Sign In For Clear Controls
                    </button>
                  )}

                  <button type="button" className={dropdownItemClass} onClick={toggleTheme}>
                    Switch to {isLightTheme ? "dark" : "light"} mode
                  </button>

                  <button type="button" className={dropdownItemClass} onClick={() => beginSelection("ready")}>
                    Select ready numbers to clear
                  </button>
                  <button type="button" className={dropdownItemClass} onClick={() => beginSelection("preparing")}>
                    Select preparing numbers to clear
                  </button>

                  {selectionMode && (
                    <>
                      <button
                        type="button"
                        className={`${dropdownItemClass} ${!selectedOrderIds.length || clearing ? "opacity-50" : ""}`}
                        onClick={clearSelectedOrders}
                        disabled={!selectedOrderIds.length || clearing}
                      >
                        {clearing ? "Clearing..." : `Clear selected (${selectedOrderIds.length})`}
                      </button>
                      <button type="button" className={dropdownItemClass} onClick={cancelSelection}>
                        Cancel selection
                      </button>
                    </>
                  )}

                  {staffAuth?.user && (
                    <button type="button" className={dropdownItemClass} onClick={signOutBoardStaff}>
                      Sign Out Staff Control
                    </button>
                  )}
                </div>
              )}
            </div>
          </header>

          {selectionMode && (
            <p className={noticeClass}>
              Selection mode: <span className="font-bold">{selectionMode === "ready" ? "Ready For Collection" : "Preparing"}</span>.
              Tap order numbers to select, then clear from the settings menu.
            </p>
          )}

          {actionNotice && <p className={noticeClass}>{actionNotice}</p>}
          {actionError && <p className={errorClass}>{actionError}</p>}

          {loading && <p className={loadingClass}>Loading orders...</p>}
          {error && <p className={errorClass}>{error}</p>}

          <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <article className={`rounded-3xl border p-4 md:p-6 ${
              isLightTheme
                ? "border-emerald-400/70 bg-emerald-100/70"
                : "border-emerald-300/30 bg-emerald-500/10"
            }`}
            >
              <h2 className={`text-lg font-black uppercase tracking-wide md:text-2xl ${isLightTheme ? "text-emerald-800" : "text-emerald-300"}`}>Ready For Collection</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {readyOrders.slice(0, 24).map((order) => (
                  <button
                    type="button"
                    key={order.id}
                    onClick={() => toggleOrderSelection(order.id, "ready")}
                    className={`rounded-2xl border px-3 py-5 text-center text-3xl font-black tracking-[0.16em] sm:text-4xl ${
                      isLightTheme
                        ? "border-emerald-300 bg-white/75 text-emerald-900"
                        : "border-emerald-200/30 bg-emerald-300/20"
                    } ${
                      selectionMode === "ready" ? "cursor-pointer transition hover:scale-[1.02]" : "cursor-default"
                    } ${
                      selectedOrderIds.includes(order.id)
                        ? (isLightTheme ? "ring-4 ring-emerald-500" : "ring-4 ring-emerald-300")
                        : ""
                    }`}
                  >
                    {formatBoardNumber(order.orderNumber)}
                  </button>
                ))}
              </div>
              {!readyOrders.length && !loading && (
                <p className={`mt-4 rounded-2xl px-4 py-4 text-center text-sm font-semibold uppercase tracking-wide ${
                  isLightTheme ? "border border-slate-300 bg-white text-slate-600" : "bg-white/10 text-white/70"
                }`}
                >
                  No ready orders yet
                </p>
              )}
            </article>

            <article className={`rounded-3xl border p-4 md:p-6 ${
              isLightTheme
                ? "border-amber-400/70 bg-amber-100/80"
                : "border-amber-300/30 bg-amber-500/10"
            }`}
            >
              <h2 className={`text-lg font-black uppercase tracking-wide md:text-2xl ${isLightTheme ? "text-amber-900" : "text-amber-300"}`}>Preparing</h2>
              <div className="mt-4 space-y-2">
                {preparingOrders.slice(0, 18).map((order) => (
                  <button
                    type="button"
                    key={order.id}
                    onClick={() => toggleOrderSelection(order.id, "preparing")}
                    className={`w-full rounded-xl border px-3 py-3 text-center text-2xl font-black tracking-[0.14em] ${
                      isLightTheme
                        ? "border-amber-300 bg-white/75 text-amber-900"
                        : "border-amber-200/20 bg-amber-300/20"
                    } ${
                      selectionMode === "preparing" ? "cursor-pointer transition hover:scale-[1.01]" : "cursor-default"
                    } ${
                      selectedOrderIds.includes(order.id)
                        ? (isLightTheme ? "ring-4 ring-amber-500" : "ring-4 ring-amber-300")
                        : ""
                    }`}
                  >
                    {formatBoardNumber(order.orderNumber)}
                  </button>
                ))}
              </div>
              {!preparingOrders.length && !loading && (
                <p className={`mt-4 rounded-2xl px-4 py-4 text-center text-sm font-semibold uppercase tracking-wide ${
                  isLightTheme ? "border border-slate-300 bg-white text-slate-600" : "bg-white/10 text-white/70"
                }`}
                >
                  No orders in progress
                </p>
              )}
            </article>
          </div>
        </div>
      </section>

      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/20 bg-slate-900/95 p-5 text-white shadow-panel">
            <h2 className="text-xl font-black uppercase">Staff Authentication</h2>
            <p className="mt-2 text-xs text-white/70">
              Sign in with staff credentials to clear selected orders.
            </p>
            <p className="mt-2 text-xs text-white/70">
              Admin default: admin@raysdiner.local / admin123
              <br />
              Kitchen default: kitchen@raysdiner.local / kitchen123
            </p>

            <form onSubmit={submitBoardAuth} className="mt-4 space-y-3">
              <input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="Email"
                className="w-full rounded-xl border border-white/25 bg-white/10 px-3 py-3 text-sm text-white placeholder:text-white/65"
                required
              />
              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-white/25 bg-white/10 px-3 py-3 text-sm text-white placeholder:text-white/65"
                required
              />

              {authError && <p className="text-sm text-red-300">{authError}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="shimmer-btn flex-1 rounded-2xl bg-diner-red px-4 py-3 text-sm font-bold text-white"
                >
                  {authLoading ? "Signing In..." : "Sign In"}
                </button>
                <button
                  type="button"
                  onClick={closeAuthModal}
                  className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
