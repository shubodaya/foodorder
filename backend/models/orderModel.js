import pool from "../config/db.js";

const STATUS_FLOW = ["Pending", "Preparing", "Ready", "Completed"];
const MAX_ORDER_NUMBER = 900;

function formatOrderNumber(sequence) {
  return String(sequence).padStart(2, "0");
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isValidNextStatus(currentStatus, nextStatus) {
  const currentIdx = STATUS_FLOW.indexOf(currentStatus);
  const nextIdx = STATUS_FLOW.indexOf(nextStatus);
  if (currentIdx === -1 || nextIdx === -1) {
    return false;
  }

  // Staff can skip the intermediate Preparing step.
  if (currentStatus === "Pending" && nextStatus === "Ready") {
    return true;
  }

  return nextIdx === currentIdx || nextIdx === currentIdx + 1;
}

function normalizeExtraIds(extraIds = []) {
  return [...new Set(extraIds.filter((extraId) => Number.isInteger(extraId) && extraId > 0))];
}

async function getOrderItems(client, orderId) {
  const { rows } = await client.query(
    `SELECT
       oi.id,
       oi.order_id,
       oi.menu_item_id,
       oi.quantity,
       oi.item_name,
       oi.item_price,
       COALESCE(
         json_agg(
           json_build_object(
             'id', oie.id,
             'extra_id', oie.extra_id,
             'extra_name', oie.extra_name,
             'extra_price', oie.extra_price
           )
           ORDER BY oie.id ASC
         ) FILTER (WHERE oie.id IS NOT NULL),
         '[]'::json
       ) AS extras
     FROM order_items oi
     LEFT JOIN order_item_extras oie ON oie.order_item_id = oi.id
     WHERE oi.order_id = $1
     GROUP BY oi.id
     ORDER BY oi.id ASC`,
    [orderId]
  );

  return rows;
}

async function getNextAvailableDailyNumber(client, cafeSlug) {
  await client.query(
    `INSERT INTO cafe_daily_counters (cafe_slug, counter_date, last_number)
     VALUES ($1, CURRENT_DATE, 0)
     ON CONFLICT (cafe_slug, counter_date) DO NOTHING`,
    [cafeSlug]
  );

  const { rows: counterRows } = await client.query(
    `SELECT counter_date, last_number
     FROM cafe_daily_counters
     WHERE cafe_slug = $1
       AND counter_date = CURRENT_DATE
     FOR UPDATE`,
    [cafeSlug]
  );

  if (!counterRows.length) {
    throw Object.assign(new Error("Unable to reserve order number"), { status: 500 });
  }

  const counterRow = counterRows[0];
  const counterDate = counterRow.counter_date;
  const startNumber = Number(counterRow.last_number) || 0;

  for (let offset = 1; offset <= MAX_ORDER_NUMBER; offset += 1) {
    const candidate = ((startNumber + offset - 1) % MAX_ORDER_NUMBER) + 1;
    const { rows: existsRows } = await client.query(
      `SELECT 1
       FROM orders
       WHERE cafe_slug = $1
         AND order_date = $2::date
         AND order_sequence = $3
       LIMIT 1`,
      [cafeSlug, counterDate, candidate]
    );

    if (existsRows.length) {
      continue;
    }

    await client.query(
      `UPDATE cafe_daily_counters
       SET last_number = $3
       WHERE cafe_slug = $1
         AND counter_date = $2::date`,
      [cafeSlug, counterDate, candidate]
    );

    return {
      counterDate,
      orderSequence: candidate,
      orderNumber: formatOrderNumber(candidate)
    };
  }

  throw Object.assign(
    new Error("Daily order number capacity (900) reached for this cafe."),
    { status: 409 }
  );
}

export async function createOrder({ customerName, customerEmail, tableNumber, cafeSlug, items }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const dailyNumber = await getNextAvailableDailyNumber(client, cafeSlug);
    const orderSequence = dailyNumber.orderSequence;
    const orderNumber = dailyNumber.orderNumber;

    const orderResult = await client.query(
      `INSERT INTO orders (
         cafe_slug,
         customer_name,
         customer_email,
         table_number,
         order_number,
         order_date,
         order_sequence,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending')
       RETURNING
         id,
         order_number,
         cafe_slug,
         customer_name,
         customer_email,
         table_number,
         order_date,
         order_sequence,
         status,
         created_at`,
      [
        cafeSlug,
        customerName,
        customerEmail || null,
        tableNumber || null,
        orderNumber,
        dailyNumber.counterDate,
        orderSequence
      ]
    );

    const order = orderResult.rows[0];

    for (const item of items) {
      const menuResult = await client.query(
        `SELECT m.id, m.name, m.price
         FROM menu_items m
         INNER JOIN menu_item_cafes mic ON mic.menu_item_id = m.id
         WHERE m.id = $1
           AND mic.cafe_slug = $2
         LIMIT 1`,
        [item.menuItemId, cafeSlug]
      );

      if (!menuResult.rows.length) {
        throw Object.assign(new Error(`Menu item ${item.menuItemId} is not available for ${cafeSlug}`), { status: 400 });
      }

      const menuItem = menuResult.rows[0];
      const normalizedExtraIds = normalizeExtraIds(item.extraIds || []);

      let selectedExtras = [];
      if (normalizedExtraIds.length) {
        const extrasResult = await client.query(
          `SELECT e.id, e.name, e.price
           FROM extras e
           INNER JOIN menu_item_extras mie ON mie.extra_id = e.id
           WHERE mie.menu_item_id = $1
             AND e.id = ANY($2::int[])
           ORDER BY e.id ASC`,
          [menuItem.id, normalizedExtraIds]
        );

        selectedExtras = extrasResult.rows;

        if (selectedExtras.length !== normalizedExtraIds.length) {
          throw Object.assign(new Error(`Invalid extras for menu item ${menuItem.id}`), { status: 400 });
        }
      }

      const orderItemResult = await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, item_name, item_price)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [order.id, menuItem.id, item.quantity, menuItem.name, menuItem.price]
      );

      const orderItemId = orderItemResult.rows[0].id;

      for (const extra of selectedExtras) {
        await client.query(
          `INSERT INTO order_item_extras (order_item_id, extra_id, extra_name, extra_price)
           VALUES ($1, $2, $3, $4)`,
          [orderItemId, extra.id, extra.name, extra.price]
        );
      }
    }

    const orderItems = await getOrderItems(client, order.id);

    await client.query("COMMIT");

    return {
      ...order,
      items: orderItems
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getOrders(cafeSlug = null) {
  const filters = [];
  const values = [];

  if (cafeSlug) {
    values.push(cafeSlug);
    filters.push(`cafe_slug = $${values.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const { rows: orders } = await pool.query(
    `SELECT
       id,
       order_number,
       cafe_slug,
       customer_name,
       customer_email,
       table_number,
       order_date,
       order_sequence,
       status,
       created_at
     FROM orders
     ${whereClause}
     ORDER BY created_at DESC`,
    values
  );

  if (!orders.length) {
    return [];
  }

  const orderIds = orders.map((order) => order.id);
  const { rows: items } = await pool.query(
    `SELECT
       oi.id,
       oi.order_id,
       oi.menu_item_id,
       oi.quantity,
       oi.item_name,
       oi.item_price,
       COALESCE(
         json_agg(
           json_build_object(
             'id', oie.id,
             'extra_id', oie.extra_id,
             'extra_name', oie.extra_name,
             'extra_price', oie.extra_price
           )
           ORDER BY oie.id ASC
         ) FILTER (WHERE oie.id IS NOT NULL),
         '[]'::json
       ) AS extras
     FROM order_items oi
     LEFT JOIN order_item_extras oie ON oie.order_item_id = oi.id
     WHERE oi.order_id = ANY($1::int[])
     GROUP BY oi.id
     ORDER BY oi.id ASC`,
    [orderIds]
  );

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.order_id]) {
      acc[item.order_id] = [];
    }
    acc[item.order_id].push(item);
    return acc;
  }, {});

  return orders.map((order) => ({
    ...order,
    items: grouped[order.id] || []
  }));
}

export async function getOrderById(orderId) {
  const { rows: orders } = await pool.query(
    `SELECT
       id,
       order_number,
       cafe_slug,
       customer_name,
       customer_email,
       table_number,
       order_date,
       order_sequence,
       status,
       created_at
     FROM orders
     WHERE id = $1`,
    [orderId]
  );

  const order = orders[0];
  if (!order) {
    return null;
  }

  const client = await pool.connect();
  try {
    const items = await getOrderItems(client, orderId);
    return {
      ...order,
      items
    };
  } finally {
    client.release();
  }
}

export async function updateOrderStatus(orderId, status) {
  const { rows: existingRows } = await pool.query(
    "SELECT id, status FROM orders WHERE id = $1",
    [orderId]
  );

  if (!existingRows.length) {
    return { order: null, reason: "not_found" };
  }

  const existing = existingRows[0];

  if (!isValidNextStatus(existing.status, status)) {
    return { order: null, reason: "invalid_transition" };
  }

  const { rows } = await pool.query(
    `UPDATE orders
     SET status = $2
     WHERE id = $1
     RETURNING
       id,
       order_number,
       cafe_slug,
       customer_name,
       customer_email,
       table_number,
       order_date,
       order_sequence,
       status,
       created_at`,
    [orderId, status]
  );

  const order = rows[0];
  const fullOrder = await getOrderById(order.id);
  return { order: fullOrder, reason: null };
}

export async function getEndOfDayReport({ reportDate, cafeSlug = null }) {
  const values = [reportDate];
  const filters = ["order_date = $1::date"];

  if (cafeSlug) {
    values.push(cafeSlug);
    filters.push(`cafe_slug = $${values.length}`);
  }

  const { rows: orders } = await pool.query(
    `SELECT
       id,
       order_number,
       cafe_slug,
       customer_name,
       status,
       created_at
     FROM orders
     WHERE ${filters.join(" AND ")}
     ORDER BY created_at ASC, id ASC`,
    values
  );

  const orderIds = orders.map((order) => order.id);
  let lineItems = [];

  if (orderIds.length) {
    const { rows } = await pool.query(
      `SELECT
         oi.id,
         oi.order_id,
         oi.item_name,
         oi.quantity,
         oi.item_price,
         COALESCE(SUM(oie.extra_price), 0) AS extras_per_unit
       FROM order_items oi
       LEFT JOIN order_item_extras oie ON oie.order_item_id = oi.id
       WHERE oi.order_id = ANY($1::int[])
       GROUP BY oi.id
       ORDER BY oi.id ASC`,
      [orderIds]
    );

    lineItems = rows;
  }

  const statusCounts = STATUS_FLOW.reduce((acc, status) => ({ ...acc, [status]: 0 }), {});
  const cafeMap = new Map();
  const itemMap = new Map();
  const orderRevenueMap = new Map();
  let grossRevenue = 0;
  let completedRevenue = 0;

  for (const lineItem of lineItems) {
    const quantity = Number(lineItem.quantity);
    const basePrice = toNumber(lineItem.item_price);
    const extrasPerUnit = toNumber(lineItem.extras_per_unit);
    const lineRevenue = (basePrice + extrasPerUnit) * quantity;

    orderRevenueMap.set(
      lineItem.order_id,
      roundMoney((orderRevenueMap.get(lineItem.order_id) || 0) + lineRevenue)
    );

    const currentItem = itemMap.get(lineItem.item_name) || {
      name: lineItem.item_name,
      quantity: 0,
      revenue: 0
    };

    currentItem.quantity += quantity;
    currentItem.revenue = roundMoney(currentItem.revenue + lineRevenue);
    itemMap.set(lineItem.item_name, currentItem);
  }

  for (const order of orders) {
    if (!statusCounts[order.status]) {
      statusCounts[order.status] = 0;
    }
    statusCounts[order.status] += 1;

    const orderRevenue = orderRevenueMap.get(order.id) || 0;
    grossRevenue = roundMoney(grossRevenue + orderRevenue);
    if (order.status === "Completed") {
      completedRevenue = roundMoney(completedRevenue + orderRevenue);
    }

    const currentCafe = cafeMap.get(order.cafe_slug) || {
      cafeSlug: order.cafe_slug,
      orderCount: 0,
      grossRevenue: 0,
      completedRevenue: 0
    };

    currentCafe.orderCount += 1;
    currentCafe.grossRevenue = roundMoney(currentCafe.grossRevenue + orderRevenue);
    if (order.status === "Completed") {
      currentCafe.completedRevenue = roundMoney(currentCafe.completedRevenue + orderRevenue);
    }

    cafeMap.set(order.cafe_slug, currentCafe);
  }

  return {
    reportDate,
    cafeSlug: cafeSlug || null,
    generatedAt: new Date().toISOString(),
    totals: {
      orderCount: orders.length,
      grossRevenue,
      completedRevenue
    },
    statusCounts,
    cafes: [...cafeMap.values()].sort((a, b) => a.cafeSlug.localeCompare(b.cafeSlug)),
    items: [...itemMap.values()].sort((a, b) => {
      if (b.revenue !== a.revenue) {
        return b.revenue - a.revenue;
      }

      return b.quantity - a.quantity;
    })
  };
}

export const ORDER_STATUSES = STATUS_FLOW;
