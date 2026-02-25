import { Hono } from "hono";
import { cors } from "hono/cors";
import bcrypt from "bcryptjs";

import {
  ALLOWED_CAFE_SLUGS,
  CAFE_LABELS,
  CUSTOMER_THEME_KEY,
  DEFAULT_CAFE_SLUGS,
  DEFAULT_CUSTOMER_THEME,
  STATUS_FLOW
} from "./constants";
import { allowRoles, authRequired, signAuthToken } from "./authHelpers";
import { sendOrderReadyNotification, sendOrderReceipt } from "./mailHelpers";
import {
  defaultImageForItemName,
  fetchOrderById,
  fetchOrders,
  fetchSingleMenuItem,
  getBodyValue,
  getOptionalUploadedFile,
  getStringBodyValue,
  getSupabase,
  loadBody,
  replaceMenuItemCafes,
  replaceMenuItemExtras,
  reserveNextOrderNumber,
  uploadMenuImage
} from "./supabaseHelpers";
import {
  dedupeIntegerIds,
  isValidEmail,
  isValidNextStatus,
  jsonError,
  mapMenuItemPayload,
  normalizeCafeSlug,
  normalizeEmail,
  normalizeRole,
  normalizeTheme,
  parseBoolean,
  parseCafeSlugs,
  parseIntegerArray,
  resolveOriginAllowed,
  roundMoney,
  toNumber
} from "./utils";

const app = new Hono();

app.use("/api/*", cors({
  origin: (origin, c) => (resolveOriginAllowed(origin, c.env.CLIENT_URL) ? origin || "*" : null),
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"]
}));

app.get("/api/health", (c) => c.json({ ok: true }));

app.post("/api/auth/login", async (c) => {
  try {
    const body = await loadBody(c);
    const email = normalizeEmail(getBodyValue(body, "email"));
    const password = String(getBodyValue(body, "password") || "");

    if (!email || !password) {
      return jsonError(c, 400, "Email and password are required");
    }

    const supabase = getSupabase(c);
    const { data: user, error } = await supabase
      .from("users")
      .select("id,name,email,password,role")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!user) {
      return jsonError(c, 401, "Invalid credentials");
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return jsonError(c, 401, "Invalid credentials");
    }

    const token = await signAuthToken(user, c.env.JWT_SECRET);
    return c.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to login");
  }
});

