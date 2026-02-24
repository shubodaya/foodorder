import {
  createCategory,
  createExtra,
  createMenuItem,
  deleteCategory,
  deleteExtra,
  deleteMenuItem,
  getCategories,
  getExtras,
  getMenuItems,
  updateCategory,
  updateExtra,
  updateMenuItem
} from "../models/menuModel.js";

const ALLOWED_CAFE_SLUGS = new Set(["raysdiner", "lovesgrove", "cosmiccafe"]);

function normalizeImagePath(req) {
  if (!req.file) {
    return null;
  }

  return `/uploads/${req.file.filename}`;
}

function parseIntegerArray(rawValue) {
  if (typeof rawValue === "undefined") {
    return undefined;
  }

  if (Array.isArray(rawValue)) {
    const parsed = rawValue.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);
    return [...new Set(parsed)];
  }

  if (rawValue === null) {
    return [];
  }

  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsedJson = JSON.parse(trimmed);
      if (Array.isArray(parsedJson)) {
        const parsed = parsedJson.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);
        return [...new Set(parsed)];
      }
    } catch (_error) {
      const parsedCsv = trimmed.split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0);
      return [...new Set(parsedCsv)];
    }
  }

  return [];
}

function parseStringArray(rawValue) {
  if (typeof rawValue === "undefined") {
    return undefined;
  }

  const normalize = (value) => String(value || "").trim().toLowerCase();

  if (Array.isArray(rawValue)) {
    return [...new Set(rawValue.map(normalize).filter(Boolean))];
  }

  if (rawValue === null) {
    return [];
  }

  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsedJson = JSON.parse(trimmed);
      if (Array.isArray(parsedJson)) {
        return [...new Set(parsedJson.map(normalize).filter(Boolean))];
      }
    } catch (_error) {
      return [...new Set(trimmed.split(",").map(normalize).filter(Boolean))];
    }
  }

  return [];
}

function normalizeCafeSlug(value) {
  return String(value || "").trim().toLowerCase();
}

function parseCafeSlugs(rawValue, useDefault = false) {
  const parsed = parseStringArray(rawValue);
  const filtered = (parsed || []).filter((slug) => ALLOWED_CAFE_SLUGS.has(slug));

  if (!filtered.length && useDefault) {
    return ["raysdiner", "lovesgrove", "cosmiccafe"];
  }

  return filtered;
}

function parseBoolean(rawValue) {
  if (typeof rawValue === "boolean") {
    return rawValue;
  }

  if (typeof rawValue === "number") {
    return rawValue !== 0;
  }

  if (typeof rawValue === "string") {
    const normalized = rawValue.trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(normalized);
  }

  return false;
}

export async function listMenu(req, res, next) {
  try {
    const requestedCafeSlug = typeof req.query.cafeSlug === "string"
      ? normalizeCafeSlug(req.query.cafeSlug)
      : null;

    if (requestedCafeSlug && !ALLOWED_CAFE_SLUGS.has(requestedCafeSlug)) {
      return res.status(400).json({ message: "Invalid cafe slug" });
    }

    const [categories, items, extras] = await Promise.all([
      getCategories(requestedCafeSlug),
      getMenuItems(requestedCafeSlug),
      getExtras()
    ]);

    return res.json({
      categories,
      items,
      extras
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCategories(_req, res, next) {
  try {
    const categories = await getCategories();
    return res.json(categories);
  } catch (error) {
    return next(error);
  }
}

export async function addCategory(req, res, next) {
  try {
    const {
      name,
      group_name: groupNameRaw,
      theme: themeRaw,
      display_order: displayOrderRaw
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const groupName = String(groupNameRaw || "General").trim() || "General";
    const theme = String(themeRaw || "default").trim() || "default";
    const parsedDisplayOrder = Number(displayOrderRaw);
    const displayOrder = Number.isInteger(parsedDisplayOrder) ? parsedDisplayOrder : 0;

    const category = await createCategory({
      name: name.trim(),
      groupName,
      theme,
      displayOrder
    });
    return res.status(201).json(category);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Category already exists" });
    }

    return next(error);
  }
}

export async function editCategory(req, res, next) {
  try {
    const categoryId = Number(req.params.id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({ message: "Invalid category id" });
    }

    const {
      name,
      group_name: groupNameRaw,
      theme: themeRaw,
      display_order: displayOrderRaw
    } = req.body;

    const parsedDisplayOrder = Number(displayOrderRaw);
    const displayOrderProvided = typeof displayOrderRaw !== "undefined" && displayOrderRaw !== "";

    if (displayOrderProvided && !Number.isInteger(parsedDisplayOrder)) {
      return res.status(400).json({ message: "Invalid display order" });
    }

    const updated = await updateCategory(categoryId, {
      name: typeof name === "string" ? name.trim() : undefined,
      groupName: typeof groupNameRaw === "string" ? groupNameRaw.trim() : undefined,
      theme: typeof themeRaw === "string" ? themeRaw.trim() : undefined,
      displayOrder: displayOrderProvided ? parsedDisplayOrder : undefined
    });

    if (!updated) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.json(updated);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Category already exists" });
    }

    return next(error);
  }
}

export async function removeCategory(req, res, next) {
  try {
    const categoryId = Number(req.params.id);

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({ message: "Invalid category id" });
    }

    const deleted = await deleteCategory(categoryId);
    if (!deleted) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function listExtras(_req, res, next) {
  try {
    const extras = await getExtras();
    return res.json(extras);
  } catch (error) {
    return next(error);
  }
}

export async function addExtra(req, res, next) {
  try {
    const { name, price } = req.body;
    const parsedPrice = Number(price);

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Extra name is required" });
    }

    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ message: "Extra price must be a valid non-negative number" });
    }

    const extra = await createExtra({
      name: name.trim(),
      price: parsedPrice
    });

    return res.status(201).json(extra);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Extra already exists" });
    }

    return next(error);
  }
}

