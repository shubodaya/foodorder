import nodemailer from "nodemailer";

const CAFE_LABELS = {
  raysdiner: "Rays Diner",
  lovesgrove: "Loves Grove",
  cosmiccafe: "Cosmic Cafe"
};

let transporter = null;

function formatCurrency(value) {
  return `$${Number(value).toFixed(2)}`;
}

function parseBoolean(value, defaultValue = false) {
  if (typeof value === "undefined") {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!hasSmtpConfig()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: parseBoolean(process.env.SMTP_SECURE, false),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  return transporter;
}

function buildOrderTotals(order) {
  return (order.items || []).reduce((sum, item) => {
    const extrasPerItem = (item.extras || []).reduce((extraSum, extra) => extraSum + Number(extra.extraPrice || 0), 0);
    return sum + (Number(item.itemPrice) + extrasPerItem) * Number(item.quantity);
  }, 0);
}

function buildReceiptText(order) {
  const cafeLabel = CAFE_LABELS[order.cafeSlug] || "Cafe";
  const lines = [
    `${cafeLabel} Receipt`,
    `Order: ${order.orderNumber}`,
    `Customer: ${order.customerName}`,
    `Email: ${order.customerEmail || "-"}`,
    `Placed At: ${new Date(order.createdAt).toLocaleString()}`,
    "",
    "Items:"
  ];

  for (const item of order.items || []) {
    const extrasText = (item.extras || []).map((extra) => extra.extraName).join(", ");
    const extrasPerItem = (item.extras || []).reduce((sum, extra) => sum + Number(extra.extraPrice || 0), 0);
    const lineTotal = (Number(item.itemPrice) + extrasPerItem) * Number(item.quantity);

    lines.push(`- ${item.itemName} x${item.quantity} = ${formatCurrency(lineTotal)}`);
    if (extrasText) {
      lines.push(`  Extras: ${extrasText}`);
    }
  }

  lines.push("");
  lines.push(`Total: ${formatCurrency(buildOrderTotals(order))}`);
  lines.push("Thank you for your order.");

  return lines.join("\n");
}

function buildReceiptHtml(order) {
  const cafeLabel = CAFE_LABELS[order.cafeSlug] || "Cafe";
  const total = buildOrderTotals(order);
  const rows = (order.items || []).map((item) => {
    const extrasText = (item.extras || []).map((extra) => extra.extraName).join(", ");
    const extrasPerItem = (item.extras || []).reduce((sum, extra) => sum + Number(extra.extraPrice || 0), 0);
    const lineTotal = (Number(item.itemPrice) + extrasPerItem) * Number(item.quantity);

    return `
      <tr>
        <td style="padding:8px 0;font-weight:600;">${item.itemName} x ${item.quantity}</td>
        <td style="padding:8px 0;text-align:right;">${formatCurrency(lineTotal)}</td>
      </tr>
      ${extrasText ? `<tr><td colspan="2" style="padding:0 0 8px 0;font-size:12px;color:#6b7280;">Extras: ${extrasText}</td></tr>` : ""}
    `;
  }).join("");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#111827;">
      <h2 style="margin:0 0 12px 0;">${cafeLabel} Receipt</h2>
      <p style="margin:0 0 4px 0;"><strong>Order:</strong> ${order.orderNumber}</p>
      <p style="margin:0 0 4px 0;"><strong>Customer:</strong> ${order.customerName}</p>
      <p style="margin:0 0 4px 0;"><strong>Email:</strong> ${order.customerEmail || "-"}</p>
      <p style="margin:0 0 16px 0;"><strong>Placed:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <hr style="margin:12px 0;border:none;border-top:1px solid #e5e7eb;" />
      <p style="margin:0;font-size:18px;"><strong>Total: ${formatCurrency(total)}</strong></p>
      <p style="margin:10px 0 0 0;color:#4b5563;">Thank you for your order.</p>
    </div>
  `;
}

export async function sendOrderReceipt(order) {
  const receiptsEnabled = parseBoolean(process.env.RECEIPTS_ENABLED, true);

  if (!receiptsEnabled || !order?.customerEmail) {
    return { sent: false, reason: "disabled_or_no_email" };
  }

  const activeTransporter = getTransporter();
  if (!activeTransporter) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const cafeLabel = CAFE_LABELS[order.cafeSlug] || "Cafe";
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

  await activeTransporter.sendMail({
    from: fromAddress,
    to: order.customerEmail,
    subject: `${cafeLabel} Receipt - Order ${order.orderNumber}`,
    text: buildReceiptText(order),
    html: buildReceiptHtml(order)
  });

  return { sent: true, reason: null };
}

function buildReadyText(order) {
  const cafeLabel = CAFE_LABELS[order.cafeSlug] || "Cafe";
  const lines = [
    `${cafeLabel} Update`,
    "",
    `Hi ${order.customerName || "Customer"},`,
    `Your order ${order.orderNumber} is ready for collection.`,
    "",
    "Please head to the collection counter.",
    "Thank you."
  ];

  return lines.join("\n");
}

function buildReadyHtml(order) {
  const cafeLabel = CAFE_LABELS[order.cafeSlug] || "Cafe";
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#111827;">
      <h2 style="margin:0 0 12px 0;">${cafeLabel} - Order Ready</h2>
      <p style="margin:0 0 8px 0;">Hi ${order.customerName || "Customer"},</p>
      <p style="margin:0 0 8px 0;">Your order <strong>${order.orderNumber}</strong> is ready for collection.</p>
      <p style="margin:0 0 8px 0;">Please head to the collection counter.</p>
      <p style="margin:12px 0 0 0;color:#4b5563;">Thank you.</p>
    </div>
  `;
}

export async function sendOrderReadyNotification(order) {
  const receiptsEnabled = parseBoolean(process.env.RECEIPTS_ENABLED, true);

  if (!receiptsEnabled || !order?.customerEmail) {
    return { sent: false, reason: "disabled_or_no_email" };
  }

  const activeTransporter = getTransporter();
  if (!activeTransporter) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const cafeLabel = CAFE_LABELS[order.cafeSlug] || "Cafe";
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

  await activeTransporter.sendMail({
    from: fromAddress,
    to: order.customerEmail,
    subject: `${cafeLabel} - Your Order ${order.orderNumber} Is Ready`,
    text: buildReadyText(order),
    html: buildReadyHtml(order)
  });

  return { sent: true, reason: null };
}