app.get("/api/auth/users", authRequired, allowRoles("admin"), async (c) => {
  try {
    const supabase = getSupabase(c);
    const { data, error } = await supabase
      .from("users")
      .select("id,name,email,role")
      .in("role", ["admin", "kitchen"])
      .order("role", { ascending: true })
      .order("name", { ascending: true })
      .order("email", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return c.json(data || []);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to load users");
  }
});

app.post("/api/auth/users", authRequired, allowRoles("admin"), async (c) => {
  try {
    const body = await loadBody(c);
    const name = getStringBodyValue(body, "name").trim();
    const email = normalizeEmail(getBodyValue(body, "email"));
    const password = String(getBodyValue(body, "password") || "");
    const role = normalizeRole(getBodyValue(body, "role"));

    if (!name || !email || !password || !role) {
      return jsonError(c, 400, "Name, email, password, and role are required");
    }

    if (password.length < 6) {
      return jsonError(c, 400, "Password must be at least 6 characters");
    }

    const supabase = getSupabase(c);
    const { data: existing, error: existingError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existing) {
      return jsonError(c, 409, "Email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { data: created, error } = await supabase
      .from("users")
      .insert({
        name,
        email,
        password: passwordHash,
        role
      })
      .select("id,name,email,role")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return c.json(created, 201);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to create user");
  }
});

app.put("/api/auth/users/:id", authRequired, allowRoles("admin"), async (c) => {
  try {
    const userId = Number(c.req.param("id"));
    if (!Number.isInteger(userId) || userId <= 0) {
      return jsonError(c, 400, "Invalid user id");
    }

    const body = await loadBody(c);
    const nameProvided = typeof getBodyValue(body, "name") !== "undefined";
    const emailProvided = typeof getBodyValue(body, "email") !== "undefined";
    const roleProvided = typeof getBodyValue(body, "role") !== "undefined";
    const passwordProvided = typeof getBodyValue(body, "password") !== "undefined";

    const name = nameProvided ? getStringBodyValue(body, "name").trim() : undefined;
    const email = emailProvided ? normalizeEmail(getBodyValue(body, "email")) : undefined;
    const role = roleProvided ? normalizeRole(getBodyValue(body, "role")) : undefined;
    const password = passwordProvided ? String(getBodyValue(body, "password") || "") : "";

    if (nameProvided && !name) {
      return jsonError(c, 400, "Name cannot be empty");
    }

    if (emailProvided && !email) {
      return jsonError(c, 400, "Email cannot be empty");
    }

    if (roleProvided && !role) {
      return jsonError(c, 400, "Role must be admin or kitchen");
    }

    if (passwordProvided && password && password.length < 6) {
      return jsonError(c, 400, "Password must be at least 6 characters");
    }

    const supabase = getSupabase(c);
    const { data: existing, error: existingError } = await supabase
      .from("users")
      .select("id,name,email,role")
      .eq("id", userId)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }
    if (!existing) {
      return jsonError(c, 404, "User not found");
    }

    if (emailProvided && email !== existing.email) {
      const { data: usedEmail, error: usedEmailError } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (usedEmailError) {
        throw new Error(usedEmailError.message);
      }
      if (usedEmail && usedEmail.id !== userId) {
        return jsonError(c, 409, "Email already exists");
      }
    }

    if (existing.role === "admin" && roleProvided && role !== "admin") {
      const { count, error: countError } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if (countError) {
        throw new Error(countError.message);
      }
      if ((count || 0) <= 1) {
        return jsonError(c, 400, "At least one admin account is required");
      }
    }

    const patch = {};
    if (nameProvided) patch.name = name;
    if (emailProvided) patch.email = email;
    if (roleProvided) patch.role = role;
    if (password) {
      patch.password = await bcrypt.hash(password, 10);
    }

    const { data: updated, error: updateError } = await supabase
      .from("users")
      .update(patch)
      .eq("id", userId)
      .select("id,name,email,role")
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return c.json(updated);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to update user");
  }
});

app.delete("/api/auth/users/:id", authRequired, allowRoles("admin"), async (c) => {
  try {
    const userId = Number(c.req.param("id"));
    if (!Number.isInteger(userId) || userId <= 0) {
      return jsonError(c, 400, "Invalid user id");
    }

    const user = c.get("user");
    if (Number(user?.id) === userId) {
      return jsonError(c, 400, "You cannot delete your own account");
    }

    const supabase = getSupabase(c);
    const { data: existing, error: existingError } = await supabase
      .from("users")
      .select("id,role")
      .eq("id", userId)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }
    if (!existing) {
      return jsonError(c, 404, "User not found");
    }

    if (existing.role === "admin") {
      const { count, error: countError } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if (countError) {
        throw new Error(countError.message);
      }
      if ((count || 0) <= 1) {
        return jsonError(c, 400, "At least one admin account is required");
      }
    }

    const { error: deleteError } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return c.body(null, 204);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to delete user");
  }
});

app.get("/api/menu", async (c) => {
  try {
    const cafeSlug = c.req.query("cafeSlug") ? normalizeCafeSlug(c.req.query("cafeSlug")) : null;
    if (cafeSlug && !ALLOWED_CAFE_SLUGS.has(cafeSlug)) {
      return jsonError(c, 400, "Invalid cafe slug");
    }

    const supabase = getSupabase(c);
    const [
      categoriesResult,
      itemsResult,
      extrasResult,
      itemExtrasResult,
      itemCafesResult
    ] = await Promise.all([
      supabase.from("categories").select("id,name,group_name,theme,display_order").order("group_name", { ascending: true }).order("display_order", { ascending: true }).order("name", { ascending: true }),
      supabase.from("menu_items").select("id,name,description,price,image,allow_customization,category_id,categories(id,name,group_name,theme,display_order)"),
      supabase.from("extras").select("id,name,price").order("name", { ascending: true }),
      supabase.from("menu_item_extras").select("menu_item_id,extra_id,extras(id,name,price)"),
      supabase.from("menu_item_cafes").select("menu_item_id,cafe_slug").order("cafe_slug", { ascending: true })
    ]);

    const errors = [categoriesResult.error, itemsResult.error, extrasResult.error, itemExtrasResult.error, itemCafesResult.error].filter(Boolean);
    if (errors.length) {
      throw new Error(errors[0].message);
    }

    const extrasByItemId = new Map();
    for (const link of itemExtrasResult.data || []) {
      const extra = Array.isArray(link.extras) ? link.extras[0] : link.extras;
      if (!extra || !Number.isInteger(extra.id)) {
        continue;
      }
      if (!extrasByItemId.has(link.menu_item_id)) {
        extrasByItemId.set(link.menu_item_id, []);
      }
      extrasByItemId.get(link.menu_item_id).push({
        id: extra.id,
        name: extra.name,
        price: Number(extra.price)
      });
    }

    const cafesByItemId = new Map();
    for (const link of itemCafesResult.data || []) {
      if (!cafesByItemId.has(link.menu_item_id)) {
        cafesByItemId.set(link.menu_item_id, []);
      }
      cafesByItemId.get(link.menu_item_id).push(link.cafe_slug);
    }

    const mappedItems = (itemsResult.data || [])
      .map((item) => mapMenuItemPayload(item, extrasByItemId, cafesByItemId))
      .filter((item) => !cafeSlug || item.cafe_slugs.includes(cafeSlug))
      .sort((a, b) => {
        const categoryCompare = String(a.category_name || "").localeCompare(String(b.category_name || ""));
        if (categoryCompare !== 0) {
          return categoryCompare;
        }

        return String(a.name || "").localeCompare(String(b.name || ""));
      });

    const visibleCategoryIds = new Set(mappedItems.map((item) => item.category_id).filter(Boolean));
    const mappedCategories = (categoriesResult.data || []).filter((category) => {
      if (!cafeSlug) {
        return true;
      }
      return visibleCategoryIds.has(category.id);
    });

    return c.json({
      categories: mappedCategories,
      items: mappedItems,
      extras: extrasResult.data || []
    });
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to load menu");
  }
});

app.get("/api/menu/categories", async (c) => {
  try {
    const supabase = getSupabase(c);
    const { data, error } = await supabase
      .from("categories")
      .select("id,name,group_name,theme,display_order")
      .order("group_name", { ascending: true })
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }
    return c.json(data || []);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to load categories");
  }
});

