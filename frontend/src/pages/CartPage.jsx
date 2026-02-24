import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { DEFAULT_CAFE_SLUG, getCafeConfig, isValidCafeSlug, normalizeCafeSlug } from "../constants/cafes";
import { useCart } from "../context/CartContext";
import { placeOrder } from "../services/orderService";
import { getAssetBaseUrl } from "../services/runtimeConfig";

const IMAGE_BASE_URL = getAssetBaseUrl();
const ORDER_POPUP_SECONDS = 15;

function formatCurrency(value) {
  return `$${Number(value).toFixed(2)}`;
}

function getLineTotal(item) {
  const extrasTotal = (item.selectedExtras || []).reduce((sum, extra) => sum + Number(extra.price), 0);
  return (Number(item.price) + extrasTotal) * Number(item.quantity);
}

function formatDisplayOrderNumber(orderNumber) {
  const raw = String(orderNumber || "").trim();
  const suffixMatch = raw.match(/(\d+)$/);
  return suffixMatch ? suffixMatch[1] : raw;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function CartPage() {
  const { cafeSlug: rawCafeSlug } = useParams();
  const cafeSlug = normalizeCafeSlug(rawCafeSlug);
  const validCafe = isValidCafeSlug(cafeSlug);
  const activeCafeSlug = validCafe ? cafeSlug : DEFAULT_CAFE_SLUG;
  const cafe = getCafeConfig(activeCafeSlug);

  const {
    getCafeItems,
    getCafeSubtotal,
    setItemQuantity,
    removeItem,
    clearCafeCart
  } = useCart();
  const navigate = useNavigate();
  const items = getCafeItems(activeCafeSlug);
  const subtotal = getCafeSubtotal(activeCafeSlug);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [placedOrder, setPlacedOrder] = useState(null);
  const [countdown, setCountdown] = useState(ORDER_POPUP_SECONDS);

  useEffect(() => {
    if (!placedOrder) {
      return undefined;
    }

    let remaining = ORDER_POPUP_SECONDS;
    setCountdown(remaining);

    const interval = setInterval(() => {
      remaining -= 1;

      if (remaining <= 0) {
        clearInterval(interval);
        setPlacedOrder(null);
        navigate(`/${activeCafeSlug}/menu`, { replace: true });
        return;
      }

      setCountdown(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [placedOrder, activeCafeSlug, navigate]);

  if (!validCafe) {
    return <Navigate to="/" replace />;
  }

  const submitOrder = async (event) => {
    event.preventDefault();

    if (!customerName.trim()) {
      setError("Customer name is required.");
      return;
    }

    if (customerEmail.trim() && !isValidEmail(customerEmail.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    if (!items.length) {
      setError("Cart is empty.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const order = await placeOrder({
        cafeSlug: activeCafeSlug,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim() ? customerEmail.trim().toLowerCase() : null,
        items: items.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
          extraIds: (item.selectedExtras || []).map((extra) => extra.extraId)
        }))
      });

      clearCafeCart(activeCafeSlug);
      const receiptEmail = customerEmail.trim() ? customerEmail.trim().toLowerCase() : null;
      setCustomerName("");
      setCustomerEmail("");
      setPlacedOrder({
        id: order.id,
        orderNumber: formatDisplayOrderNumber(order.orderNumber || String(order.id)),
        receiptEmail,
        receipt: order.receipt || null
      });
    } catch (_error) {
      setError("Unable to place order right now.");
    } finally {
      setSubmitting(false);
    }
  };

  const closeOrderPopup = () => {
    setPlacedOrder(null);
    navigate(`/${activeCafeSlug}/menu`, { replace: true });
  };

  const receiptStatusMessage = placedOrder?.receiptEmail
    ? (() => {
      if (placedOrder?.receipt?.sent) {
        return `Receipt sent to ${placedOrder.receiptEmail}.`;
      }

      if (placedOrder?.receipt?.reason === "timeout") {
        return `Receipt is processing for ${placedOrder.receiptEmail}. Please check your inbox shortly.`;
      }

      if (placedOrder?.receipt?.reason === "smtp_not_configured") {
        return "Receipt email is currently unavailable at this cafe.";
      }

      if (placedOrder?.receipt?.reason === "disabled_or_no_email") {
        return "Receipt email is currently disabled at this cafe.";
      }

      if (placedOrder?.receipt?.reason === "send_failed") {
        return `Receipt could not be emailed to ${placedOrder.receiptEmail}.`;
      }

      return `Receipt request received for ${placedOrder.receiptEmail}.`;
    })()
    : null;

  return (
    <>
      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <h1 className="text-3xl font-black uppercase">{cafe?.label} Cart</h1>

          {!items.length && <p className="premium-surface rounded-2xl p-4 text-sm">No items in cart.</p>}

          {items.map((item) => (
            <article key={item.cartItemId} className="premium-surface flex flex-wrap items-center gap-4 rounded-3xl p-4 shadow-soft">
              <img
                src={item.image ? `${IMAGE_BASE_URL}${item.image}` : "https://placehold.co/120x120/1f2933/fefae0?text=Item"}
                alt={item.name}
                className="h-20 w-20 rounded-2xl object-cover"
              />

              <div className="min-w-[220px] flex-1 space-y-1">
                <h2 className="text-lg font-bold">{item.name}</h2>
                <p className="text-sm opacity-70">Base: {formatCurrency(item.price)}</p>

                {!!item.selectedExtras?.length && (
                  <ul className="space-y-1 text-xs">
                    {item.selectedExtras.map((extra) => (
                      <li key={`${item.cartItemId}-${extra.extraId}`} className="opacity-80">
                        + {extra.name} ({formatCurrency(extra.price)})
                      </li>
                    ))}
                  </ul>
                )}

                <p className="text-sm font-semibold">Line total: {formatCurrency(getLineTotal(item))}</p>
              </div>

              <div className="flex items-center gap-2">
                <button type="button" className="h-10 w-10 rounded-xl bg-black/10 text-xl transition hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20" onClick={() => setItemQuantity(item.cartItemId, item.quantity - 1)}>-</button>
                <span className="min-w-8 text-center font-bold">{item.quantity}</span>
                <button type="button" className="h-10 w-10 rounded-xl bg-black/10 text-xl transition hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20" onClick={() => setItemQuantity(item.cartItemId, item.quantity + 1)}>+</button>
                <button type="button" className="ml-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-700" onClick={() => removeItem(item.cartItemId)}>Remove</button>
              </div>
            </article>
          ))}
        </div>

        <aside className="premium-surface h-fit rounded-3xl p-5 shadow-panel lg:sticky lg:top-24">
          <h2 className="mb-1 text-xl font-black uppercase">Checkout</h2>
          <p className="mb-4 text-sm opacity-70">Confirm your details and place your order.</p>
          <p className="mb-4 text-lg font-bold">Subtotal: {formatCurrency(subtotal)}</p>

          <form className="space-y-3" onSubmit={submitOrder}>
            <input
              type="text"
              placeholder="Customer Name"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
            />

            <input
              type="email"
              placeholder="Email (optional, for receipt)"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="shimmer-btn w-full rounded-2xl bg-diner-red px-4 py-3 text-base font-bold text-white transition duration-200 hover:brightness-95 disabled:opacity-60"
            >
              {submitting ? "Placing Order..." : "Place Order"}
            </button>
          </form>
        </aside>
      </section>

      {placedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="premium-surface animate-pop-in w-full max-w-2xl rounded-3xl p-8 text-center shadow-panel">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] opacity-70">Order Confirmed</p>
            <h2 className="mt-3 text-2xl font-black uppercase md:text-3xl">Your Order Number</h2>
            <p className="mt-4 bg-gradient-to-r from-diner-red via-diner-teal to-diner-red bg-clip-text text-7xl font-black tracking-[0.16em] text-transparent md:text-8xl">
              {placedOrder.orderNumber}
            </p>

            <div className="mx-auto mt-5 h-2 w-full max-w-md overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                key={placedOrder.id}
                className="countdown-bar h-full rounded-full bg-diner-teal"
                style={{ "--countdown-duration": `${ORDER_POPUP_SECONDS}s` }}
              />
            </div>

            <p className="mt-5 text-sm opacity-75">
              Please watch the live order screen. Returning to menu in {countdown}s.
            </p>

            {receiptStatusMessage && <p className="mt-1 text-xs opacity-65">{receiptStatusMessage}</p>}

            <button
              type="button"
              onClick={closeOrderPopup}
              className="shimmer-btn mt-6 rounded-2xl bg-diner-teal px-6 py-3 text-base font-bold text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
