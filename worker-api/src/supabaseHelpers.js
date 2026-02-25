import { createClient } from "@supabase/supabase-js";

import {
  DEFAULT_CAFE_SLUGS
} from "./constants";
import {
  dedupeIntegerIds,
  formatOrderNumber,
  mapMenuItemPayload,
  parseCafeSlugs,
  parseOrderPayload,
  toSafeSlug
} from "./utils";
import { defaultAssetPathForItem } from "./itemImageMap";

export function getSupabase(c) {
  return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function fetchOrderItemsForOrders(c, orderIds) {
  if (!orderIds.length) {
    return new Map();
  }

  const supabase = getSupabase(c);
  const { data: orderItems, error: orderItemsError } = await supabase
    .from("order_items")
    .select("id,order_id,menu_item_id,quantity,item_name,item_price")
    .in("order_id", orderIds)
    .order("id", { ascending: true });

  if (orderItemsError) {
    throw new Error(orderItemsError.message);
  }

  const itemIds = (orderItems || []).map((item) => item.id);
  let extras = [];
  if (itemIds.length) {
    const { data, error } = await supabase
      .from("order_item_extras")
      .select("id,order_item_id,extra_id,extra_name,extra_price")
      .in("order_item_id", itemIds)
      .order("id", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }
    extras = data || [];
  }

  const extrasByItemId = extras.reduce((acc, extra) => {
    if (!acc[extra.order_item_id]) {
      acc[extra.order_item_id] = [];
    }
    acc[extra.order_item_id].push(extra);
    return acc;
  }, {});

  const itemsByOrderId = new Map();
  for (const item of orderItems || []) {
    const withExtras = {
      ...item,
      extras: extrasByItemId[item.id] || []
    };
    if (!itemsByOrderId.has(item.order_id)) {
      itemsByOrderId.set(item.order_id, []);
    }
    itemsByOrderId.get(item.order_id).push(withExtras);
  }

  return itemsByOrderId;
}

export async function fetchOrderById(c, orderId) {
  const supabase = getSupabase(c);
  const { data: order, error } = await supabase
    .from("orders")
    .select("id,order_number,cafe_slug,customer_name,customer_email,table_number,order_date,order_sequence,status,created_at")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!order) {
    return null;
  }

  const itemsByOrder = await fetchOrderItemsForOrders(c, [order.id]);
  return parseOrderPayload(order, itemsByOrder.get(order.id) || []);
}

export async function fetchOrders(c, { cafeSlug = null, includeCompleted = true } = {}) {
  const supabase = getSupabase(c);
  let query = supabase
    .from("orders")
    .select("id,order_number,cafe_slug,customer_name,customer_email,table_number,order_date,order_sequence,status,created_at")
    .order("created_at", { ascending: false });

  if (cafeSlug) {
    query = query.eq("cafe_slug", cafeSlug);
  }

  if (!includeCompleted) {
    query = query.neq("status", "Completed");
  }

  const { data: orders, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  if (!orders?.length) {
    return [];
  }

  const itemsByOrder = await fetchOrderItemsForOrders(c, orders.map((order) => order.id));
  return orders.map((order) => parseOrderPayload(order, itemsByOrder.get(order.id) || []));
}

export async function reserveNextOrderNumber(c, cafeSlug) {
  const supabase = getSupabase(c);
  const counterDate = new Date().toISOString().slice(0, 10);

  await supabase
    .from("cafe_daily_counters")
    .upsert(
      { cafe_slug: cafeSlug, counter_date: counterDate, last_number: 0 },
      { onConflict: "cafe_slug,counter_date", ignoreDuplicates: true }
    );

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const { data: row, error: readError } = await supabase
      .from("cafe_daily_counters")
      .select("last_number")
      .eq("cafe_slug", cafeSlug)
      .eq("counter_date", counterDate)
      .single();

    if (readError) {
      throw new Error(readError.message);
    }

    const currentLast = Number(row?.last_number || 0);
    const candidate = ((currentLast % 900) + 1);
    const { data: updatedRows, error: updateError } = await supabase
      .from("cafe_daily_counters")
      .update({ last_number: candidate })
      .eq("cafe_slug", cafeSlug)
      .eq("counter_date", counterDate)
      .eq("last_number", currentLast)
      .select("last_number");

    if (updateError || !updatedRows?.length) {
      continue;
    }

    return {
      counterDate,
      orderSequence: candidate,
      orderNumber: formatOrderNumber(candidate)
    };
  }

  throw new Error("Daily order number capacity (900) reached for this cafe.");
}