app.post("/api/menu/categories", authRequired, allowRoles("admin"), async (c) => {
  try {
    const body = await loadBody(c);
    const name = getStringBodyValue(body, "name").trim();
    const groupName = getStringBodyValue(body, "group_name").trim() || "General";
    const theme = getStringBodyValue(body, "theme").trim() || "default";
    const displayOrderRaw = getBodyValue(body, "display_order");
    const parsedDisplayOrder = Number(displayOrderRaw);
    const displayOrder = Number.isInteger(parsedDisplayOrder) ? parsedDisplayOrder : 0;

    if (!name) {
      return jsonError(c, 400, "Category name is required");
    }

    const supabase = getSupabase(c);
    const { data, error } = await supabase
      .from("categories")
      .insert({
        name,
        group_name: groupName,
        theme,
        display_order: displayOrder
      })
      .select("id,name,group_name,theme,display_order")
      .single();

    if (error) {
      if (error.code === "23505") {
        return jsonError(c, 409, "Category already exists");
      }
      throw new Error(error.message);
    }

    return c.json(data, 201);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to create category");
  }
});

app.put("/api/menu/categories/:id", authRequired, allowRoles("admin"), async (c) => {
  try {
    const categoryId = Number(c.req.param("id"));
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return jsonError(c, 400, "Invalid category id");
    }

    const body = await loadBody(c);
    const patch = {};
    const name = getBodyValue(body, "name");
    const groupName = getBodyValue(body, "group_name");
    const theme = getBodyValue(body, "theme");
    const displayOrderRaw = getBodyValue(body, "display_order");

    if (typeof name !== "undefined") patch.name = String(name || "").trim();
    if (typeof groupName !== "undefined") patch.group_name = String(groupName || "").trim();
    if (typeof theme !== "undefined") patch.theme = String(theme || "").trim();
    if (typeof displayOrderRaw !== "undefined" && String(displayOrderRaw) !== "") {
      const parsed = Number(displayOrderRaw);
      if (!Number.isInteger(parsed)) {
        return jsonError(c, 400, "Invalid display order");
      }
      patch.display_order = parsed;
    }

    const supabase = getSupabase(c);
    const { data, error } = await supabase
      .from("categories")
      .update(patch)
      .eq("id", categoryId)
      .select("id,name,group_name,theme,display_order")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return jsonError(c, 409, "Category already exists");
      }
      throw new Error(error.message);
    }
    if (!data) {
      return jsonError(c, 404, "Category not found");
    }
    return c.json(data);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to update category");
  }
});

app.delete("/api/menu/categories/:id", authRequired, allowRoles("admin"), async (c) => {
  try {
    const categoryId = Number(c.req.param("id"));
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return jsonError(c, 400, "Invalid category id");
    }

    const supabase = getSupabase(c);
    const { error, count } = await supabase
      .from("categories")
      .delete({ count: "exact" })
      .eq("id", categoryId);

    if (error) {
      throw new Error(error.message);
    }
    if (!count) {
      return jsonError(c, 404, "Category not found");
    }

    return c.body(null, 204);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to delete category");
  }
});

