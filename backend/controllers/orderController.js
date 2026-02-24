import {
  createOrder,
  getEndOfDayReport,
  getOrderById,
  getOrders,
  ORDER_STATUSES,
  updateOrderStatus
} from "../models/orderModel.js";
import { sendOrderReceipt } from "../services/receiptService.js";
import { saveEndOfDayReceipt } from "../services/endOfDayReceiptService.js";

const ALLOWED_CAFE_SLUGS = new Set(["raysdiner", "lovesgrove", "cosmiccafe"]);
const CAFE_LABELS = {
  raysdiner: "Rays Diner",
  lovesgrove: "Loves Grove",
  cosmiccafe: "Cosmic Cafe"
};

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function normalizeCafeSlug(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeCustomerEmail(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || null;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

function labelForCafe(cafeSlug) {
  return CAFE_LABELS[cafeSlug] || cafeSlug;
}

function buildEndOfDayReceiptText(report) {
  const lines = [
    "Woodlands End Of Day Receipt",
    `Date: ${report.reportDate}`,
    `Cafe: ${report.cafeLabel || "All Cafes"}`,
    `Generated At: ${new Date(report.generatedAt).toLocaleString()}`,
    "",
    `Total Orders: ${report.totals.orderCount}`,
    `Gross Sales: ${formatCurrency(report.totals.grossRevenue)}`,
    `Completed Sales: ${formatCurrency(report.totals.completedRevenue)}`,
    "",
    "Status Breakdown:",
    `- Pending: ${report.statusCounts.Pending || 0}`,
    `- Preparing: ${report.statusCounts.Preparing || 0}`,
    `- Ready: ${report.statusCounts.Ready || 0}`,
    `- Completed: ${report.statusCounts.Completed || 0}`,
    ""
  ];

  if (report.cafes.length) {
    lines.push("Sales By Cafe:");
    for (const cafe of report.cafes) {
      lines.push(
        `- ${cafe.cafeLabel}: ${cafe.orderCount} orders | Gross ${formatCurrency(cafe.grossRevenue)} | Completed ${formatCurrency(cafe.completedRevenue)}`
      );
    }
    lines.push("");
  }

  if (report.items.length) {
    lines.push("Top Items:");
    for (const item of report.items.slice(0, 20)) {
      lines.push(`- ${item.name}: ${item.quantity} sold | ${formatCurrency(item.revenue)}`);
    }
  } else {
    lines.push("Top Items: No items sold.");
  }

  return lines.join("\n");
}

function shapeOrderPayload(order) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    cafeSlug: order.cafe_slug,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    tableNumber: order.table_number,
    orderDate: order.order_date,
    orderSequence: order.order_sequence,
    status: order.status,
    createdAt: order.created_at,
    items: (order.items || []).map((item) => ({
      id: item.id,
      menuItemId: item.menu_item_id,
      quantity: item.quantity,
      itemName: item.item_name,
      itemPrice: Number(item.item_price),
      extras: (Array.isArray(item.extras) ? item.extras : []).map((extra) => ({
        id: extra.id,
        extraId: extra.extra_id,
        extraName: extra.extra_name,
        extraPrice: Number(extra.extra_price)
      }))
    }))
  };
}

async function resolveReceiptDelivery(orderPayload) {
  if (!orderPayload?.customerEmail) {
    return { requested: false, sent: false, reason: "no_email" };
  }

  const timeoutMs = 6000;
  const sendPromise = sendOrderReceipt(orderPayload).catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to send order receipt", error);
    return { sent: false, reason: "send_failed" };
  });

  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve({ sent: false, reason: "timeout" }), timeoutMs);
  });

  const result = await Promise.race([sendPromise, timeoutPromise]);
  return {
    requested: true,
    sent: Boolean(result?.sent),
    reason: result?.reason || null
  };
}

