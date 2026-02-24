import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { DEFAULT_CAFE_SLUG, getCafeConfig } from "../constants/cafes";

function clsx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const { getCafeCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const firstPathSegment = location.pathname.split("/").filter(Boolean)[0] || "";
  const activeCafe = getCafeConfig(firstPathSegment);
  const inCustomerPortal = Boolean(activeCafe);
  const brandLabel = "Woodlands";
  const customerBasePath = `/${activeCafe?.slug || DEFAULT_CAFE_SLUG}`;
  const customerCartCount = activeCafe ? getCafeCount(activeCafe.slug) : 0;
  const isOrderBoardPath = /^\/[^/]+\/order-board\/?$/.test(location.pathname);

  const inStaffPortal =
    location.pathname.startsWith("/staff")
    || location.pathname.startsWith("/new-orders")
    || location.pathname.startsWith("/end-of-day")
    || location.pathname.startsWith("/kitchen")
    || location.pathname.startsWith("/admin");

  const handleLogout = () => {
    logout();
    navigate("/staff-login");
  };

  const navBase = "rounded-full px-4 py-2 transition duration-200";
  const navInactive = "bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20";

  if (isOrderBoardPath) {
    return (
      <div className="min-h-screen">
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-black/10 premium-glass">
        <div className="flex w-full items-center justify-between gap-3 px-3 py-3 sm:px-4 md:px-6">
          <Link to="/" className="text-xl font-black uppercase tracking-[0.08em] text-diner-ink dark:text-diner-cream">
            {brandLabel}
          </Link>

          <nav className="flex items-center gap-2 overflow-x-auto pb-1 text-sm font-semibold">
            {inCustomerPortal && !isOrderBoardPath && (
              <>
                <NavLink
                  to={`${customerBasePath}/menu`}
                  className={({ isActive }) => clsx(navBase, isActive ? "bg-diner-red text-white shadow-soft" : navInactive)}
                >
                  Menu
                </NavLink>

                <NavLink
                  to={`${customerBasePath}/cart`}
                  className={({ isActive }) => clsx(navBase, isActive ? "bg-diner-red text-white shadow-soft" : navInactive)}
                >
                  Cart ({customerCartCount})
                </NavLink>
              </>
            )}

            {inStaffPortal && (
              <NavLink
                to="/"
                className={({ isActive }) => clsx(navBase, isActive ? "bg-diner-red text-white shadow-soft" : navInactive)}
              >
                Customer Portal
              </NavLink>
            )}

            {user?.role === "kitchen" && (
              <>
                <NavLink
                  to="/new-orders"
                  className={({ isActive }) => clsx(navBase, isActive ? "bg-diner-teal text-white shadow-soft" : navInactive)}
                >
                  New Orders
                </NavLink>
                <NavLink
                  to="/end-of-day"
                  className={({ isActive }) => clsx(navBase, isActive ? "bg-diner-teal text-white shadow-soft" : navInactive)}
                >
                  End Of Day
                </NavLink>
              </>
            )}

            {user?.role === "admin" && (
              <>
                <NavLink
                  to="/staff-dashboard"
                  className={({ isActive }) => clsx(navBase, isActive ? "bg-diner-teal text-white shadow-soft" : navInactive)}
                >
                  Staff Dashboard
                </NavLink>
                <NavLink
                  to="/staff-menu-management"
                  className={({ isActive }) => clsx(navBase, isActive ? "bg-diner-teal text-white shadow-soft" : navInactive)}
                >
                  Manage Menu
                </NavLink>
                <NavLink
                  to="/new-orders"
                  className={({ isActive }) => clsx(navBase, isActive ? "bg-diner-teal text-white shadow-soft" : navInactive)}
                >
                  New Orders
                </NavLink>
                <NavLink
                  to="/end-of-day"
                  className={({ isActive }) => clsx(navBase, isActive ? "bg-diner-teal text-white shadow-soft" : navInactive)}
                >
                  End Of Day
                </NavLink>
              </>
            )}

            {!user && inStaffPortal && (
              <NavLink
                to="/staff-login"
                className={({ isActive }) => clsx(navBase, isActive ? "bg-diner-teal text-white shadow-soft" : navInactive)}
              >
                Staff Login
              </NavLink>
            )}

            {user && (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full bg-diner-ink px-4 py-2 text-white shadow-soft transition hover:opacity-90 dark:bg-white dark:text-black"
              >
                Logout
              </button>
            )}

          </nav>
        </div>
      </header>

      <main className="w-full px-3 py-4 sm:px-4 md:px-6">{children}</main>
    </div>
  );
}
