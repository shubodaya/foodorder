import { useEffect, useMemo, useState } from "react";

import {
  createCategory,
  createExtra,
  createMenuItem,
  deleteCategory,
  deleteExtra,
  deleteMenuItem,
  fetchMenu,
  updateCategory,
  updateExtra,
  updateMenuItem
} from "../services/menuService";
import { CAFE_CONFIGS } from "../constants/cafes";
import { getAssetBaseUrl } from "../services/runtimeConfig";

const IMAGE_BASE_URL = getAssetBaseUrl();

function formatCurrency(value) {
  return `$${Number(value).toFixed(2)}`;
}

const INITIAL_ITEM_FORM = {
  id: null,
  name: "",
  description: "",
  price: "",
  categoryId: "",
  extraIds: [],
  cafeSlugs: CAFE_CONFIGS.map((cafe) => cafe.slug),
  image: null,
  allowCustomization: false
};

const INITIAL_EXTRA_FORM = {
  id: null,
  name: "",
  price: ""
};

const INITIAL_CATEGORY_FORM = {
  id: null,
  name: "",
  groupName: "Food",
  theme: "default",
  displayOrder: 0
};

const CATEGORY_THEME_OPTIONS = [
  "default",
  "red",
  "amber",
  "orange",
  "teal",
  "blue",
  "indigo",
  "pink",
  "emerald"
];