export async function uploadMenuImage(c, file, itemName) {
  const bucket = String(c.env.SUPABASE_MENU_BUCKET || "menu-images").trim();
  const extension = (file.name?.split(".").pop() || "jpg").toLowerCase();
  const safeName = toSafeSlug(itemName || "item");
  const filePath = `menu/${Date.now()}-${safeName}.${extension}`;
  const fileBody = await file.arrayBuffer();

  const supabase = getSupabase(c);
  const { error: uploadError } = await supabase
    .storage
    .from(bucket)
    .upload(filePath, fileBody, {
      contentType: file.type || "application/octet-stream",
      upsert: true
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function replaceMenuItemExtras(c, menuItemId, extraIds) {
  const supabase = getSupabase(c);
  await supabase.from("menu_item_extras").delete().eq("menu_item_id", menuItemId);

  const normalized = dedupeIntegerIds(extraIds || []);
  if (!normalized.length) {
    return;
  }

  const payload = normalized.map((extraId) => ({
    menu_item_id: menuItemId,
    extra_id: extraId
  }));
  const { error } = await supabase.from("menu_item_extras").insert(payload);
  if (error) {
    throw new Error(error.message);
  }
}

export async function replaceMenuItemCafes(c, menuItemId, cafeSlugs) {
  const supabase = getSupabase(c);
  await supabase.from("menu_item_cafes").delete().eq("menu_item_id", menuItemId);

  const normalized = parseCafeSlugs(cafeSlugs, true, DEFAULT_CAFE_SLUGS);
  const payload = normalized.map((cafeSlug) => ({
    menu_item_id: menuItemId,
    cafe_slug: cafeSlug
  }));

  const { error } = await supabase.from("menu_item_cafes").insert(payload);
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchSingleMenuItem(c, menuItemId) {
  const supabase = getSupabase(c);
  const { data: item, error } = await supabase
    .from("menu_items")
    .select("id,name,description,price,image,allow_customization,category_id,categories(id,name,group_name,theme,display_order)")
    .eq("id", menuItemId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const { data: extraLinks, error: extraLinksError } = await supabase
    .from("menu_item_extras")
    .select("menu_item_id,extra_id,extras(id,name,price)")
    .eq("menu_item_id", menuItemId);
  if (extraLinksError) {
    throw new Error(extraLinksError.message);
  }

  const { data: cafeLinks, error: cafeLinksError } = await supabase
    .from("menu_item_cafes")
    .select("menu_item_id,cafe_slug")
    .eq("menu_item_id", menuItemId)
    .order("cafe_slug", { ascending: true });
  if (cafeLinksError) {
    throw new Error(cafeLinksError.message);
  }

  const extrasByItemId = new Map();
  extrasByItemId.set(menuItemId, (extraLinks || []).map((link) => {
    const extra = Array.isArray(link.extras) ? link.extras[0] : link.extras;
    return {
      id: extra?.id ?? link.extra_id,
      name: extra?.name ?? "",
      price: Number(extra?.price ?? 0)
    };
  }).filter((extra) => Number.isInteger(extra.id)));

  const cafesByItemId = new Map();
  cafesByItemId.set(menuItemId, (cafeLinks || []).map((link) => link.cafe_slug));

  return mapMenuItemPayload(item, extrasByItemId, cafesByItemId);
}

export function getOptionalUploadedFile(body, key) {
  if (!(body instanceof FormData)) {
    return null;
  }

  const maybeFile = body.get(key);
  if (maybeFile instanceof File && maybeFile.size > 0) {
    return maybeFile;
  }

  return null;
}

export function getBodyValue(body, key) {
  if (body instanceof FormData) {
    return body.get(key);
  }

  return body[key];
}

export function getStringBodyValue(body, key) {
  const value = getBodyValue(body, key);
  if (value === null || typeof value === "undefined") {
    return "";
  }

  return String(value);
}

export async function loadBody(c) {
  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    return c.req.formData();
  }

  try {
    return await c.req.json();
  } catch (_error) {
    return {};
  }
}

export function defaultImageForItemName(name) {
  return defaultAssetPathForItem(name);
}