export async function createNewOrder(req, res, next) {
  try {
    const { customerName, customerEmail, tableNumber, cafeSlug, items } = req.body;
    const normalizedCafeSlug = normalizeCafeSlug(cafeSlug);
    const normalizedCustomerEmail = normalizeCustomerEmail(customerEmail);

    if (!customerName || !cafeSlug || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Customer name, cafe slug, and at least one item are required" });
    }

    if (!ALLOWED_CAFE_SLUGS.has(normalizedCafeSlug)) {
      return res.status(400).json({ message: "Invalid cafe slug" });
    }

    if (normalizedCustomerEmail && !isValidEmail(normalizedCustomerEmail)) {
      return res.status(400).json({ message: "Invalid customer email" });
    }

    const normalizedItems = items.map((item) => {
      const rawExtraIds = Array.isArray(item.extraIds) ? item.extraIds : [];
      const hasInvalidExtra = rawExtraIds.some((extraId) => !Number.isInteger(Number(extraId)) || Number(extraId) <= 0);
      const parsedExtraIds = Array.isArray(item.extraIds)
        ? [...new Set(item.extraIds.map((extraId) => Number(extraId)).filter((extraId) => Number.isInteger(extraId) && extraId > 0))]
        : [];

      return {
        menuItemId: Number(item.menuItemId),
        quantity: Number(item.quantity),
        extraIds: parsedExtraIds,
        hasInvalidExtra
      };
    }).filter((item) => Number.isInteger(item.menuItemId) && Number.isInteger(item.quantity) && item.quantity > 0 && !item.hasInvalidExtra);

    if (!normalizedItems.length || normalizedItems.length !== items.length) {
      return res.status(400).json({ message: "Invalid order items" });
    }

    const order = await createOrder({
      customerName: customerName.trim(),
      customerEmail: normalizedCustomerEmail,
      tableNumber: tableNumber ? String(tableNumber).trim() : null,
      cafeSlug: normalizedCafeSlug,
      items: normalizedItems
    });

    const io = req.app.get("io");
    const payload = shapeOrderPayload(order);
    io.to("kitchen").emit("order:new", payload);
    io.to("admin").emit("order:new", payload);
    io.to(`order_${payload.id}`).emit("order:status", payload);
    io.emit("public:order:new", payload);

    const receipt = await resolveReceiptDelivery(payload);
    return res.status(201).json({
      ...payload,
      receipt
    });
  } catch (error) {
    return next(error);
  }
}

export async function listOrders(req, res, next) {
  try {
    const cafeSlug = req.query.cafeSlug ? normalizeCafeSlug(req.query.cafeSlug) : null;
    if (cafeSlug && !ALLOWED_CAFE_SLUGS.has(cafeSlug)) {
      return res.status(400).json({ message: "Invalid cafe slug" });
    }

    const orders = await getOrders(cafeSlug);
    return res.json(orders.map(shapeOrderPayload));
  } catch (error) {
    return next(error);
  }
}

export async function listPublicOrders(req, res, next) {
  try {
    const cafeSlug = req.query.cafeSlug ? normalizeCafeSlug(req.query.cafeSlug) : null;
    if (cafeSlug && !ALLOWED_CAFE_SLUGS.has(cafeSlug)) {
      return res.status(400).json({ message: "Invalid cafe slug" });
    }

    const orders = await getOrders(cafeSlug);
    const activeOrders = orders.filter((order) => order.status !== "Completed");
    return res.json(activeOrders.map(shapeOrderPayload));
  } catch (error) {
    return next(error);
  }
}

export async function getOrderStatus(req, res, next) {
  try {
    const orderId = Number(req.params.id);
    const order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.json(shapeOrderPayload(order));
  } catch (error) {
    return next(error);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const orderId = Number(req.params.id);
    const { status } = req.body;

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const { order, reason } = await updateOrderStatus(orderId, status);

    if (reason === "not_found") {
      return res.status(404).json({ message: "Order not found" });
    }

    if (reason === "invalid_transition") {
      return res.status(400).json({ message: "Invalid status transition" });
    }

    const payload = shapeOrderPayload(order);
    const io = req.app.get("io");
    io.to("kitchen").emit("order:status", payload);
    io.to("admin").emit("order:status", payload);
    io.to(`order_${payload.id}`).emit("order:status", payload);
    io.emit("public:order:status", payload);

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

export async function generateEndOfDayReport(req, res, next) {
  try {
    const reportDate = String(req.query.date || getTodayDateString()).trim();
    const cafeSlug = req.query.cafeSlug ? normalizeCafeSlug(req.query.cafeSlug) : null;

    if (!isValidDateString(reportDate)) {
      return res.status(400).json({ message: "Invalid date. Use YYYY-MM-DD." });
    }

    if (cafeSlug && !ALLOWED_CAFE_SLUGS.has(cafeSlug)) {
      return res.status(400).json({ message: "Invalid cafe slug" });
    }

    const rawReport = await getEndOfDayReport({ reportDate, cafeSlug });
    const report = {
      ...rawReport,
      cafeLabel: cafeSlug ? labelForCafe(cafeSlug) : "All Cafes",
      cafes: rawReport.cafes.map((cafe) => ({
        ...cafe,
        cafeLabel: labelForCafe(cafe.cafeSlug)
      }))
    };
    const receiptText = buildEndOfDayReceiptText(report);
    const savedReceipt = saveEndOfDayReceipt({
      reportDate,
      cafeSlug: cafeSlug || "all-cafes",
      receiptText
    });

    return res.json({
      ...report,
      receiptText,
      savedReceipt
    });
  } catch (error) {
    return next(error);
  }
}