app.get("/api/menu/extras", async (c) => {
  try {
    const supabase = getSupabase(c);
    const { data, error } = await supabase
      .from("extras")
      .select("id,name,price")
      .order("name", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }
    return c.json(data || []);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to load extras");
  }
});

app.post("/api/menu/extras", authRequired, allowRoles("admin"), async (c) => {
  try {
    const body = await loadBody(c);
    const name = getStringBodyValue(body, "name").trim();
    const parsedPrice = Number(getBodyValue(body, "price"));

    if (!name) {
      return jsonError(c, 400, "Extra name is required");
    }
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      return jsonError(c, 400, "Extra price must be a valid non-negative number");
    }

    const supabase = getSupabase(c);
    const { data, error } = await supabase
      .from("extras")
      .insert({ name, price: parsedPrice })
      .select("id,name,price")
      .single();

    if (error) {
      if (error.code === "23505") {
        return jsonError(c, 409, "Extra already exists");
      }
      throw new Error(error.message);
    }

    return c.json(data, 201);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to create extra");
  }
});

app.put("/api/menu/extras/:id", authRequired, allowRoles("admin"), async (c) => {
  try {
    const extraId = Number(c.req.param("id"));
    if (!Number.isInteger(extraId) || extraId <= 0) {
      return jsonError(c, 400, "Invalid extra id");
    }

    const body = await loadBody(c);
    const patch = {};
    const name = getBodyValue(body, "name");
    const rawPrice = getBodyValue(body, "price");

    if (typeof name !== "undefined") {
      patch.name = String(name || "").trim();
    }
    if (typeof rawPrice !== "undefined" && String(rawPrice) !== "") {
      const parsedPrice = Number(rawPrice);
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        return jsonError(c, 400, "Extra price must be a valid non-negative number");
      }
      patch.price = parsedPrice;
    }

    const supabase = getSupabase(c);
    const { data, error } = await supabase
      .from("extras")
      .update(patch)
      .eq("id", extraId)
      .select("id,name,price")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return jsonError(c, 409, "Extra already exists");
      }
      throw new Error(error.message);
    }
    if (!data) {
      return jsonError(c, 404, "Extra not found");
    }

    return c.json(data);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to update extra");
  }
});

app.delete("/api/menu/extras/:id", authRequired, allowRoles("admin"), async (c) => {
  try {
    const extraId = Number(c.req.param("id"));
    if (!Number.isInteger(extraId) || extraId <= 0) {
      return jsonError(c, 400, "Invalid extra id");
    }

    const supabase = getSupabase(c);
    const { error, count } = await supabase
      .from("extras")
      .delete({ count: "exact" })
      .eq("id", extraId);

    if (error) {
      throw new Error(error.message);
    }
    if (!count) {
      return jsonError(c, 404, "Extra not found");
    }

    return c.body(null, 204);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to delete extra");
  }
});

app.post("/api/menu", authRequired, allowRoles("admin"), async (c) => {
  try {
    const body = await loadBody(c);
    const name = getStringBodyValue(body, "name").trim();
    const description = getStringBodyValue(body, "description");
    const price = Number(getBodyValue(body, "price"));
    const categoryIdRaw = getBodyValue(body, "category_id");
    const extraIdsRaw = getBodyValue(body, "extra_ids");
    const cafeSlugsRaw = getBodyValue(body, "cafe_slugs");
    const allowCustomizationRaw = getBodyValue(body, "allow_customization");

    if (!name || Number.isNaN(price) || price < 0) {
      return jsonError(c, 400, "Item name and valid price are required");
    }

    const parsedCategoryId = categoryIdRaw ? Number(categoryIdRaw) : null;
    if (categoryIdRaw && (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0)) {
      return jsonError(c, 400, "Invalid category id");
    }

    const extraIds = parseIntegerArray(extraIdsRaw) || [];
    const cafeSlugs = parseCafeSlugs(cafeSlugsRaw, true, DEFAULT_CAFE_SLUGS);
    if (!cafeSlugs.length) {
      return jsonError(c, 400, "At least one valid cafe slug is required");
    }

    let imagePath = null;
    const file = getOptionalUploadedFile(body, "image");
    if (file) {
      imagePath = await uploadMenuImage(c, file, name);
    } else {
      imagePath = defaultImageForItemName(name);
    }

    const supabase = getSupabase(c);
    const { data: created, error: createError } = await supabase
      .from("menu_items")
      .insert({
        name,
        description,
        price,
        image: imagePath,
        category_id: parsedCategoryId,
        allow_customization: parseBoolean(allowCustomizationRaw, false)
      })
      .select("id")
      .single();

    if (createError) {
      throw new Error(createError.message);
    }

    await replaceMenuItemExtras(c, created.id, extraIds);
    await replaceMenuItemCafes(c, created.id, cafeSlugs);
    const fullItem = await fetchSingleMenuItem(c, created.id);

    return c.json(fullItem, 201);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to create menu item");
  }
});

