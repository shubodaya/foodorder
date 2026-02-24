const colors = {
  Pending: "bg-slate-500 text-white",
  Preparing: "bg-diner-amber text-black",
  Ready: "bg-diner-teal text-white",
  Completed: "bg-emerald-600 text-white"
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${colors[status] || "bg-black text-white"}`}>
      {status}
    </span>
  );
}
