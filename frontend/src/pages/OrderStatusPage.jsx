import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";

import StatusBadge from "../components/StatusBadge";
import { DEFAULT_CAFE_SLUG, getCafeConfig, isValidCafeSlug, normalizeCafeSlug } from "../constants/cafes";
import { getOrder } from "../services/orderService";
import { getSocket } from "../services/socket";

const STATUS_STEPS = ["Pending", "Preparing", "Ready", "Completed"];

function formatCurrency(value) {
  return `$${Number(value).toFixed(2)}`;
}

export default function OrderStatusPage() {
  const { cafeSlug: rawCafeSlug } = useParams();
  const cafeSlug = normalizeCafeSlug(rawCafeSlug);
  const validCafe = isValidCafeSlug(cafeSlug);
  const activeCafeSlug = validCafe ? cafeSlug : DEFAULT_CAFE_SLUG;
  const cafe = getCafeConfig(activeCafeSlug);

  const [searchParams, setSearchParams] = useSearchParams();
  const queryOrderId = searchParams.get("orderId")
    || localStorage.getItem(`rays_last_order_id_${activeCafeSlug}`)
    || localStorage.getItem("rays_last_order_id")
    || "";

  const [inputOrderId, setInputOrderId] = useState(queryOrderId);
  const [orderId, setOrderId] = useState(queryOrderId);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setInputOrderId(queryOrderId);
    setOrderId(queryOrderId);
  }, [activeCafeSlug, queryOrderId]);

  const loadOrder = async (targetId) => {
    if (!targetId) {
      setOrder(null);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await getOrder(targetId);
      if (data.cafeSlug && data.cafeSlug !== activeCafeSlug) {
        setOrder(null);
        setError("Order not found for this cafe.");
        return;
      }

      setOrder(data);
      localStorage.setItem(`rays_last_order_id_${activeCafeSlug}`, String(targetId));
      localStorage.setItem("rays_last_order_id", String(targetId));
    } catch (_error) {
      setOrder(null);
      setError("Order not found.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!validCafe) {
      return undefined;
    }

    loadOrder(orderId);
    return undefined;
  }, [orderId, validCafe, activeCafeSlug]);

  useEffect(() => {
    if (!orderId || !validCafe) {
      return undefined;
    }

    const socket = getSocket();
    socket.emit("order:watch", Number(orderId));

    const handleStatus = (payload) => {
      if (String(payload.id) === String(orderId)) {
        setOrder(payload);
      }
    };

    socket.on("order:status", handleStatus);

    return () => {
      socket.off("order:status", handleStatus);
    };
  }, [orderId, validCafe, activeCafeSlug]);

  const submitLookup = (event) => {
    event.preventDefault();
    setOrderId(inputOrderId.trim());
    setSearchParams(inputOrderId.trim() ? { orderId: inputOrderId.trim() } : {});
  };

  const statusIndex = useMemo(() => STATUS_STEPS.indexOf(order?.status || "Pending"), [order]);

  if (!validCafe) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-black uppercase">{cafe?.label} Order Status</h1>

      <form onSubmit={submitLookup} className="flex max-w-md gap-2">
        <input
          type="number"
          min="1"
          value={inputOrderId}
          onChange={(event) => setInputOrderId(event.target.value)}
          placeholder="Enter Order ID"
          className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
        />
        <button type="submit" className="rounded-xl bg-diner-teal px-4 py-3 font-bold text-white">Lookup</button>
      </form>

      {loading && <p className="text-sm">Loading...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {order && (
        <article className="space-y-5 rounded-3xl bg-white p-6 shadow-panel dark:bg-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">#{order.orderNumber}</h2>
              <p className="text-sm opacity-70">{order.customerName} {order.tableNumber ? `| Table ${order.tableNumber}` : ""}</p>
            </div>
            <StatusBadge status={order.status} />
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            {STATUS_STEPS.map((step, index) => (
              <div
                key={step}
                className={`rounded-2xl px-3 py-3 text-center text-sm font-bold ${index <= statusIndex ? "bg-diner-red text-white" : "bg-black/10 dark:bg-white/10"}`}
              >
                {step}
              </div>
            ))}
          </div>

          <ul className="space-y-2 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between">
                <div>
                  <span>{item.itemName} x {item.quantity}</span>
                  {!!item.extras?.length && (
                    <ul className="mt-1 text-xs opacity-75">
                      {item.extras.map((extra) => (
                        <li key={extra.id}>
                          + {extra.extraName}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <span>
                  {formatCurrency(
                    (Number(item.itemPrice) + (item.extras || []).reduce((sum, extra) => sum + Number(extra.extraPrice || 0), 0))
                    * Number(item.quantity)
                  )}
                </span>
              </li>
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}