app.put("/api/menu/:id", authRequired, allowRoles("admin"), async (c) => {
  try {
    const itemId = Number(c.req.param("id"));
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return jsonError(c, 400, "Invalid item id");
    }

    const body = await loadBody(c);
    const patch = {};
    const nameRaw = getBodyValue(body, "name");
    const descriptionRaw = getBodyValue(body, "description");
    const priceRaw = getBodyValue(body, "price");
    const categoryIdRaw = getBodyValue(body, "category_id");
    const extraIdsRaw = getBodyValue(body, "extra_ids");
    const cafeSlugsRaw = getBodyValue(body, "cafe_slugs");
    const allowCustomizationRaw = getBodyValue(body, "allow_customization");

    if (typeof nameRaw !== "undefined") patch.name = String(nameRaw || "").trim();
    if (typeof descriptionRaw !== "undefined") patch.description = String(descriptionRaw || "");
    if (typeof priceRaw !== "undefined" && String(priceRaw) !== "") {
      const parsedPrice = Number(priceRaw);
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        return jsonError(c, 400, "Invalid price value");
      }
      patch.price = parsedPrice;
    }

    const categoryIdProvided = typeof categoryIdRaw !== "undefined";
    if (categoryIdProvided) {
      if (categoryIdRaw === "" || categoryIdRaw === null) {
        patch.category_id = null;
      } else {
        const parsedCategoryId = Number(categoryIdRaw);
        if (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0) {
          return jsonError(c, 400, "Invalid category id");
        }
        patch.category_id = parsedCategoryId;
      }
    }

    const allowCustomizationProvided = typeof allowCustomizationRaw !== "undefined";
    if (allowCustomizationProvided) {
      patch.allow_customization = parseBoolean(allowCustomizationRaw, false);
    }

    const file = getOptionalUploadedFile(body, "image");
    if (file) {
      const imageName = patch.name || "menu-item";
      patch.image = await uploadMenuImage(c, file, imageName);
    }

    const supabase = getSupabase(c);
    const { data: updated, error: updateError } = await supabase
      .from("menu_items")
      .update(patch)
      .eq("id", itemId)
      .select("id")
      .maybeSingle();

    if (updateError) {
      throw new Error(updateError.message);
    }
    if (!updated) {
      return jsonError(c, 404, "Menu item not found");
    }

    const parsedExtraIds = parseIntegerArray(extraIdsRaw);
    if (Array.isArray(parsedExtraIds)) {
      await replaceMenuItemExtras(c, itemId, parsedExtraIds);
    }

    const cafeSlugsProvided = typeof cafeSlugsRaw !== "undefined";
    if (cafeSlugsProvided) {
      const parsedCafeSlugs = parseCafeSlugs(cafeSlugsRaw, false, DEFAULT_CAFE_SLUGS);
      if (!parsedCafeSlugs.length) {
        return jsonError(c, 400, "At least one valid cafe slug is required");
      }
      await replaceMenuItemCafes(c, itemId, parsedCafeSlugs);
    }

    const fullItem = await fetchSingleMenuItem(c, itemId);
    return c.json(fullItem);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to update menu item");
  }
});

app.delete("/api/menu/:id", authRequired, allowRoles("admin"), async (c) => {
  try {
    const itemId = Number(c.req.param("id"));
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return jsonError(c, 400, "Invalid item id");
    }

    const supabase = getSupabase(c);
    const { error, count } = await supabase
      .from("menu_items")
      .delete({ count: "exact" })
      .eq("id", itemId);

    if (error) {
      throw new Error(error.message);
    }
    if (!count) {
      return jsonError(c, 404, "Menu item not found");
    }

    return c.body(null, 204);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to delete menu item");
  }
});

