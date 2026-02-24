import StatusBadge from "./StatusBadge";

const NEXT_STATUS = {
  Pending: "Ready",
  Preparing: "Ready",
  Ready: "Completed",
  Completed: null
};

function formatCurrency(value) {
  return `$${Number(value).toFixed(2)}`;
}

function formatDuration(createdAt, nowMs) {
  const diffMs = nowMs - new Date(createdAt).getTime();
  const totalMins = Math.max(0, Math.floor(diffMs / 60000));
  const mins = totalMins % 60;
  const hours = Math.floor(totalMins / 60);

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }

  return `${mins}m`;
}

export default function OrderCard({ order, onAdvanceStatus, showControls, now = Date.now(), tone = "default" }) {
  const next = NEXT_STATUS[order.status];
  const isLarge = tone === "preparing-large";
  const completedCardClass = tone === "ready"
    ? "border-emerald-500/40 bg-emerald-500/14 dark:bg-emerald-900/30"
    : order.status === "Completed"
    ? "border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-900/30"
    : "border-black/10 bg-white dark:border-white/10 dark:bg-slate-800";
  const cardPaddingClass = isLarge ? "p-6 md:p-7" : "p-5";
  const watermarkSizeClass = isLarge ? "text-[7rem] md:text-[8rem]" : "text-[5.5rem]";
  const orderNumberClass = isLarge ? "text-2xl md:text-3xl" : "text-lg";
  const customerMetaClass = isLarge ? "text-base opacity-75" : "text-sm opacity-70";
  const timerChipClass = isLarge
    ? "rounded-full bg-black/10 px-3 py-1.5 text-sm font-bold dark:bg-white/10"
    : "rounded-full bg-black/10 px-3 py-1 text-xs font-bold dark:bg-white/10";
  const itemListClass = isLarge ? "relative z-10 mb-5 space-y-3 text-base md:text-lg" : "relative z-10 mb-4 space-y-2 text-sm";
  const extrasListClass = isLarge ? "mt-1 text-sm opacity-80" : "mt-1 text-xs opacity-75";
  const totalClass = isLarge ? "text-lg font-black" : "font-bold";
  const actionButtonClass = isLarge
    ? "rounded-2xl bg-diner-red px-5 py-2.5 text-base font-black text-white"
    : "rounded-2xl bg-diner-red px-4 py-2 font-bold text-white";
  const total = order.items.reduce((sum, item) => {
    const extrasPerItem = (item.extras || []).reduce((extraSum, extra) => extraSum + Number(extra.extraPrice || 0), 0);
    return sum + (Number(item.itemPrice) + extrasPerItem) * Number(item.quantity);
  }, 0);

  return (
    <article className={`relative overflow-hidden rounded-3xl border shadow-panel ${cardPaddingClass} ${completedCardClass}`}>
      <div className={`pointer-events-none absolute -right-2 -top-6 select-none font-black tracking-wider text-black/10 dark:text-white/10 ${watermarkSizeClass}`}>
        {order.orderNumber}
      </div>

      <div className="relative z-10 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={`font-black ${orderNumberClass}`}>{order.orderNumber}</h3>
          <p className={customerMetaClass}>{order.customerName} {order.tableNumber ? `| Table ${order.tableNumber}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} />
          <span className={timerChipClass}>
            {formatDuration(order.createdAt, now)}
          </span>
        </div>
      </div>

      <ul className={itemListClass}>
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between">
            <div>
              <span className="font-semibold">{item.itemName} x {item.quantity}</span>
              {!!item.extras?.length && (
                <ul className={extrasListClass}>
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

      <div className="relative z-10 flex items-center justify-between">
        <span className={totalClass}>Total {formatCurrency(total)}</span>

        {showControls && next && (
          <button
            type="button"
            className={actionButtonClass}
            onClick={() => onAdvanceStatus(order.id, next)}
          >
            Move to {next}
          </button>
        )}
      </div>
    </article>
  );
}
