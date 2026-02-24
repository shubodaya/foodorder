import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sanitizeSegment(value, fallback) {
  const sanitized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || fallback;
}

function resolveReceiptsDirectory() {
  const configured = process.env.RECEIPTS_DIR ? path.resolve(process.env.RECEIPTS_DIR) : null;
  const candidates = [
    configured,
    path.resolve(process.cwd(), "..", "receipts"),
    path.resolve(process.cwd(), "receipts"),
    path.resolve(__dirname, "..", "receipts")
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  return candidates[0] || path.resolve(process.cwd(), "receipts");
}

export function saveEndOfDayReceipt({ reportDate, cafeSlug, receiptText }) {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(String(reportDate || ""))
    ? String(reportDate)
    : new Date().toISOString().slice(0, 10);
  const safeCafe = sanitizeSegment(cafeSlug || "all-cafes", "all-cafes");
  const filename = `woodlands-eod-${safeDate}-${safeCafe}.txt`;

  const receiptsDir = resolveReceiptsDirectory();
  fs.mkdirSync(receiptsDir, { recursive: true });

  const absolutePath = path.join(receiptsDir, filename);
  fs.writeFileSync(absolutePath, String(receiptText || ""), "utf8");

  return {
    filename,
    absolutePath
  };
}