export async function editExtra(req, res, next) {
  try {
    const extraId = Number(req.params.id);
    const { name, price } = req.body;
    const hasPrice = typeof price !== "undefined" && price !== "";
    const parsedPrice = hasPrice ? Number(price) : undefined;

    if (!Number.isInteger(extraId) || extraId <= 0) {
      return res.status(400).json({ message: "Invalid extra id" });
    }

    if (hasPrice && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      return res.status(400).json({ message: "Extra price must be a valid non-negative number" });
    }

    const updated = await updateExtra(extraId, {
      name: name?.trim(),
      price: hasPrice ? parsedPrice : undefined
    });

    if (!updated) {
      return res.status(404).json({ message: "Extra not found" });
    }

    return res.json(updated);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Extra already exists" });
    }

    return next(error);
  }
}

export async function removeExtra(req, res, next) {
  try {
    const extraId = Number(req.params.id);

    if (!Number.isInteger(extraId) || extraId <= 0) {
      return res.status(400).json({ message: "Invalid extra id" });
    }

    const deleted = await deleteExtra(extraId);
    if (!deleted) {
      return res.status(404).json({ message: "Extra not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function addMenuItem(req, res, next) {
  try {
    const {
      name,
      description,
      price,
      category_id: categoryId,
      extra_ids: extraIdsRaw,
      cafe_slugs: cafeSlugsRaw,
      allow_customization: allowCustomizationRaw
    } = req.body;

    const parsedPrice = Number(price);

    if (!name || !name.trim() || Number.isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ message: "Item name and valid price are required" });
    }

    const parsedCategoryId = categoryId ? Number(categoryId) : null;
    if (categoryId && (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0)) {
      return res.status(400).json({ message: "Invalid category id" });
    }

    const extraIds = parseIntegerArray(extraIdsRaw) || [];
    const cafeSlugs = parseCafeSlugs(cafeSlugsRaw, true);

    if (!cafeSlugs.length) {
      return res.status(400).json({ message: "At least one valid cafe slug is required" });
    }

    const created = await createMenuItem({
      name: name.trim(),
      description: description || "",
      price: parsedPrice,
      image: normalizeImagePath(req),
      categoryId: parsedCategoryId,
      extraIds,
      cafeSlugs,
      allowCustomization: parseBoolean(allowCustomizationRaw)
    });

    return res.status(201).json(created);
  } catch (error) {
    if (error.code === "23503") {
      return res.status(400).json({ message: "Invalid category or extra selection" });
    }

    return next(error);
  }
}

export async function editMenuItem(req, res, next) {
  try {
    const itemId = Number(req.params.id);
    const {
      name,
      description,
      price,
      category_id: categoryId,
      extra_ids: extraIdsRaw,
      cafe_slugs: cafeSlugsRaw,
      allow_customization: allowCustomizationRaw
    } = req.body;

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ message: "Invalid item id" });
    }

    const hasPrice = typeof price !== "undefined" && price !== "";
    const parsedPrice = hasPrice ? Number(price) : null;

    if (hasPrice && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      return res.status(400).json({ message: "Invalid price value" });
    }

    const categoryIdProvided = Object.prototype.hasOwnProperty.call(req.body, "category_id");
    const parsedCategoryId = categoryIdProvided
      ? (categoryId === "" || categoryId === null ? null : Number(categoryId))
      : null;

    if (categoryIdProvided && parsedCategoryId !== null && (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0)) {
      return res.status(400).json({ message: "Invalid category id" });
    }

    const extraIds = parseIntegerArray(extraIdsRaw);
    const cafeSlugsProvided = Object.prototype.hasOwnProperty.call(req.body, "cafe_slugs");
    const cafeSlugs = cafeSlugsProvided ? parseCafeSlugs(cafeSlugsRaw, false) : undefined;
    if (cafeSlugsProvided && (!Array.isArray(cafeSlugs) || !cafeSlugs.length)) {
      return res.status(400).json({ message: "At least one valid cafe slug is required" });
    }
    const allowCustomizationProvided = Object.prototype.hasOwnProperty.call(req.body, "allow_customization");

    const updated = await updateMenuItem(itemId, {
      name: name?.trim(),
      description,
      price: hasPrice ? parsedPrice : null,
      image: normalizeImagePath(req),
      categoryId: parsedCategoryId,
      categoryIdProvided,
      extraIds,
      cafeSlugs,
      cafeSlugsProvided,
      allowCustomization: parseBoolean(allowCustomizationRaw),
      allowCustomizationProvided
    });

    if (!updated) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    return res.json(updated);
  } catch (error) {
    if (error.code === "23503") {
      return res.status(400).json({ message: "Invalid category or extra selection" });
    }

    return next(error);
  }
}

export async function removeMenuItem(req, res, next) {
  try {
    const itemId = Number(req.params.id);
    const deleted = await deleteMenuItem(itemId);

    if (!deleted) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