app.post("/api/orders", async (c) => {
  try {
    const body = await loadBody(c);
    const customerName = getStringBodyValue(body, "customerName").trim();
    const customerEmailRaw = getBodyValue(body, "customerEmail");
    const tableNumberRaw = getBodyValue(body, "tableNumber");
    const cafeSlug = normalizeCafeSlug(getBodyValue(body, "cafeSlug"));
    const rawItems = getBodyValue(body, "items");
    const items = Array.isArray(rawItems) ? rawItems : [];

    const normalizedCustomerEmail = normalizeEmail(customerEmailRaw);
    const customerEmail = normalizedCustomerEmail || null;

    if (!customerName || !cafeSlug || !items.length) {
      return jsonError(c, 400, "Customer name, cafe slug, and at least one item are required");
    }

    if (!ALLOWED_CAFE_SLUGS.has(cafeSlug)) {
      return jsonError(c, 400, "Invalid cafe slug");
    }

    if (customerEmail && !isValidEmail(customerEmail)) {
      return jsonError(c, 400, "Invalid customer email");
    }

    const normalizedItems = items.map((item) => {
      const rawExtraIds = Array.isArray(item.extraIds) ? item.extraIds : [];
      const hasInvalidExtra = rawExtraIds.some((extraId) => !Number.isInteger(Number(extraId)) || Number(extraId) <= 0);
      return {
        menuItemId: Number(item.menuItemId),
        quantity: Number(item.quantity),
        extraIds: dedupeIntegerIds(rawExtraIds.map((extraId) => Number(extraId))),
        hasInvalidExtra
      };
    }).filter((item) => Number.isInteger(item.menuItemId) && Number.isInteger(item.quantity) && item.quantity > 0 && !item.hasInvalidExtra);

    if (!normalizedItems.length || normalizedItems.length !== items.length) {
      return jsonError(c, 400, "Invalid order items");
    }

    const supabase = getSupabase(c);
    const menuItemIds = normalizedItems.map((item) => item.menuItemId);
    const { data: menuRows, error: menuError } = await supabase
      .from("menu_items")
      .select("id,name,price")
      .in("id", menuItemIds);
    if (menuError) {
      throw new Error(menuError.message);
    }

    const menuById = new Map((menuRows || []).map((row) => [row.id, row]));
    const { data: cafeLinks, error: cafeLinksError } = await supabase
      .from("menu_item_cafes")
      .select("menu_item_id,cafe_slug")
      .in("menu_item_id", menuItemIds)
      .eq("cafe_slug", cafeSlug);
    if (cafeLinksError) {
      throw new Error(cafeLinksError.message);
    }
    const allowedItemIds = new Set((cafeLinks || []).map((row) => row.menu_item_id));

    const allExtraIds = dedupeIntegerIds(normalizedItems.flatMap((item) => item.extraIds));
    let allowedExtras = [];
    if (allExtraIds.length) {
      const { data, error } = await supabase
        .from("menu_item_extras")
        .select("menu_item_id,extra_id,extras(id,name,price)")
        .in("menu_item_id", menuItemIds)
        .in("extra_id", allExtraIds);
      if (error) {
        throw new Error(error.message);
      }
      allowedExtras = data || [];
    }

    const allowedExtrasByItem = new Map();
    for (const row of allowedExtras) {
      if (!allowedExtrasByItem.has(row.menu_item_id)) {
        allowedExtrasByItem.set(row.menu_item_id, new Map());
      }
      const extra = Array.isArray(row.extras) ? row.extras[0] : row.extras;
      allowedExtrasByItem.get(row.menu_item_id).set(row.extra_id, {
        id: row.extra_id,
        name: extra?.name || "",
        price: Number(extra?.price ?? 0)
      });
    }

    for (const item of normalizedItems) {
      if (!menuById.has(item.menuItemId) || !allowedItemIds.has(item.menuItemId)) {
        return jsonError(c, 400, `Menu item ${item.menuItemId} is not available for ${cafeSlug}`);
      }

      const allowedMap = allowedExtrasByItem.get(item.menuItemId) || new Map();
      const invalidExtra = item.extraIds.find((extraId) => !allowedMap.has(extraId));
      if (invalidExtra) {
        return jsonError(c, 400, `Invalid extras for menu item ${item.menuItemId}`);
      }
    }

    let createdOrder = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const nextNumber = await reserveNextOrderNumber(c, cafeSlug);
      const { data, error } = await supabase
        .from("orders")
        .insert({
          cafe_slug: cafeSlug,
          customer_name: customerName,
          customer_email: customerEmail,
          table_number: tableNumberRaw ? String(tableNumberRaw).trim() : null,
          order_number: nextNumber.orderNumber,
          order_date: nextNumber.counterDate,
          order_sequence: nextNumber.orderSequence,
          status: "Pending"
        })
        .select("id,order_number,cafe_slug,customer_name,customer_email,table_number,order_date,order_sequence,status,created_at")
        .maybeSingle();

      if (error) {
        if (error.code === "23505") {
          continue;
        }
        throw new Error(error.message);
      }
      createdOrder = data;
      break;
    }

    if (!createdOrder) {
      return jsonError(c, 409, "Daily order number capacity (900) reached for this cafe.");
    }

    try {
      for (const item of normalizedItems) {
        const menuItem = menuById.get(item.menuItemId);
        const { data: createdOrderItem, error: orderItemError } = await supabase
          .from("order_items")
          .insert({
            order_id: createdOrder.id,
            menu_item_id: menuItem.id,
            quantity: item.quantity,
            item_name: menuItem.name,
            item_price: menuItem.price
          })
          .select("id")
          .single();

        if (orderItemError) {
          throw new Error(orderItemError.message);
        }

        if (item.extraIds.length) {
          const extrasToInsert = item.extraIds.map((extraId) => {
            const extra = allowedExtrasByItem.get(item.menuItemId).get(extraId);
            return {
              order_item_id: createdOrderItem.id,
              extra_id: extra.id,
              extra_name: extra.name,
              extra_price: extra.price
            };
          });

          const { error: extraInsertError } = await supabase
            .from("order_item_extras")
            .insert(extrasToInsert);

          if (extraInsertError) {
            throw new Error(extraInsertError.message);
          }
        }
      }
    } catch (error) {
      await supabase.from("orders").delete().eq("id", createdOrder.id);
      throw error;
    }

    const fullOrder = await fetchOrderById(c, createdOrder.id);
    const receipt = await sendOrderReceipt(c, fullOrder).catch(() => ({ sent: false, reason: "send_failed" }));

    return c.json({
      ...fullOrder,
      receipt: {
        requested: Boolean(fullOrder?.customerEmail),
        sent: Boolean(receipt?.sent),
        reason: receipt?.reason || null
      }
    }, 201);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to create order");
  }
});

