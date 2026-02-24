import pool from "../config/db.js";

const ALLOWED_CAFE_SLUGS = new Set(["raysdiner", "lovesgrove", "cosmiccafe"]);
const DEFAULT_CAFE_SLUGS = ["raysdiner", "lovesgrove", "cosmiccafe"];

function dedupeIntegerIds(ids = []) {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
}

function normalizeCafeSlugs(cafeSlugs, fallbackToDefault = false) {
  if (!Array.isArray(cafeSlugs)) {
    return fallbackToDefault ? [...DEFAULT_CAFE_SLUGS] : [];
  }

  const normalized = [...new Set(
    cafeSlugs
      .map((slug) => String(slug || "").trim().toLowerCase())
      .filter((slug) => ALLOWED_CAFE_SLUGS.has(slug))
  )];

  if (!normalized.length && fallbackToDefault) {
    return [...DEFAULT_CAFE_SLUGS];
  }

  return normalized;
}

async function setMenuItemExtras(client, menuItemId, extraIds) {
  const normalized = dedupeIntegerIds(extraIds);

  await client.query("DELETE FROM menu_item_extras WHERE menu_item_id = $1", [menuItemId]);

  if (!normalized.length) {
    return;
  }

  await client.query(
    `INSERT INTO menu_item_extras (menu_item_id, extra_id)
     SELECT $1, extra_id
     FROM UNNEST($2::int[]) AS extra_id`,
    [menuItemId, normalized]
  );
}

async function setMenuItemCafes(client, menuItemId, cafeSlugs) {
  const normalized = normalizeCafeSlugs(cafeSlugs, true);

  await client.query("DELETE FROM menu_item_cafes WHERE menu_item_id = $1", [menuItemId]);

  await client.query(
    `INSERT INTO menu_item_cafes (menu_item_id, cafe_slug)
     SELECT $1, cafe_slug
     FROM UNNEST($2::text[]) AS cafe_slug`,
    [menuItemId, normalized]
  );
}

function menuItemSelect(whereSql = "") {
  return `SELECT
    m.id,
    m.name,
    m.description,
    m.price,
    m.image,
    m.allow_customization,
    m.category_id,
    c.name AS category_name,
    c.group_name AS category_group_name,
    c.theme AS category_theme,
    COALESCE(extras_for_item.extras, '[]'::json) AS extras,
    COALESCE(cafes_for_item.cafe_slugs, ARRAY[]::text[]) AS cafe_slugs
   FROM menu_items m
   LEFT JOIN categories c ON c.id = m.category_id
   LEFT JOIN LATERAL (
     SELECT json_agg(
       json_build_object(
         'id', e.id,
         'name', e.name,
         'price', e.price
       )
       ORDER BY e.name ASC
     ) AS extras
     FROM menu_item_extras mie
     INNER JOIN extras e ON e.id = mie.extra_id
     WHERE mie.menu_item_id = m.id
   ) extras_for_item ON TRUE
   LEFT JOIN LATERAL (
     SELECT array_agg(mic.cafe_slug ORDER BY mic.cafe_slug) AS cafe_slugs
     FROM menu_item_cafes mic
     WHERE mic.menu_item_id = m.id
   ) cafes_for_item ON TRUE
   ${whereSql}`;
}

async function getMenuItemByIdWithClient(client, id) {
  const { rows } = await client.query(
    `${menuItemSelect("WHERE m.id = $1")}`,
    [id]
  );

  return rows[0] || null;
}

export async function getCategories(cafeSlug = null) {
  const normalizedCafeSlug = cafeSlug ? String(cafeSlug).trim().toLowerCase() : null;
  const values = [];
  let whereClause = "";

  if (normalizedCafeSlug) {
    values.push(normalizedCafeSlug);
    whereClause = `
      WHERE EXISTS (
        SELECT 1
        FROM menu_items m
        INNER JOIN menu_item_cafes mic ON mic.menu_item_id = m.id
        WHERE m.category_id = categories.id
          AND mic.cafe_slug = $1
      )
    `;
  }

  const { rows } = await pool.query(
    `SELECT id, name, group_name, theme, display_order
     FROM categories
     ${whereClause}
     ORDER BY group_name ASC, display_order ASC, name ASC`,
    values
  );
  return rows;
}

export async function createCategory({
  name,
  groupName = "General",
  theme = "default",
  displayOrder = 0
}) {
  const { rows } = await pool.query(
    `INSERT INTO categories (name, group_name, theme, display_order)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, group_name, theme, display_order`,
    [name, groupName, theme, displayOrder]
  );
  return rows[0];
}

