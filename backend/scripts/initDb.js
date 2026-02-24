import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, "../sql/schema.sql");
const uploadsDir = path.join(__dirname, "../uploads");
const CAFE_SLUGS = ["raysdiner", "lovesgrove", "cosmiccafe"];

const categoryDefinitions = [
  { name: "Burgers & Baps", groupName: "Food", theme: "red", displayOrder: 10 },
  { name: "Chips", groupName: "Food", theme: "amber", displayOrder: 20 },
  { name: "Jacket Potato", groupName: "Food", theme: "orange", displayOrder: 30 },
  { name: "Pasties/Pie", groupName: "Food", theme: "orange", displayOrder: 35 },
  { name: "Kids Meals", groupName: "Food", theme: "teal", displayOrder: 40 },
  { name: "Pizza", groupName: "Food", theme: "red", displayOrder: 45 },
  { name: "Grill & Hot Dogs", groupName: "Food", theme: "amber", displayOrder: 47 },
  { name: "Snacks", groupName: "Treats", theme: "pink", displayOrder: 50 },
  { name: "Drinks", groupName: "Drinks", theme: "blue", displayOrder: 60 },
  { name: "Hot Drinks", groupName: "Drinks", theme: "indigo", displayOrder: 70 },
  { name: "Gluten Free", groupName: "Food", theme: "emerald", displayOrder: 75 },
  { name: "Ice Cream", groupName: "Treats", theme: "emerald", displayOrder: 80 }
];

const extraDefinitions = [
  { name: "Extra Cheese", price: 1.0 },
  { name: "Extra Bacon", price: 1.2 },
  { name: "Extra Egg", price: 1.0 },
  { name: "Extra Sausage", price: 1.5 },
  { name: "Extra Curry", price: 0.8 },
  { name: "Extra Chilli", price: 1.0 },
  { name: "Extra Fries", price: 1.2 },
  { name: "Extra Drink", price: 1.0 },
  { name: "Extra Sauce", price: 0.5 },
  { name: "Extra Toppings", price: 0.9 },
  { name: "Extra Cream", price: 0.8 },
  { name: "Caramel Syrup", price: 0.5 },
  { name: "Vanilla Syrup", price: 0.5 },
  { name: "Pumpkin Syrup", price: 0.5 },
  { name: "Hazelnut Syrup", price: 0.5 },
  { name: "Add Flake", price: 0.6 },
  { name: "Large Size", price: 0.7 }
];

const HOT_DRINK_SYRUPS = ["Caramel Syrup", "Vanilla Syrup", "Pumpkin Syrup", "Hazelnut Syrup"];
const CHIPS_EXTRAS = ["Extra Cheese", "Extra Curry", "Extra Chilli"];
const KIDS_EXTRAS = ["Extra Fries", "Extra Drink", "Extra Sauce"];