app.get("/api/orders/public", async (c) => {
  try {
    const cafeSlugRaw = c.req.query("cafeSlug");
    const cafeSlug = cafeSlugRaw ? normalizeCafeSlug(cafeSlugRaw) : null;
    if (cafeSlug && !ALLOWED_CAFE_SLUGS.has(cafeSlug)) {
      return jsonError(c, 400, "Invalid cafe slug");
    }

    const orders = await fetchOrders(c, { cafeSlug, includeCompleted: false });
    return c.json(orders);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to load public orders");
  }
});

app.get("/api/orders", authRequired, allowRoles("admin", "kitchen"), async (c) => {
  try {
    const cafeSlugRaw = c.req.query("cafeSlug");
    const cafeSlug = cafeSlugRaw ? normalizeCafeSlug(cafeSlugRaw) : null;
    if (cafeSlug && !ALLOWED_CAFE_SLUGS.has(cafeSlug)) {
      return jsonError(c, 400, "Invalid cafe slug");
    }

    const orders = await fetchOrders(c, { cafeSlug, includeCompleted: true });
    return c.json(orders);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to load orders");
  }
});

app.get("/api/orders/:id", async (c) => {
  try {
    const orderId = Number(c.req.param("id"));
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return jsonError(c, 400, "Invalid order id");
    }

    const order = await fetchOrderById(c, orderId);
    if (!order) {
      return jsonError(c, 404, "Order not found");
    }
    return c.json(order);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to load order");
  }
});

app.put("/api/orders/:id/status", authRequired, allowRoles("admin", "kitchen"), async (c) => {
  try {
    const orderId = Number(c.req.param("id"));
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return jsonError(c, 400, "Invalid order id");
    }

    const body = await loadBody(c);
    const status = String(getBodyValue(body, "status") || "").trim();
    if (!STATUS_FLOW.includes(status)) {
      return jsonError(c, 400, "Invalid status");
    }

    const supabase = getSupabase(c);
    const { data: existing, error: existingError } = await supabase
      .from("orders")
      .select("id,status")
      .eq("id", orderId)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }
    if (!existing) {
      return jsonError(c, 404, "Order not found");
    }

    if (!isValidNextStatus(existing.status, status)) {
      return jsonError(c, 400, "Invalid status transition");
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);
    if (updateError) {
      throw new Error(updateError.message);
    }

    const fullOrder = await fetchOrderById(c, orderId);
    if (fullOrder.status === "Ready") {
      sendOrderReadyNotification(c, fullOrder).catch(() => null);
    }

    return c.json(fullOrder);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to update order status");
  }
});

