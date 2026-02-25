import { useEffect, useMemo, useRef, useState } from "react";

import OrderCard from "../components/OrderCard";
import { getAllOrders, setOrderStatus } from "../services/orderService";

function playNotification() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "square";
  oscillator.frequency.value = 880;
  gainNode.gain.value = 0.1;

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.2);
}

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

const ORDERS_REFRESH_MS = 3000;

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const seenOrderIdsRef = useRef(new Set());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadOrders = async (showLoading) => {
      if (showLoading) {
        setLoading(true);
        setError("");
      }

      try {
        const data = await getAllOrders();
        if (!mounted) {
          return;
        }

        const incomingIds = new Set(
          (data || [])
            .filter((order) => order.status !== "Completed")
            .map((order) => order.id)
        );
        const seenIds = seenOrderIdsRef.current;
        const hasNewOrder = seenIds.size > 0
          && [...incomingIds].some((orderId) => !seenIds.has(orderId));
        if (hasNewOrder) {
          playNotification();
        }

        seenOrderIdsRef.current = incomingIds;
        setOrders(data || []);
      } catch (_error) {
        if (mounted && showLoading) {
          setError("Unable to load orders.");
        }
      } finally {
        if (mounted && showLoading) {
          setLoading(false);
        }
      }
    };

    loadOrders(true);
    const interval = setInterval(() => loadOrders(false), ORDERS_REFRESH_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const updateStatus = async (orderId, status) => {
    try {
      const updated = await setOrderStatus(orderId, status);
      setOrders((prev) => prev.map((order) => (order.id === updated.id ? updated : order)));
    } catch (_error) {
      setError("Could not update order status.");
    }
  };

  const sortedOrders = useMemo(() => sortOrders(orders), [orders]);
  const activeOrders = useMemo(
    () => sortedOrders.filter((order) => order.status !== "Completed"),
    [sortedOrders]
  );

  return (
    <section className="space-y-5">
      <div className="premium-hero rounded-[2rem] p-6 text-white shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/90">Kitchen Screen</p>
            <h1 className="mt-2 text-3xl font-black uppercase">Kitchen Dashboard</h1>
          </div>
          <p className="rounded-full bg-white/20 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em]">Live updates</p>
        </div>
      </div>

      {loading && <p className="text-sm">Loading orders...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {activeOrders.map((order) => (
          <OrderCard key={order.id} order={order} onAdvanceStatus={updateStatus} showControls now={now} />
        ))}
        {!loading && !activeOrders.length && (
          <p className="premium-surface rounded-2xl p-4 text-sm">No active orders.</p>
        )}
      </div>
    </section>
  );
}