const menuDefinitions = [
  {
    category: "Burgers & Baps",
    name: "Cheese Burger",
    description: "Classic beef patty with melted cheese.",
    price: 6.5,
    extras: [],
    allowCustomization: false,
    cafeSlugs: ["raysdiner", "lovesgrove"]
  },
  {
    category: "Burgers & Baps",
    name: "Beef Burger",
    description: "Juicy beef burger in a toasted bap.",
    price: 6.8,
    extras: [],
    allowCustomization: false,
    cafeSlugs: ["raysdiner", "lovesgrove"]
  },
  {
    category: "Burgers & Baps",
    name: "Veggie Burger (Normal)",
    description: "Plant-based burger with standard bun and crisp salad.",
    price: 6.2,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Burgers & Baps",
    name: "Egg Sausage Bap",
    description: "Sausage and egg in a soft bap.",
    price: 5.5,
    extras: [],
    allowCustomization: false,
    cafeSlugs: ["raysdiner"]
  },
  {
    category: "Burgers & Baps",
    name: "Bacon Sausage Bap",
    description: "Bacon and sausage in a warm bap.",
    price: 5.8,
    extras: [],
    allowCustomization: false,
    cafeSlugs: ["raysdiner"]
  },
  {
    category: "Burgers & Baps",
    name: "Bacon Egg Sausage Bap",
    description: "Loaded bap with bacon, egg, and sausage.",
    price: 6.2,
    extras: [],
    allowCustomization: false,
    cafeSlugs: ["raysdiner"]
  },
  {
    category: "Burgers & Baps",
    name: "Hot Dog",
    description: "Classic hot dog served in a soft roll.",
    price: 5.4,
    extras: [],
    allowCustomization: false,
    cafeSlugs: ["lovesgrove"]
  },
  {
    category: "Burgers & Baps",
    name: "Chicken Burger",
    description: "Crispy chicken burger in a toasted bun.",
    price: 6.6,
    extras: [],
    allowCustomization: false,
    cafeSlugs: ["lovesgrove", "cosmiccafe"]
  },
  {
    category: "Chips",
    name: "Chips",
    description: "Golden crispy chips.",
    price: 3.0,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Gluten Free",
    name: "Veggie Burger (Gluten Free)",
    description: "Plant-based burger on a gluten-free bun.",
    price: 6.4,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Gluten Free",
    name: "Gluten Free Chips",
    description: "Crispy chips prepared as a gluten-free option.",
    price: 3.2,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Chips",
    name: "Chips + Cheese",
    description: "Crispy chips topped with melted cheese.",
    price: 3.8,
    extras: CHIPS_EXTRAS,
    allowCustomization: true
  },
  {
    category: "Chips",
    name: "Chips + Curry",
    description: "Crispy chips with rich curry sauce.",
    price: 3.8,
    extras: CHIPS_EXTRAS,
    allowCustomization: true
  },
  {
    category: "Chips",
    name: "Chips + Chilli",
    description: "Crispy chips with spicy chilli topping.",
    price: 4.0,
    extras: CHIPS_EXTRAS,
    allowCustomization: true
  },
  {
    category: "Jacket Potato",
    name: "Jacket + Cheese",
    description: "Baked jacket potato with cheese filling.",
    price: 4.5,
    extras: CHIPS_EXTRAS,
    allowCustomization: true
  },
  {
    category: "Jacket Potato",
    name: "Jacket + Chilli",
    description: "Baked jacket potato with chilli topping.",
    price: 5.2,
    extras: CHIPS_EXTRAS,
    allowCustomization: true
  },
  {
    category: "Jacket Potato",
    name: "Jacket + Curry",
    description: "Baked jacket potato with curry sauce.",
    price: 5.0,
    extras: CHIPS_EXTRAS,
    allowCustomization: true
  },
  {
    category: "Pasties/Pie",
    name: "Sausage Roll",
    description: "Flaky pastry sausage roll.",
    price: 2.8,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Pasties/Pie",
    name: "Pie",
    description: "Freshly baked house pie.",
    price: 4.2,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Pasties/Pie",
    name: "Steak Pasty",
    description: "Hearty steak-filled pasty.",
    price: 4.4,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Pasties/Pie",
    name: "Cheese and Onion Pasty",
    description: "Cheese and onion filling in flaky pastry.",
    price: 4.1,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Kids Meals",
    name: "Kids Cheese Burger Meal",
    description: "Kids meal with mini cheese burger.",
    price: 5.5,
    extras: KIDS_EXTRAS,
    allowCustomization: true
  },
  {
    category: "Kids Meals",
    name: "Kids Chicken Chunk Meal",
    description: "Kids meal with crispy chicken chunks.",
    price: 5.5,
    extras: KIDS_EXTRAS,
    allowCustomization: true
  },
  {
    category: "Kids Meals",
    name: "Kids Beef Burger Meal",
    description: "Kids meal with beef burger.",
    price: 5.8,
    extras: KIDS_EXTRAS,
    allowCustomization: true
  },
  {
    category: "Kids Meals",
    name: "Kids Veggie Burger Meal",
    description: "Kids meal with veggie burger.",
    price: 5.6,
    extras: KIDS_EXTRAS,
    allowCustomization: true
  },
  {
    category: "Kids Meals",
    name: "Kids Cold Lunch Box Meal",
    description: "Cold lunch box meal for kids.",
    price: 4.8,
    extras: KIDS_EXTRAS,
    allowCustomization: true
  },
  {
    category: "Kids Meals",
    name: "Kids Hot Dog Meal",
    description: "Kids hot dog meal with fries and drink.",
    price: 5.2,
    extras: KIDS_EXTRAS,
    allowCustomization: true,
    cafeSlugs: ["lovesgrove"]
  },
  {
    category: "Kids Meals",
    name: "Kids Chicken Burger Meal",
    description: "Kids chicken burger meal with fries and drink.",
    price: 5.6,
    extras: KIDS_EXTRAS,
    allowCustomization: true,
    cafeSlugs: ["lovesgrove"]
  },
  {
    category: "Kids Meals",
    name: "Kids Cheese Pizza Meal",
    description: "Kids pizza meal with cheese topping.",
    price: 6.0,
    extras: KIDS_EXTRAS,
    allowCustomization: true,
    cafeSlugs: ["cosmiccafe"]
  },
  {
    category: "Kids Meals",
    name: "Kids Pork Pizza Meal",
    description: "Kids pizza meal with pulled pork topping.",
    price: 6.2,
    extras: KIDS_EXTRAS,
    allowCustomization: true,
    cafeSlugs: ["cosmiccafe"]
  },
  {
    category: "Pizza",
    name: "12 Inch Four Cheese Pizza",
    description: "Four-cheese blend on a 12-inch base.",
    price: 11.9,
    extras: [],
    allowCustomization: false,
    cafeSlugs: ["cosmiccafe"]
  },
  {
    category: "Pizza",
    name: "12 Inch Pulled Pork Pizza",
    description: "12-inch pizza loaded with pulled pork.",
    price: 12.9,
    extras: [],
    allowCustomization: false,
    cafeSlugs: ["cosmiccafe"]
  },
  {
    category: "Pizza",
    name: "BBQ Pizza",
    description: "Smoky BBQ pizza with signature sauce.",
    price: 11.5,
    extras: [],
    allowCustomization: false,
    cafeSlugs: ["cosmiccafe"]
  },
  {
    category: "Pizza",
    name: "Vegan Pizza",
    description: "Plant-based toppings on a crisp base.",
    price: 11.2,
    extras: [],
    allowCustomization: false,
    cafeSlugs: ["cosmiccafe"]
  },
  {
    category: "Grill & Hot Dogs",
    name: "Chicken Strips",
    description: "Crispy chicken strips with dip.",
    price: 6.5,
    extras: [],
    allowCustomization: false,
    cafeSlugs: ["cosmiccafe"]
  },
  {
    category: "Grill & Hot Dogs",
    name: "Chicken Skewers",
    description: "Seasoned grilled chicken skewers.",
    price: 6.7,
    extras: [],
    allowCustomization: false,
    cafeSlugs: ["cosmiccafe"]
  },
  {
    category: "Grill & Hot Dogs",
    name: "Family Box",
    description: "Sharing box with mixed favourites.",
    price: 14.9,
    extras: [],
    allowCustomization: false,
    cafeSlugs: ["cosmiccafe"]
  },
  {
    category: "Grill & Hot Dogs",
    name: "Rollover",
    description: "Rollover hot snack served warm.",
    price: 5.2,
    extras: [],
    allowCustomization: false,
    cafeSlugs: ["cosmiccafe"]
  },
  {
    category: "Snacks",
    name: "Crisps",
    description: "Crispy grab-and-go snack pack.",
    price: 1.8,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Snacks",
    name: "Caramel Shortbread",
    description: "Buttery shortbread with caramel layer.",
    price: 2.4,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Snacks",
    name: "Brownie",
    description: "Rich chocolate brownie slice.",
    price: 2.6,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Snacks",
    name: "Rainbow Cupcake",
    description: "Vanilla cupcake topped with rainbow icing.",
    price: 2.5,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Snacks",
    name: "Cookie Dough Brownie",
    description: "Brownie layered with cookie dough.",
    price: 3.0,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Snacks",
    name: "Donut",
    description: "Soft glazed donut.",
    price: 2.2,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Snacks",
    name: "Sweets / Chocolate",
    description: "Assorted sweet and chocolate treats.",
    price: 2.0,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Drinks",
    name: "Bottled Drink",
    description: "Chilled bottled soft drink.",
    price: 2.2,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Drinks",
    name: "Bottled Still Water",
    description: "Still bottled water.",
    price: 1.5,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Drinks",
    name: "Shmoo Milkshake",
    description: "Creamy milkshake with optional toppings.",
    price: 3.8,
    extras: ["Extra Toppings", "Extra Cream"],
    allowCustomization: true
  },
  {
    category: "Drinks",
    name: "Fruit Shoot",
    description: "Fruit-flavoured kids drink bottle.",
    price: 1.9,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Drinks",
    name: "Flavoured Milk",
    description: "Chilled flavoured milk bottle.",
    price: 2.1,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Drinks",
    name: "Slushy",
    description: "Small size by default, upgrade to large.",
    price: 2.3,
    extras: ["Large Size"],
    allowCustomization: true
  },
  {
    category: "Drinks",
    name: "Fizzy Drink",
    description: "Small size by default, upgrade to large.",
    price: 2.0,
    extras: ["Large Size"],
    allowCustomization: true
  },
  {
    category: "Hot Drinks",
    name: "Tea",
    description: "Freshly brewed tea.",
    price: 2.0,
    extras: HOT_DRINK_SYRUPS,
    allowCustomization: true
  },
  {
    category: "Hot Drinks",
    name: "Latte",
    description: "Smooth espresso with steamed milk.",
    price: 3.0,
    extras: HOT_DRINK_SYRUPS,
    allowCustomization: true
  },
  {
    category: "Hot Drinks",
    name: "Cappuccino",
    description: "Foamy espresso classic.",
    price: 3.0,
    extras: HOT_DRINK_SYRUPS,
    allowCustomization: true
  },
  {
    category: "Hot Drinks",
    name: "Black Coffee",
    description: "Strong black coffee.",
    price: 2.6,
    extras: HOT_DRINK_SYRUPS,
    allowCustomization: true
  },
  {
    category: "Hot Drinks",
    name: "Flat White",
    description: "Velvety espresso and milk.",
    price: 3.1,
    extras: HOT_DRINK_SYRUPS,
    allowCustomization: true
  },
  {
    category: "Ice Cream",
    name: "Magnum",
    description: "Kwality lollies classic Magnum.",
    price: 2.8,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Ice Cream",
    name: "Cornetto",
    description: "Kwality lollies Cornetto cone.",
    price: 2.4,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Ice Cream",
    name: "Mini Milk",
    description: "Kwality lollies Mini Milk.",
    price: 1.6,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Ice Cream",
    name: "Calippo",
    description: "Kwality lollies Calippo.",
    price: 2.0,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Ice Cream",
    name: "Feast",
    description: "Kwality lollies Feast bar.",
    price: 2.3,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Ice Cream",
    name: "Haribo Push Up",
    description: "Kwality lollies Haribo Push Up.",
    price: 2.2,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Ice Cream",
    name: "Cornetto Go Sandwich",
    description: "Kwality lollies Cornetto Go Sandwich.",
    price: 2.5,
    extras: [],
    allowCustomization: false
  },
  {
    category: "Ice Cream",
    name: "Yarde Farm Ice Cream - Single Scoop",
    description: "Yarde Farm single scoop with optional flake.",
    price: 3.5,
    extras: ["Add Flake"],
    allowCustomization: true,
    cafeSlugs: ["raysdiner", "lovesgrove"]
  },
  {
    category: "Ice Cream",
    name: "Yarde Farm Ice Cream - Double Scoop",
    description: "Yarde Farm double scoop with optional flake.",
    price: 4.8,
    extras: ["Add Flake"],
    allowCustomization: true,
    cafeSlugs: ["raysdiner", "lovesgrove"]
  }
];

