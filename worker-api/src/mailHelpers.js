import { CAFE_LABELS } from "./constants";
import { formatCurrency, parseBoolean } from "./utils";

async function sendBrevoEmail(c, { to, subject, textContent, htmlContent }) {
  const apiKey = String(c.env.BREVO_API_KEY || "").trim();
  const senderEmail = String(c.env.BREVO_SENDER_EMAIL || c.env.SMTP_FROM || "").trim();
  const senderName = String(c.env.BREVO_SENDER_NAME || "Woodlands").trim();

  if (!apiKey || !senderEmail || !to) {
    return { sent: false, reason: "mail_not_configured" };
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to }],
      subject,
      textContent,
      htmlContent
    })
  });

  if (!response.ok) {
    return { sent: false, reason: "send_failed" };
  }

  return { sent: true, reason: null };
}

function buildOrderTotal(order) {
  return (order.items || []).reduce((sum, item) => {
    const extrasPerItem = (item.extras || []).reduce((extraSum, extra) => extraSum + Number(extra.extraPrice || 0), 0);
    return sum + (Number(item.itemPrice) + extrasPerItem) * Number(item.quantity || 0);
  }, 0);
}

export async function sendOrderReceipt(c, order) {
  if (!parseBoolean(c.env.RECEIPTS_ENABLED, true) || !order?.customerEmail) {
    return { sent: false, reason: "disabled_or_no_email" };
  }

  const cafeLabel = CAFE_LABELS[order.cafeSlug] || "Cafe";
  const total = buildOrderTotal(order);
  const itemsText = (order.items || []).map((item) => {
    const extrasText = (item.extras || []).map((extra) => extra.extraName).join(", ");
    const extrasPerItem = (item.extras || []).reduce((sum, extra) => sum + Number(extra.extraPrice || 0), 0);
    const lineTotal = (Number(item.itemPrice) + extrasPerItem) * Number(item.quantity);
    return `- ${item.itemName} x${item.quantity} = ${formatCurrency(lineTotal)}${extrasText ? ` (Extras: ${extrasText})` : ""}`;
  }).join("\n");

  const text = [
    `${cafeLabel} Receipt`,
    `Order: ${order.orderNumber}`,
    `Customer: ${order.customerName}`,
    "",
    itemsText,
    "",
    `Total: ${formatCurrency(total)}`
  ].join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#111827;">
      <h2 style="margin:0 0 12px 0;">${cafeLabel} Receipt</h2>
      <p style="margin:0 0 6px 0;"><strong>Order:</strong> ${order.orderNumber}</p>
      <p style="margin:0 0 12px 0;"><strong>Customer:</strong> ${order.customerName}</p>
      <p style="margin:0 0 12px 0;white-space:pre-line;">${itemsText}</p>
      <p style="margin:0;"><strong>Total:</strong> ${formatCurrency(total)}</p>
    </div>
  `;

  return sendBrevoEmail(c, {
    to: order.customerEmail,
    subject: `${cafeLabel} Receipt - Order ${order.orderNumber}`,
    textContent: text,
    htmlContent: html
  });
}

export async function sendOrderReadyNotification(c, order) {
  if (!parseBoolean(c.env.RECEIPTS_ENABLED, true) || !order?.customerEmail) {
    return { sent: false, reason: "disabled_or_no_email" };
  }

  const cafeLabel = CAFE_LABELS[order.cafeSlug] || "Cafe";
  const text = [
    `${cafeLabel} Update`,
    "",
    `Hi ${order.customerName || "Customer"},`,
    `Your order ${order.orderNumber} is ready for collection.`,
    "",
    "Please head to the collection counter."
  ].join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#111827;">
      <h2 style="margin:0 0 12px 0;">${cafeLabel} - Order Ready</h2>
      <p style="margin:0 0 8px 0;">Hi ${order.customerName || "Customer"},</p>
      <p style="margin:0 0 8px 0;">Your order <strong>${order.orderNumber}</strong> is ready for collection.</p>
      <p style="margin:0;">Please head to the collection counter.</p>
    </div>
  `;

  return sendBrevoEmail(c, {
    to: order.customerEmail,
    subject: `${cafeLabel} - Your Order ${order.orderNumber} Is Ready`,
    textContent: text,
    htmlContent: html
  });
}