export async function updateCategory(id, {
  name,
  groupName,
  theme,
  displayOrder
}) {
  const hasDisplayOrder = Number.isInteger(displayOrder);
  const { rows } = await pool.query(
    `UPDATE categories
     SET
       name = COALESCE($2, name),
       group_name = COALESCE($3, group_name),
       theme = COALESCE($4, theme),
       display_order = CASE WHEN $5::boolean THEN $6 ELSE display_order END
     WHERE id = $1
     RETURNING id, name, group_name, theme, display_order`,
    [id, name, groupName, theme, hasDisplayOrder, hasDisplayOrder ? displayOrder : null]
  );
  return rows[0];
}

export async function deleteCategory(id) {
  const result = await pool.query("DELETE FROM categories WHERE id = $1", [id]);
  return result.rowCount > 0;
}

export async function getExtras() {
  const { rows } = await pool.query("SELECT id, name, price FROM extras ORDER BY name ASC");
  return rows;
}

export async function createExtra({ name, price }) {
  const { rows } = await pool.query(
    "INSERT INTO extras (name, price) VALUES ($1, $2) RETURNING id, name, price",
    [name, price]
  );
  return rows[0];
}

export async function updateExtra(id, { name, price }) {
  const hasPrice = typeof price !== "undefined" && price !== null;
  const { rows } = await pool.query(
    `UPDATE extras
     SET
       name = COALESCE($2, name),
       price = CASE WHEN $3::boolean THEN $4 ELSE price END
     WHERE id = $1
     RETURNING id, name, price`,
    [id, name, hasPrice, hasPrice ? price : null]
  );

  return rows[0] || null;
}

export async function deleteExtra(id) {
  const result = await pool.query("DELETE FROM extras WHERE id = $1", [id]);
  return result.rowCount > 0;
}

export async function getMenuItems(cafeSlug = null) {
  const normalizedCafeSlug = cafeSlug ? String(cafeSlug).trim().toLowerCase() : null;
  const values = [];
  let whereClause = "";

  if (normalizedCafeSlug) {
    values.push(normalizedCafeSlug);
    whereClause = `WHERE EXISTS (
      SELECT 1
      FROM menu_item_cafes mic
      WHERE mic.menu_item_id = m.id
        AND mic.cafe_slug = $1
    )`;
  }

  const { rows } = await pool.query(
    `${menuItemSelect(whereClause)}
     ORDER BY c.name NULLS LAST, m.name ASC`,
    values
  );

  return rows;
}

export async function createMenuItem({
  name,
  description,
  price,
  image,
  categoryId,
  extraIds = [],
  cafeSlugs = DEFAULT_CAFE_SLUGS,
  allowCustomization = false
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const createdResult = await client.query(
      `INSERT INTO menu_items (name, description, price, image, category_id, allow_customization)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [name, description || "", price, image || null, categoryId || null, Boolean(allowCustomization)]
    );

    const menuItemId = createdResult.rows[0].id;
    await setMenuItemExtras(client, menuItemId, extraIds);
    await setMenuItemCafes(client, menuItemId, cafeSlugs);

    const menuItem = await getMenuItemByIdWithClient(client, menuItemId);

    await client.query("COMMIT");
    return menuItem;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateMenuItem(id, {
  name,
  description,
  price,
  image,
  categoryId,
  categoryIdProvided,
  extraIds,
  cafeSlugs,
  cafeSlugsProvided,
  allowCustomization,
  allowCustomizationProvided
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const updatedResult = await client.query(
      `UPDATE menu_items
       SET
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         price = COALESCE($4, price),
         image = COALESCE($5, image),
         category_id = CASE WHEN $6::boolean THEN $7 ELSE category_id END,
         allow_customization = CASE WHEN $8::boolean THEN $9 ELSE allow_customization END
       WHERE id = $1
       RETURNING id`,
      [
        id,
        name,
        description,
        price,
        image,
        Boolean(categoryIdProvided),
        categoryId ?? null,
        Boolean(allowCustomizationProvided),
        Boolean(allowCustomization)
      ]
    );

    if (!updatedResult.rows.length) {
      await client.query("ROLLBACK");
      return null;
    }

    if (Array.isArray(extraIds)) {
      await setMenuItemExtras(client, id, extraIds);
    }

    if (Boolean(cafeSlugsProvided)) {
      await setMenuItemCafes(client, id, cafeSlugs);
    }

    const menuItem = await getMenuItemByIdWithClient(client, id);

    await client.query("COMMIT");
    return menuItem;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteMenuItem(id) {
  const result = await pool.query("DELETE FROM menu_items WHERE id = $1", [id]);
  return result.rowCount > 0;
}