const itemAssetFileMap = {
  "Cheese Burger": "cheeseburger.webp",
  "Beef Burger": "beefburger.webp",
  "Gluten Free Chips": "chips.jpg",
  "Egg Sausage Bap": "baconsausagebap.jpg",
  "Veggie Burger (Normal)": "vegie burger.jpg",
  "Veggie Burger (Gluten Free)": "vegie burger.jpg",
  "Bacon Sausage Bap": "baconsausagebap.jpg",
  "Bacon Egg Sausage Bap": "baconeggsausagebap.jfif",
  "Hot Dog": "hotdog.jpg",
  Rollover: "rollover hotdog.jpg",
  "Chicken Burger": "chicken burger.webp",
  Chips: "chips.jpg",
  "Chips + Cheese": "chips+cheese.jpg",
  "Chips + Curry": "chips+curry.webp",
  "Chips + Chilli": "chips+chilly.webp",
  "Jacket + Cheese": "jacket+cheese.jpg",
  "Jacket + Chilli": "jacket+chilly.webp",
  "Jacket + Curry": "jacket+curry.jpg",
  "Sausage Roll": "sausage roll.jfif",
  Pie: "pie.webp",
  "Steak Pasty": "steak pasty.jpg",
  "Cheese and Onion Pasty": "cheese and onion pasty.webp",
  "Kids Cheese Burger Meal": "kidscheeseburgermeal.avif",
  "Kids Chicken Chunk Meal": "kidschickenchunkmeal.jfif",
  "Kids Beef Burger Meal": "kidsbeefburgermeal.avif",
  "Kids Veggie Burger Meal": "vegie burger.jpg",
  "Kids Cold Lunch Box Meal": "kidscoldlunchboxmeal.jpg",
  "Kids Chicken Burger Meal": "kidschickenburgermeal.jpg",
  "Kids Cheese Pizza Meal": "kids cheese pizza.jpg",
  "Kids Pork Pizza Meal": "kids chickenpizza.jpg",
  "12 Inch Four Cheese Pizza": "four cheese pizza.webp",
  "12 Inch Pulled Pork Pizza": "pork pizza.jpg",
  "BBQ Pizza": "bbq pizza.jpg",
  "Vegan Pizza": "vegan pizza.jpg",
  "Chicken Strips": "chicken strips.jpg",
  "Chicken Skewers": "chicken skewers.jpg",
  Crisps: "crips.png",
  "Caramel Shortbread": "caramelshortbread.jpg",
  Brownie: "brownie.webp",
  "Rainbow Cupcake": "Rainbowcupcake.webp",
  "Cookie Dough Brownie": "cookiedoughbrownie.jpg",
  Donut: "donut.webp",
  "Sweets / Chocolate": "sweetschocolate.jpg",
  "Bottled Drink": "bottled drink.webp",
  "Bottled Still Water": "bottled water.jpeg",
  "Shmoo Milkshake": "shmoomilkshake.webp",
  "Fruit Shoot": "fruitshoot.jpg",
  "Flavoured Milk": "flavored milk.jpg",
  Slushy: "slushy.jpg",
  "Fizzy Drink": "fizzy drink.jpg",
  Tea: "tea.jpg",
  Latte: "latte.jpg",
  "Black Coffee": "blackcoffe.jpg",
  Cappuccino: "cappuccino.webp",
  "Flat White": "flatwhite.webp",
  Capicino: "cappuccino.webp"
};

