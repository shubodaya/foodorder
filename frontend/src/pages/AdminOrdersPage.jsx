import { useEffect, useMemo, useState } from "react";

import OrderCard from "../components/OrderCard";
import { CAFE_CONFIGS } from "../constants/cafes";
import { getAllOrders, setOrderStatus } from "../services/orderService";
import { getSocket } from "../services/socket";

function sortOrders(orders) {
  const weight = {
    Pending: 0,
    Preparing: 1,
    Ready: 2,
    Completed: 3
  };

  return [...orders].sort((a, b) => {
    const diff = weight[a.status] - weight[b.status];
    if (diff !== 0) {
      return diff;
    }

    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

function upsertOrder(orders, payload) {
  const index = orders.findIndex((order) => order.id === payload.id);
  if (index === -1) {
    return [payload, ...orders];
  }

  return orders.map((order) => (order.id === payload.id ? payload : order));
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [selectedCafeSlug, setSelectedCafeSlug] = useState(CAFE_CONFIGS[0]?.slug || "raysdiner");

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    setOrders([]);

    getAllOrders(selectedCafeSlug)
      .then((data) => {
        if (mounted) {
          setOrders(data);
        }
      })
      .catch((_error) => {
        if (mounted) {
          setError("Unable to load orders.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [selectedCafeSlug]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("admin:join");

    const handleNew = (payload) => {
      if (payload.cafeSlug !== selectedCafeSlug) {
        return;
      }

      setOrders((prev) => upsertOrder(prev, payload));
    };

    const handleStatus = (payload) => {
      if (payload.cafeSlug !== selectedCafeSlug) {
        return;
      }

      setOrders((prev) => upsertOrder(prev, payload));
    };

    socket.on("order:new", handleNew);
    socket.on("order:status", handleStatus);

    return () => {
      socket.off("order:new", handleNew);
      socket.off("order:status", handleStatus);
    };
  }, [selectedCafeSlug]);

  const updateStatus = async (orderId, status) => {
    try {
      const updated = await setOrderStatus(orderId, status);
      setOrders((prev) => prev.map((order) => (order.id === updated.id ? updated : order)));
    } catch (_error) {
      setError("Could not update order status.");
    }
  };

  const activeOrders = useMemo(
    () => sortOrders(orders).filter((order) => order.status !== "Completed"),
    [orders]
  );
  const preparingOrders = useMemo(
    () => activeOrders.filter((order) => order.status === "Pending" || order.status === "Preparing"),
    [activeOrders]
  );
  const readyOrders = useMemo(
    () => activeOrders.filter((order) => order.status === "Ready"),
    [activeOrders]
  );

  return (
    <section className="space-y-5">
      <div className="premium-hero rounded-[2rem] p-6 text-white shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/90">Live Feed</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase">New Orders</h1>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/85">Cafe</p>
            <select
              value={selectedCafeSlug}
              onChange={(event) => setSelectedCafeSlug(event.target.value)}
              className="rounded-xl border border-white/30 bg-black/40 px-3 py-2 text-sm font-semibold text-white"
            >
              {CAFE_CONFIGS.map((cafe) => (
                <option key={cafe.slug} value={cafe.slug}>{cafe.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && <p className="text-sm">Loading orders...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="space-y-4">
          <div className="premium-surface flex items-center justify-between rounded-2xl px-4 py-3 shadow-soft">
            <h2 className="text-xl font-black uppercase">New Orders (Preparing)</h2>
            <span className="rounded-full bg-diner-amber px-3 py-1 text-xs font-bold text-black">
              {preparingOrders.length}
            </span>
          </div>

          <div className="grid gap-4">
            {preparingOrders.map((order) => (
              <OrderCard key={order.id} order={order} onAdvanceStatus={updateStatus} showControls now={now} tone="preparing-large" />
            ))}
            {!loading && !preparingOrders.length && (
              <p className="premium-surface rounded-2xl p-4 text-sm">No orders in preparing queue.</p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-emerald-400/30 bg-emerald-500/20 px-4 py-3 shadow-soft">
            <h2 className="text-lg font-black uppercase text-emerald-100">Ready To Take Out</h2>
            <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
              {readyOrders.length}
            </span>
          </div>

          <div className="grid gap-4">
            {readyOrders.map((order) => (
              <OrderCard key={order.id} order={order} onAdvanceStatus={updateStatus} showControls now={now} tone="ready" />
            ))}
            {!loading && !readyOrders.length && (
              <p className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                No ready orders yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