export default function AdminMenuPage() {
  const [menu, setMenu] = useState({ categories: [], items: [], extras: [] });
  const [itemForm, setItemForm] = useState(INITIAL_ITEM_FORM);
  const [extraForm, setExtraForm] = useState(INITIAL_EXTRA_FORM);
  const [categoryForm, setCategoryForm] = useState(INITIAL_CATEGORY_FORM);
  const [previewCafeSlug, setPreviewCafeSlug] = useState(CAFE_CONFIGS[0]?.slug || "raysdiner");
  const [previewCategoryId, setPreviewCategoryId] = useState("all");
  const [previewItemQuery, setPreviewItemQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadMenu = async () => {
    const data = await fetchMenu();
    setMenu({
      categories: data.categories || [],
      items: data.items || [],
      extras: data.extras || []
    });
  };

  useEffect(() => {
    loadMenu()
      .catch(() => setError("Failed to load menu."))
      .finally(() => setLoading(false));
  }, []);

  const submitCategory = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!categoryForm.name.trim()) {
      setError("Category name is required.");
      return;
    }

    try {
      const payload = {
        name: categoryForm.name.trim(),
        group_name: categoryForm.groupName.trim() || "General",
        theme: categoryForm.theme.trim() || "default",
        display_order: Number(categoryForm.displayOrder) || 0
      };

      if (categoryForm.id) {
        await updateCategory(categoryForm.id, payload);
        setMessage("Category updated.");
      } else {
        await createCategory(payload);
        setMessage("Category created.");
      }

      setCategoryForm(INITIAL_CATEGORY_FORM);
      await loadMenu();
    } catch (_error) {
      setError("Unable to save category.");
    }
  };

  const removeCategoryById = async (id) => {
    setError("");
    setMessage("");

    try {
      await deleteCategory(id);
      setMessage("Category deleted.");
      await loadMenu();
    } catch (_error) {
      setError("Unable to delete category.");
    }
  };

  const editCategoryItem = (category) => {
    setCategoryForm({
      id: category.id,
      name: category.name,
      groupName: category.group_name || "General",
      theme: category.theme || "default",
      displayOrder: Number(category.display_order || 0)
    });
  };

  const submitExtra = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!extraForm.name.trim() || extraForm.price === "") {
      setError("Extra name and price are required.");
      return;
    }

    try {
      if (extraForm.id) {
        await updateExtra(extraForm.id, {
          name: extraForm.name.trim(),
          price: Number(extraForm.price)
        });
        setMessage("Extra updated.");
      } else {
        await createExtra({
          name: extraForm.name.trim(),
          price: Number(extraForm.price)
        });
        setMessage("Extra created.");
      }

      setExtraForm(INITIAL_EXTRA_FORM);
      await loadMenu();
    } catch (_error) {
      setError("Unable to save extra.");
    }
  };

  const editExtraItem = (extra) => {
    setExtraForm({
      id: extra.id,
      name: extra.name,
      price: String(extra.price)
    });
  };

  const removeExtraById = async (id) => {
    setError("");
    setMessage("");

    try {
      await deleteExtra(id);
      setMessage("Extra deleted.");
      await loadMenu();
      setItemForm((current) => ({
        ...current,
        extraIds: current.extraIds.filter((extraId) => String(extraId) !== String(id))
      }));
    } catch (_error) {
      setError("Unable to delete extra.");
    }
  };

  const toggleItemExtra = (extraId) => {
    setItemForm((current) => {
      const idAsString = String(extraId);
      const nextExtraIds = current.extraIds.includes(idAsString)
        ? current.extraIds.filter((id) => id !== idAsString)
        : [...current.extraIds, idAsString];

      return {
        ...current,
        extraIds: nextExtraIds
      };
    });
  };

  const toggleItemCafe = (cafeSlug) => {
    setItemForm((current) => {
      const nextCafeSlugs = current.cafeSlugs.includes(cafeSlug)
        ? current.cafeSlugs.filter((slug) => slug !== cafeSlug)
        : [...current.cafeSlugs, cafeSlug];

      return {
        ...current,
        cafeSlugs: nextCafeSlugs
      };
    });
  };

  const submitMenuItem = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!itemForm.name.trim() || itemForm.price === "") {
      setError("Item name and price are required.");
      return;
    }

    if (!itemForm.cafeSlugs.length) {
      setError("Select at least one cafe for this item.");
      return;
    }

    const body = new FormData();
    body.append("name", itemForm.name.trim());
    body.append("description", itemForm.description);
    body.append("price", itemForm.price);
    body.append("category_id", itemForm.categoryId || "");
    body.append("extra_ids", JSON.stringify(itemForm.extraIds.map((id) => Number(id))));
    body.append("cafe_slugs", JSON.stringify(itemForm.cafeSlugs));
    body.append("allow_customization", itemForm.allowCustomization ? "true" : "false");
    if (itemForm.image) {
      body.append("image", itemForm.image);
    }

    try {
      if (itemForm.id) {
        await updateMenuItem(itemForm.id, body);
        setMessage("Menu item updated.");
      } else {
        await createMenuItem(body);
        setMessage("Menu item created.");
      }

      setItemForm(INITIAL_ITEM_FORM);
      await loadMenu();
    } catch (_error) {
      setError("Unable to save menu item.");
    }
  };

  const editItem = (item) => {
    setItemForm({
      id: item.id,
      name: item.name,
      description: item.description || "",
      price: String(item.price),
      categoryId: item.category_id ? String(item.category_id) : "",
      extraIds: (item.extras || []).map((extra) => String(extra.id)),
      cafeSlugs: Array.isArray(item.cafe_slugs) && item.cafe_slugs.length
        ? item.cafe_slugs
        : CAFE_CONFIGS.map((cafe) => cafe.slug),
      image: null,
      allowCustomization: Boolean(item.allow_customization)
    });
  };

  const removeItem = async (id) => {
    setError("");
    setMessage("");

    try {
      await deleteMenuItem(id);
      setMessage("Menu item removed.");
      await loadMenu();
    } catch (_error) {
      setError("Unable to delete item.");
    }
  };

  const categoryMap = useMemo(() => {
    const map = {};
    menu.categories.forEach((category) => {
      map[category.id] = category.name;
    });
    return map;
  }, [menu.categories]);

  const previewCategories = useMemo(() => (
    menu.categories
      .filter((category) => (
        menu.items.some((item) => (
          String(item.category_id) === String(category.id)
          && (!item.cafe_slugs?.length || item.cafe_slugs.includes(previewCafeSlug))
        ))
      ))
      .sort((a, b) => {
        const orderDiff = Number(a.display_order || 0) - Number(b.display_order || 0);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        return String(a.name || "").localeCompare(String(b.name || ""));
      })
  ), [menu.categories, menu.items, previewCafeSlug]);

  const previewItems = useMemo(() => (
    menu.items.filter((item) => {
      const inCafe = !item.cafe_slugs?.length || item.cafe_slugs.includes(previewCafeSlug);
      const inCategory = previewCategoryId === "all" || String(item.category_id) === String(previewCategoryId);
      const nameMatches = !previewItemQuery.trim() || String(item.name || "")
        .toLowerCase()
        .includes(previewItemQuery.trim().toLowerCase());

      return inCafe && inCategory && nameMatches;
    })
  ), [menu.items, previewCafeSlug, previewCategoryId, previewItemQuery]);

  useEffect(() => {
    if (previewCategoryId === "all") {
      return;
    }

    const stillValid = previewCategories.some((category) => String(category.id) === String(previewCategoryId));
    if (!stillValid) {
      setPreviewCategoryId("all");
    }
  }, [previewCategories, previewCategoryId]);

  return (
    <section className="space-y-6">
      <div className="premium-hero rounded-[2rem] p-6 text-white shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/90">Admin Portal</p>
        <h1 className="mt-2 text-3xl font-black uppercase">Staff Menu Management</h1>
      </div>

      {message && <p className="rounded-xl bg-emerald-600/20 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">{message}</p>}
      {error && <p className="rounded-xl bg-red-600/20 px-3 py-2 text-sm text-red-800 dark:text-red-300">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="premium-surface space-y-4 rounded-3xl p-5 shadow-panel">
          <form onSubmit={submitCategory} className="space-y-3">
            <h2 className="text-xl font-black uppercase">Categories</h2>
            <div className="grid gap-2 md:grid-cols-2">
              <input
                type="text"
                value={categoryForm.name}
                onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Category name"
                className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
              />
              <input
                type="text"
                value={categoryForm.groupName}
                onChange={(event) => setCategoryForm((current) => ({ ...current, groupName: event.target.value }))}
                placeholder="Category group (e.g. Food, Drinks)"
                className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
              />
              <select
                value={categoryForm.theme}
                onChange={(event) => setCategoryForm((current) => ({ ...current, theme: event.target.value }))}
                className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
              >
                {CATEGORY_THEME_OPTIONS.map((theme) => (
                  <option key={theme} value={theme}>{theme}</option>
                ))}
              </select>
              <input
                type="number"
                value={categoryForm.displayOrder}
                onChange={(event) => setCategoryForm((current) => ({ ...current, displayOrder: event.target.value }))}
                placeholder="Display order"
                className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="submit" className="shimmer-btn rounded-2xl bg-diner-teal px-4 py-3 text-sm font-bold text-white">
                {categoryForm.id ? "Update Category" : "Add Category"}
              </button>
              {categoryForm.id && (
                <button
                  type="button"
                  className="rounded-2xl bg-black px-4 py-3 text-sm font-bold text-white"
                  onClick={() => setCategoryForm(INITIAL_CATEGORY_FORM)}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {menu.categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between rounded-xl border border-black/10 px-3 py-2 text-sm dark:border-white/10">
                <span>
                  {category.name}
                  <span className="ml-2 text-xs opacity-70">
                    ({category.group_name || "General"} | {category.theme || "default"} | #{category.display_order ?? 0})
                  </span>
                </span>
                <div className="flex gap-2">
                  <button type="button" className="rounded-lg bg-diner-teal px-3 py-1 text-xs font-bold text-white" onClick={() => editCategoryItem(category)}>
                    Edit
                  </button>
                  <button type="button" className="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white" onClick={() => removeCategoryById(category.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="premium-surface space-y-4 rounded-3xl p-5 shadow-panel">
          <form onSubmit={submitExtra} className="space-y-3">
            <h2 className="text-xl font-black uppercase">Extras</h2>
            <input
              type="text"
              value={extraForm.name}
              onChange={(event) => setExtraForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Extra name"
              className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={extraForm.price}
              onChange={(event) => setExtraForm((current) => ({ ...current, price: event.target.value }))}
              placeholder="Extra price"
              className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
            />

            <div className="flex gap-2">
              <button type="submit" className="shimmer-btn rounded-2xl bg-diner-red px-4 py-3 text-sm font-bold text-white">
                {extraForm.id ? "Update Extra" : "Create Extra"}
              </button>
              {extraForm.id && (
                <button type="button" className="rounded-2xl bg-black px-4 py-3 text-sm font-bold text-white" onClick={() => setExtraForm(INITIAL_EXTRA_FORM)}>
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {menu.extras.map((extra) => (
              <div key={extra.id} className="flex items-center justify-between rounded-xl border border-black/10 px-3 py-2 text-sm dark:border-white/10">
                <span>{extra.name} ({formatCurrency(extra.price)})</span>
                <div className="flex gap-2">
                  <button type="button" className="rounded-lg bg-diner-teal px-3 py-1 text-xs font-bold text-white" onClick={() => editExtraItem(extra)}>
                    Edit
                  </button>
                  <button type="button" className="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white" onClick={() => removeExtraById(extra.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={submitMenuItem} className="premium-surface space-y-3 rounded-3xl p-5 shadow-panel">
        <h2 className="text-xl font-black uppercase">{itemForm.id ? "Edit Item" : "Create Item"}</h2>
        <input
          type="text"
          value={itemForm.name}
          onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Item name"
          className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
          required
        />
        <textarea
          value={itemForm.description}
          onChange={(event) => setItemForm((current) => ({ ...current, description: event.target.value }))}
          placeholder="Description"
          className="h-24 w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
        />
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="number"
            min="0"
            step="0.01"
            value={itemForm.price}
            onChange={(event) => setItemForm((current) => ({ ...current, price: event.target.value }))}
            placeholder="Price"
            className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
            required
          />
          <select
            value={itemForm.categoryId}
            onChange={(event) => setItemForm((current) => ({ ...current, categoryId: event.target.value }))}
            className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
          >
            <option value="">No Category</option>
            {menu.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.group_name ? `${category.group_name} / ` : ""}{category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-wide">Allowed extras for this item</p>
          <div className="max-h-64 overflow-y-auto pr-1">
            <div className="grid gap-2 md:grid-cols-2">
              {menu.extras.map((extra) => {
                const checked = itemForm.extraIds.includes(String(extra.id));
                return (
                  <label key={extra.id} className="flex cursor-pointer items-center justify-between rounded-xl border border-black/10 px-3 py-2 text-sm dark:border-white/10">
                    <span>{extra.name} (+{formatCurrency(extra.price)})</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItemExtra(extra.id)}
                      className="h-4 w-4"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-wide">Cafe Availability</p>
          <div className="grid gap-2 md:grid-cols-3">
            {CAFE_CONFIGS.map((cafe) => {
              const checked = itemForm.cafeSlugs.includes(cafe.slug);
              return (
                <label key={cafe.slug} className="flex cursor-pointer items-center justify-between rounded-xl border border-black/10 px-3 py-2 text-sm dark:border-white/10">
                  <span>{cafe.label}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleItemCafe(cafe.slug)}
                    className="h-4 w-4"
                  />
                </label>
              );
            })}
          </div>
        </div>

        <label className="flex items-center justify-between rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/10">
          <span className="font-semibold">Customer can customize this item</span>
          <input
            type="checkbox"
            checked={itemForm.allowCustomization}
            onChange={(event) => setItemForm((current) => ({ ...current, allowCustomization: event.target.checked }))}
            className="h-4 w-4"
          />
        </label>

        <input
          type="file"
          accept="image/*"
          onChange={(event) => setItemForm((current) => ({ ...current, image: event.target.files?.[0] || null }))}
          className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
        />

        <div className="flex gap-2">
          <button type="submit" className="shimmer-btn rounded-2xl bg-diner-red px-4 py-3 text-sm font-bold text-white">
            {itemForm.id ? "Update Item" : "Create Item"}
          </button>
          {itemForm.id && (
            <button
              type="button"
              className="rounded-2xl bg-black px-4 py-3 text-sm font-bold text-white"
              onClick={() => setItemForm(INITIAL_ITEM_FORM)}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <div className="space-y-3">
        <h2 className="text-xl font-black uppercase">Menu Preview & Items</h2>
        <p className="text-sm opacity-75">Preview exactly like customer menu by cafe and category, then edit/delete items here.</p>

        <div className="premium-surface grid gap-3 rounded-2xl p-4 shadow-soft lg:grid-cols-[1fr,1fr,1.2fr]">
          <select
            value={previewCafeSlug}
            onChange={(event) => setPreviewCafeSlug(event.target.value)}
            className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
          >
            {CAFE_CONFIGS.map((cafe) => (
              <option key={cafe.slug} value={cafe.slug}>{cafe.label}</option>
            ))}
          </select>

          <select
            value={previewCategoryId}
            onChange={(event) => setPreviewCategoryId(event.target.value)}
            className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
          >
            <option value="all">All Categories</option>
            {previewCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={previewItemQuery}
            onChange={(event) => setPreviewItemQuery(event.target.value)}
            placeholder="Filter item name"
            className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/20 dark:bg-slate-900"
          />
        </div>

        {loading && <p className="text-sm">Loading menu items...</p>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {previewItems.map((item) => (
            <article key={item.id} className="premium-surface rounded-3xl p-4 shadow-panel">
              <img
                src={item.image ? `${IMAGE_BASE_URL}${item.image}` : "https://placehold.co/400x200/1f2933/fefae0?text=Menu+Item"}
                alt={item.name}
                className="mb-3 h-36 w-full rounded-2xl object-cover"
              />
              <h3 className="text-lg font-black">{item.name}</h3>
              {item.allow_customization && (
                <p className="mt-1 inline-flex rounded-full bg-diner-teal/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-diner-teal dark:bg-diner-teal/30 dark:text-teal-100">
                  Customizable
                </p>
              )}
              <p className="text-sm opacity-80">{item.description}</p>
              <p className="mt-2 text-sm font-semibold">{formatCurrency(item.price)} | {categoryMap[item.category_id] || "Uncategorized"}</p>
              <p className="mt-1 text-xs opacity-75">
                Cafes: {(item.cafe_slugs || []).map((slug) => CAFE_CONFIGS.find((cafe) => cafe.slug === slug)?.label || slug).join(", ") || "None"}
              </p>

              {!!item.extras?.length && (
                <ul className="mt-2 space-y-1 text-xs opacity-80">
                  {item.extras.map((extra) => (
                    <li key={`${item.id}-${extra.id}`}>+ {extra.name} ({formatCurrency(extra.price)})</li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex gap-2">
                <button type="button" className="rounded-xl bg-diner-teal px-3 py-2 text-sm font-bold text-white" onClick={() => editItem(item)}>Edit</button>
                <button type="button" className="rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white" onClick={() => removeItem(item.id)}>Delete</button>
              </div>
            </article>
          ))}
          {!loading && !previewItems.length && (
            <p className="premium-surface rounded-2xl p-4 text-sm">No items match this cafe/category filter.</p>
          )}
        </div>
      </div>
    </section>
  );
}
