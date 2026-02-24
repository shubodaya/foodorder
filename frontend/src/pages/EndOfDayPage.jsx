import { useState } from "react";

import { CAFE_CONFIGS } from "../constants/cafes";
import { getEndOfDayReport } from "../services/orderService";

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function EndOfDayPage() {
  const [reportDate, setReportDate] = useState(getTodayDateString);
  const [reportCafeSlug, setReportCafeSlug] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportNotice, setReportNotice] = useState("");
  const [reportData, setReportData] = useState(null);

  const generateReceipt = async () => {
    setReportLoading(true);
    setReportError("");
    setReportNotice("");

    try {
      const report = await getEndOfDayReport({
        date: reportDate,
        ...(reportCafeSlug ? { cafeSlug: reportCafeSlug } : {})
      });

      setReportData(report);
      downloadTextFile(
        `woodlands-eod-${reportDate}-${reportCafeSlug || "all-cafes"}.txt`,
        report.receiptText
      );
      setReportNotice(
        report.savedReceipt?.absolutePath
          ? `Receipt generated, saved to ${report.savedReceipt.absolutePath}, and downloaded.`
          : "Receipt generated and downloaded."
      );
    } catch (_error) {
      setReportError("Unable to generate end-of-day receipt.");
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="premium-hero rounded-[2rem] p-6 text-white shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/90">Staff Reports</p>
        <h1 className="mt-2 text-3xl font-black uppercase">End Of Day Receipt</h1>
      </div>

      <div className="premium-surface space-y-4 rounded-3xl p-5 shadow-soft">
        <p className="text-sm opacity-75">Generate daily sales totals and download receipt for records.</p>

        <div className="grid gap-3 lg:grid-cols-[1fr,1fr,auto]">
          <input
            type="date"
            value={reportDate}
            onChange={(event) => setReportDate(event.target.value)}
            className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
          />

          <select
            value={reportCafeSlug}
            onChange={(event) => setReportCafeSlug(event.target.value)}
            className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
          >
            <option value="">All Cafes</option>
            {CAFE_CONFIGS.map((cafe) => (
              <option key={cafe.slug} value={cafe.slug}>{cafe.label}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={generateReceipt}
            disabled={reportLoading}
            className="shimmer-btn rounded-2xl bg-diner-teal px-5 py-3 text-sm font-bold text-white transition duration-200 hover:brightness-95 disabled:opacity-60"
          >
            {reportLoading ? "Generating..." : "Generate Receipt"}
          </button>
        </div>

        {reportError && <p className="text-sm text-red-500">{reportError}</p>}
        {reportNotice && <p className="text-sm text-emerald-500">{reportNotice}</p>}

        {reportData && (
          <div className="grid gap-3 rounded-2xl bg-black/10 p-4 text-sm dark:bg-white/10 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Orders</p>
              <p className="text-xl font-black">{reportData.totals.orderCount}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Gross Sales</p>
              <p className="text-xl font-black">{formatCurrency(reportData.totals.grossRevenue)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Completed Sales</p>
              <p className="text-xl font-black">{formatCurrency(reportData.totals.completedRevenue)}</p>
            </div>
            <div className="md:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Status</p>
              <p className="mt-1 text-sm">
                Pending: {reportData.statusCounts.Pending || 0} | Preparing: {reportData.statusCounts.Preparing || 0} | Ready: {reportData.statusCounts.Ready || 0} | Completed: {reportData.statusCounts.Completed || 0}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