const legacyNameFixes = [
  { from: "Capicino", to: "Cappuccino" },
  { from: "Black Coffe", to: "Black Coffee" },
  { from: "Crips", to: "Crisps" },
  { from: "Fruiteshoot", to: "Fruit Shoot" },
  { from: "Flavouredmilk", to: "Flavoured Milk" },
  { from: "Veggie Burger", to: "Veggie Burger (Normal)" }
];

function toSafeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveAssetDirectory() {
  const candidates = [
    path.join(__dirname, "../../asset"),
    path.join(__dirname, "../asset"),
    "/app/asset"
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  return null;
}

function copyAssetForItem(itemName, assetDirectory) {
  if (!assetDirectory) {
    return null;
  }

  const assetFileName = itemAssetFileMap[itemName];
  if (!assetFileName) {
    return null;
  }

  const sourcePath = path.join(assetDirectory, assetFileName);
  if (!fs.existsSync(sourcePath)) {
    return null;
  }

  fs.mkdirSync(uploadsDir, { recursive: true });

  const extension = path.extname(assetFileName) || ".jpg";
  const targetFileName = `seed-${toSafeSlug(itemName)}${extension}`;
  const targetPath = path.join(uploadsDir, targetFileName);

  if (!fs.existsSync(targetPath)) {
    fs.copyFileSync(sourcePath, targetPath);
  }

  return `/uploads/${targetFileName}`;
}

async function upsertCategory(client, {
  name,
  groupName = "General",
  theme = "default",
  displayOrder = 0
}) {
  const { rows } = await client.query(
    `INSERT INTO categories (name, group_name, theme, display_order)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (name)
     DO UPDATE SET
       group_name = CASE
         WHEN categories.group_name IN ('', 'General') THEN EXCLUDED.group_name
         ELSE categories.group_name
       END,
       theme = CASE
         WHEN categories.theme IN ('', 'default') THEN EXCLUDED.theme
         ELSE categories.theme
       END,
       display_order = CASE
         WHEN categories.display_order = 0 THEN EXCLUDED.display_order
         ELSE categories.display_order
       END
     RETURNING id, name, group_name, theme, display_order`,
    [name, groupName, theme, displayOrder]
  );

  return rows[0];
}

async function upsertExtra(client, name, price) {
  const { rows } = await client.query(
    `INSERT INTO extras (name, price)
     VALUES ($1, $2)
     ON CONFLICT (name)
     DO UPDATE SET price = EXCLUDED.price
     RETURNING id, name, price`,
    [name, price]
  );

  return rows[0];
}

async function setMenuItemExtras(client, menuItemId, extraIds) {
  await client.query("DELETE FROM menu_item_extras WHERE menu_item_id = $1", [menuItemId]);

  if (!extraIds.length) {
    return;
  }

  await client.query(
    `INSERT INTO menu_item_extras (menu_item_id, extra_id)
     SELECT $1, extra_id
     FROM UNNEST($2::int[]) AS extra_id`,
    [menuItemId, extraIds]
  );
}

async function setMenuItemCafes(client, menuItemId, cafeSlugs) {
  const normalized = [...new Set((Array.isArray(cafeSlugs) ? cafeSlugs : CAFE_SLUGS)
    .map((slug) => String(slug || "").trim().toLowerCase())
    .filter((slug) => CAFE_SLUGS.includes(slug)))];

  const finalCafeSlugs = normalized.length ? normalized : [...CAFE_SLUGS];

  await client.query("DELETE FROM menu_item_cafes WHERE menu_item_id = $1", [menuItemId]);
  await client.query(
    `INSERT INTO menu_item_cafes (menu_item_id, cafe_slug)
     SELECT $1, cafe_slug
     FROM UNNEST($2::text[]) AS cafe_slug`,
    [menuItemId, finalCafeSlugs]
  );
}

async function applyLegacyNameFixes(client) {
  for (const fix of legacyNameFixes) {
    await client.query(
      `UPDATE menu_items
       SET name = $2
       WHERE lower(name) = lower($1)
         AND NOT EXISTS (
           SELECT 1 FROM menu_items existing WHERE lower(existing.name) = lower($2)
         )`,
      [fix.from, fix.to]
    );
  }
}

async function ensureSeedMenu(client, categories, extras, assetDirectory) {
  for (const menuItem of menuDefinitions) {
    const categoryId = categories[menuItem.category];
    const imagePath = copyAssetForItem(menuItem.name, assetDirectory);
    const mappedExtraIds = menuItem.extras.map((extraName) => extras[extraName]).filter(Boolean);
    const scopedCafes = menuItem.cafeSlugs || CAFE_SLUGS;

    const { rows: existingRows } = await client.query(
      `SELECT id, image, allow_customization, description, category_id
       FROM menu_items
       WHERE lower(name) = lower($1)
       ORDER BY id ASC
       LIMIT 1`,
      [menuItem.name]
    );

    if (existingRows.length) {
      const existing = existingRows[0];
      const updates = [];
      const values = [existing.id];

      if (imagePath && !existing.image) {
        values.push(imagePath);
        updates.push(`image = $${values.length}`);
      }

      if (menuItem.description && !String(existing.description || "").trim()) {
        values.push(menuItem.description);
        updates.push(`description = $${values.length}`);
      }

      if (categoryId && !existing.category_id) {
        values.push(categoryId);
        updates.push(`category_id = $${values.length}`);
      }

      if (Boolean(menuItem.allowCustomization) && !Boolean(existing.allow_customization)) {
        updates.push("allow_customization = TRUE");
      }

      if (updates.length) {
        await client.query(
          `UPDATE menu_items
           SET ${updates.join(", ")}
           WHERE id = $1`,
          values
        );
      }

      if (mappedExtraIds.length) {
        const { rows: linkRows } = await client.query(
          "SELECT COUNT(*)::int AS count FROM menu_item_extras WHERE menu_item_id = $1",
          [existing.id]
        );

        if (linkRows[0].count === 0) {
          await setMenuItemExtras(client, existing.id, mappedExtraIds);
        }
      }

      const hasExplicitCafeScope = Array.isArray(menuItem.cafeSlugs) && menuItem.cafeSlugs.length > 0;
      if (hasExplicitCafeScope) {
        await setMenuItemCafes(client, existing.id, scopedCafes);
      } else {
        const { rows: cafeRows } = await client.query(
          "SELECT COUNT(*)::int AS count FROM menu_item_cafes WHERE menu_item_id = $1",
          [existing.id]
        );

        if (cafeRows[0].count === 0) {
          await setMenuItemCafes(client, existing.id, scopedCafes);
        }
      }

      continue;
    }

    const { rows } = await client.query(
      `INSERT INTO menu_items (name, description, price, category_id, image, allow_customization)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        menuItem.name,
        menuItem.description,
        menuItem.price,
        categoryId || null,
        imagePath,
        Boolean(menuItem.allowCustomization)
      ]
    );

    const menuItemId = rows[0].id;
    await setMenuItemExtras(client, menuItemId, mappedExtraIds);
    await setMenuItemCafes(client, menuItemId, scopedCafes);
  }
}

async function backfillMenuImages(client, assetDirectory) {
  if (!assetDirectory) {
    return;
  }

  const { rows } = await client.query("SELECT id, name, image FROM menu_items");

  for (const row of rows) {
    if (row.image) {
      continue;
    }

    const imagePath = copyAssetForItem(row.name, assetDirectory);
    if (!imagePath) {
      continue;
    }

    await client.query("UPDATE menu_items SET image = $2 WHERE id = $1", [row.id, imagePath]);
  }
}

async function backfillMenuCafeScopes(client) {
  const { rows } = await client.query(
    `SELECT m.id
     FROM menu_items m
     WHERE NOT EXISTS (
       SELECT 1
       FROM menu_item_cafes mic
       WHERE mic.menu_item_id = m.id
     )`
  );

  for (const row of rows) {
    await setMenuItemCafes(client, row.id, CAFE_SLUGS);
  }
}

async function init() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    await client.query(schemaSql);

    const adminEmail = "admin@raysdiner.local";
    const kitchenEmail = "kitchen@raysdiner.local";

    const { rows: users } = await client.query("SELECT email FROM users WHERE email = ANY($1)", [[adminEmail, kitchenEmail]]);
    const existing = new Set(users.map((row) => row.email));

    if (!existing.has(adminEmail)) {
      const password = await bcrypt.hash("admin123", 10);
      await client.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)",
        ["Admin", adminEmail, password, "admin"]
      );
    }

    if (!existing.has(kitchenEmail)) {
      const password = await bcrypt.hash("kitchen123", 10);
      await client.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)",
        ["Kitchen", kitchenEmail, password, "kitchen"]
      );
    }

    await client.query(
      `INSERT INTO app_settings (key, value)
       VALUES ('customer_portal_theme', 'dark')
       ON CONFLICT (key) DO NOTHING`
    );

    await applyLegacyNameFixes(client);

    const categories = {};
    for (const categoryDefinition of categoryDefinitions) {
      const category = await upsertCategory(client, categoryDefinition);
      categories[category.name] = category.id;
    }

    const extras = {};
    for (const extra of extraDefinitions) {
      const upserted = await upsertExtra(client, extra.name, extra.price);
      extras[upserted.name] = upserted.id;
    }

    const assetDirectory = resolveAssetDirectory();
    await ensureSeedMenu(client, categories, extras, assetDirectory);
    await backfillMenuImages(client, assetDirectory);
    await backfillMenuCafeScopes(client);

    await client.query("COMMIT");

    // eslint-disable-next-line no-console
    console.log("Database initialized successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    // eslint-disable-next-line no-console
    console.error("Failed to initialize database", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

init();