app.get("/api/orders/end-of-day/report", authRequired, allowRoles("admin", "kitchen"), async (c) => {
  try {
    const reportDate = String(c.req.query("date") || new Date().toISOString().slice(0, 10)).trim();
    const cafeSlugRaw = c.req.query("cafeSlug");
    const cafeSlug = cafeSlugRaw ? normalizeCafeSlug(cafeSlugRaw) : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      return jsonError(c, 400, "Invalid date. Use YYYY-MM-DD.");
    }
    if (cafeSlug && !ALLOWED_CAFE_SLUGS.has(cafeSlug)) {
      return jsonError(c, 400, "Invalid cafe slug");
    }

    const supabase = getSupabase(c);
    let ordersQuery = supabase
      .from("orders")
      .select("id,order_number,cafe_slug,customer_name,status,created_at")
      .eq("order_date", reportDate)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (cafeSlug) {
      ordersQuery = ordersQuery.eq("cafe_slug", cafeSlug);
    }

    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) {
      throw new Error(ordersError.message);
    }

    const orderIds = (orders || []).map((order) => order.id);
    let lineItems = [];
    if (orderIds.length) {
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("id,order_id,item_name,quantity,item_price")
        .in("order_id", orderIds);
      if (itemsError) {
        throw new Error(itemsError.message);
      }

      const orderItemIds = (orderItems || []).map((item) => item.id);
      let extras = [];
      if (orderItemIds.length) {
        const { data, error } = await supabase
          .from("order_item_extras")
          .select("order_item_id,extra_price")
          .in("order_item_id", orderItemIds);
        if (error) {
          throw new Error(error.message);
        }
        extras = data || [];
      }

      const extrasSumByItem = extras.reduce((acc, extra) => {
        const key = extra.order_item_id;
        acc[key] = (acc[key] || 0) + toNumber(extra.extra_price);
        return acc;
      }, {});

      lineItems = (orderItems || []).map((item) => ({
        ...item,
        extras_per_unit: extrasSumByItem[item.id] || 0
      }));
    }

    const statusCounts = STATUS_FLOW.reduce((acc, item) => ({ ...acc, [item]: 0 }), {});
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

    for (const order of orders || []) {
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

    const report = {
      reportDate,
      cafeSlug: cafeSlug || null,
      generatedAt: new Date().toISOString(),
      cafeLabel: cafeSlug ? (CAFE_LABELS[cafeSlug] || cafeSlug) : "All Cafes",
      totals: {
        orderCount: (orders || []).length,
        grossRevenue,
        completedRevenue
      },
      statusCounts,
      cafes: [...cafeMap.values()].sort((a, b) => a.cafeSlug.localeCompare(b.cafeSlug)).map((row) => ({
        ...row,
        cafeLabel: CAFE_LABELS[row.cafeSlug] || row.cafeSlug
      })),
      items: [...itemMap.values()].sort((a, b) => {
        if (b.revenue !== a.revenue) {
          return b.revenue - a.revenue;
        }
        return b.quantity - a.quantity;
      })
    };

    return c.json(report);
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to generate report");
  }
});

app.get("/api/settings/public", async (c) => {
  try {
    const supabase = getSupabase(c);
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", CUSTOMER_THEME_KEY)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    const theme = normalizeTheme(data?.value) || DEFAULT_CUSTOMER_THEME;
    return c.json({ customerPortalTheme: theme });
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to load settings");
  }
});

app.put("/api/settings/customer-theme", authRequired, allowRoles("admin"), async (c) => {
  try {
    const body = await loadBody(c);
    const theme = normalizeTheme(getBodyValue(body, "theme"));
    if (!theme) {
      return jsonError(c, 400, "Theme must be 'dark' or 'light'");
    }

    const supabase = getSupabase(c);
    const { data, error } = await supabase
      .from("app_settings")
      .upsert({
        key: CUSTOMER_THEME_KEY,
        value: theme,
        updated_at: new Date().toISOString()
      }, { onConflict: "key" })
      .select("value,updated_at")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return c.json({
      customerPortalTheme: normalizeTheme(data?.value) || DEFAULT_CUSTOMER_THEME,
      updatedAt: data?.updated_at || null
    });
  } catch (error) {
    return jsonError(c, 500, error.message || "Unable to update settings");
  }
});

app.notFound((c) => c.json({ message: "Not found" }, 404));

app.onError((error, c) => {
  // eslint-disable-next-line no-console
  console.error(error);
  return c.json({ message: "Internal server error" }, 500);
});

export default app;
