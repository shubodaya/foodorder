import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import AppLayout from "./components/AppLayout";
import CafeMenuRedirect from "./components/CafeMenuRedirect";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminMenuPage from "./pages/AdminMenuPage";
import AdminOrdersPage from "./pages/AdminOrdersPage";
import CartPage from "./pages/CartPage";
import EndOfDayPage from "./pages/EndOfDayPage";
import LoginPage from "./pages/LoginPage";
import MenuPage from "./pages/MenuPage";
import OrderBoardPage from "./pages/OrderBoardPage";
import PortalPage from "./pages/PortalPage";
import { getPublicSettings } from "./services/settingsService";
import { getSocket } from "./services/socket";

const STAFF_ROUTE_PREFIXES = [
  "/staff",
  "/new-orders",
  "/end-of-day",
  "/kitchen",
  "/admin",
  "/login"
];

function isStaffRoute(pathname) {
  if (pathname === "/staff-login") {
    return true;
  }

  return STAFF_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function normalizeCustomerTheme(value) {
  return String(value || "").trim().toLowerCase() === "light" ? "light" : "dark";
}

export default function App() {
  const location = useLocation();
  const [customerPortalTheme, setCustomerPortalTheme] = useState("dark");

  useEffect(() => {
    let active = true;

    getPublicSettings()
      .then((settings) => {
        if (!active) {
          return;
        }
        setCustomerPortalTheme(normalizeCustomerTheme(settings?.customerPortalTheme));
      })
      .catch(() => {
        // Keep default dark theme when settings are unavailable.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const handleThemeUpdate = (payload) => {
      setCustomerPortalTheme(normalizeCustomerTheme(payload?.theme));
    };

    socket.on("settings:customerTheme", handleThemeUpdate);

    return () => {
      socket.off("settings:customerTheme", handleThemeUpdate);
    };
  }, []);

  useEffect(() => {
    const shouldUseDarkTheme = isStaffRoute(location.pathname) || customerPortalTheme !== "light";
    document.documentElement.classList.toggle("dark", shouldUseDarkTheme);

    try {
      localStorage.setItem("rays_theme", shouldUseDarkTheme ? "dark" : "light");
    } catch (_error) {
      // Ignore storage restrictions.
    }
  }, [location.pathname, customerPortalTheme]);

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<PortalPage />} />
        <Route path="/menu" element={<Navigate to="/raysdiner/menu" replace />} />
        <Route path="/cart" element={<Navigate to="/raysdiner/cart" replace />} />
        <Route path="/order-status" element={<Navigate to="/raysdiner/menu" replace />} />
        <Route path="/:cafeSlug/menu" element={<MenuPage />} />
        <Route path="/:cafeSlug/cart" element={<CartPage />} />
        <Route path="/:cafeSlug/order-status" element={<CafeMenuRedirect />} />
        <Route path="/:cafeSlug/order-board" element={<OrderBoardPage />} />
        <Route path="/staff-login" element={<LoginPage />} />
        <Route path="/login" element={<Navigate to="/staff-login" replace />} />
        <Route
          path="/kitchen"
          element={(
            <ProtectedRoute roles={["kitchen", "admin"]}>
              <Navigate to="/new-orders" replace />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/staff-dashboard"
          element={(
            <ProtectedRoute roles={["admin"]}>
              <AdminDashboardPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/staff-menu-management"
          element={(
            <ProtectedRoute roles={["admin"]}>
              <AdminMenuPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/new-orders"
          element={(
            <ProtectedRoute roles={["admin", "kitchen"]}>
              <AdminOrdersPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/end-of-day"
          element={(
            <ProtectedRoute roles={["admin", "kitchen"]}>
              <EndOfDayPage />
            </ProtectedRoute>
          )}
        />
        <Route path="/staff-orders" element={<Navigate to="/new-orders" replace />} />
        <Route path="/admin" element={<Navigate to="/staff-dashboard" replace />} />
        <Route path="/admin/menu" element={<Navigate to="/staff-menu-management" replace />} />
        <Route path="/admin/orders" element={<Navigate to="/new-orders" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
