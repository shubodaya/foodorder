import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import MenuItemCard from "../components/MenuItemCard";
import { DEFAULT_CAFE_SLUG, getCafeConfig, isValidCafeSlug, normalizeCafeSlug } from "../constants/cafes";
import { useCart } from "../context/CartContext";
import { fetchMenu } from "../services/menuService";
import { getAssetBaseUrl, resolveAssetUrl } from "../services/runtimeConfig";

const IMAGE_BASE_URL = getAssetBaseUrl();

function formatCurrency(value) {
  return `$${Number(value).toFixed(2)}`;
}

function canCustomizeItem(item) {
  if (Boolean(item?.allow_customization)) {
    return true;
  }

  const name = (item?.name || "").toLowerCase();
  return (item?.category_name === "Chips" && name.startsWith("chips +"))
    || name.includes("shmoo milkshake");
}

function categoryThemeDotClass(theme) {
  const normalized = String(theme || "").toLowerCase();
  switch (normalized) {
    case "red":
      return "bg-red-500";
    case "amber":
      return "bg-amber-400";
    case "orange":
      return "bg-orange-500";
    case "teal":
      return "bg-teal-500";
    case "blue":
      return "bg-blue-500";
    case "indigo":
      return "bg-indigo-500";
    case "pink":
      return "bg-pink-500";
    case "emerald":
      return "bg-emerald-500";
    default:
      return "bg-slate-500";
  }
}

export default function MenuPage() {
  const { cafeSlug: rawCafeSlug } = useParams();
  const cafeSlug = normalizeCafeSlug(rawCafeSlug);
  const validCafe = isValidCafeSlug(cafeSlug);
  const activeCafeSlug = validCafe ? cafeSlug : DEFAULT_CAFE_SLUG;
  const cafe = getCafeConfig(activeCafeSlug);

  const {
    addItem,
    getCafeCount,
    getCafeSubtotal
  } = useCart();
  const navigate = useNavigate();
  const menuTileBackgroundUrl = resolveAssetUrl("/asset/woodboard.jpg", IMAGE_BASE_URL);

  const [menu, setMenu] = useState({ categories: [], items: [], extras: [] });
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [customizingItem, setCustomizingItem] = useState(null);
  const [selectedExtraIds, setSelectedExtraIds] = useState([]);
  const [cartToast, setCartToast] = useState(null);
  const itemsSectionRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    setSelectedCategory("all");

    fetchMenu(activeCafeSlug)
      .then((data) => {
        if (mounted) {
          setMenu({
            categories: data.categories || [],
            items: data.items || [],
            extras: data.extras || []
          });
        }
      })
      .catch((_error) => {
        if (mounted) {
          setError("Unable to load menu right now.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [activeCafeSlug]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") {
      return menu.items;
    }

    return menu.items.filter((item) => String(item.category_id) === String(selectedCategory));
  }, [menu.items, selectedCategory]);

  const groupedCategories = useMemo(() => {
    const groups = new Map();

    [...menu.categories]
      .sort((a, b) => {
        const orderDiff = Number(a.display_order || 0) - Number(b.display_order || 0);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        return String(a.name || "").localeCompare(String(b.name || ""));
      })
      .forEach((category) => {
        const groupName = String(category.group_name || "Menu");
        if (!groups.has(groupName)) {
          groups.set(groupName, []);
        }
        groups.get(groupName).push(category);
      });

    return [...groups.entries()];
  }, [menu.categories]);

  const selectedExtras = useMemo(() => {
    if (!customizingItem) {
      return [];
    }

    return (customizingItem.extras || []).filter((extra) => selectedExtraIds.includes(Number(extra.id)));
  }, [customizingItem, selectedExtraIds]);

  const extrasTotal = selectedExtras.reduce((sum, extra) => sum + Number(extra.price), 0);

  const openCustomizeModal = (item) => {
    setCustomizingItem(item);
    setSelectedExtraIds([]);
  };

  const selectCategory = (categoryId) => {
    setSelectedCategory(categoryId);

    if (typeof window === "undefined" || window.innerWidth >= 1024) {
      return;
    }

    window.setTimeout(() => {
      itemsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const showAddedToCart = (itemName) => {
    setCartToast({
      itemName,
      key: Date.now()
    });
  };

  const quickAddItem = (item) => {
    addItem({
      id: item.id,
      name: item.name,
      price: Number(item.price),
      image: item.image,
      selectedExtras: []
    }, activeCafeSlug);

    showAddedToCart(item.name);
  };

  const toggleExtra = (extraId) => {
    setSelectedExtraIds((current) => (
      current.includes(extraId)
        ? current.filter((id) => id !== extraId)
        : [...current, extraId]
    ));
  };

  const addCustomizedItem = () => {
    if (!customizingItem) {
      return;
    }

    addItem({
      id: customizingItem.id,
      name: customizingItem.name,
      price: Number(customizingItem.price),
      image: customizingItem.image,
      selectedExtras: selectedExtras.map((extra) => ({
        extraId: Number(extra.id),
        name: extra.name,
        price: Number(extra.price)
      }))
    }, activeCafeSlug);

    showAddedToCart(customizingItem.name);
    setCustomizingItem(null);
    setSelectedExtraIds([]);
  };

  const proceedToCheckout = () => {
    setCartToast(null);
    navigate(`/${activeCafeSlug}/cart`);
  };

  const cartCount = getCafeCount(activeCafeSlug);
  const cartSubtotal = getCafeSubtotal(activeCafeSlug);

  if (!validCafe) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <section className="space-y-6">
        <div className="relative overflow-hidden rounded-[1.75rem] p-4 text-white shadow-panel md:p-5">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `url('${menuTileBackgroundUrl}')`,
              backgroundPosition: "center",
              backgroundSize: "cover",
              backgroundRepeat: "no-repeat"
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-slate-950/68" />

          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">Tap To Order</p>
              <h1 className="mt-1 text-2xl font-black uppercase text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.95)] md:text-3xl">{cafe?.label} Menu</h1>
              <p className="mt-1 text-sm text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] md:text-[15px]">
                Place your order in seconds, and pick your food.
              </p>
            </div>

            <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:max-w-xs sm:items-end">
              <Link
                to="/"
                className="rounded-2xl border border-white/70 bg-white/28 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-[0_2px_10px_rgba(0,0,0,0.45)] transition hover:bg-white/36"
              >
                Change Cafe
              </Link>
              <div className="w-full rounded-xl border border-amber-200/70 bg-amber-500/26 px-3 py-2 text-amber-50 shadow-[0_2px_10px_rgba(0,0,0,0.42)] sm:max-w-xs">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Allergy Caution</p>
                <p className="mt-0.5 text-[11px] text-amber-50 md:text-xs">
                  Please check ingredients and allergy information with staff before ordering.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[260px,1fr]">
          <aside className="premium-surface h-fit rounded-3xl p-4 shadow-soft lg:sticky lg:top-24">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] opacity-70">Categories</p>

            <button
              type="button"
              className={`mb-3 w-full rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${selectedCategory === "all" ? "bg-diner-red text-white shadow-soft" : "bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"}`}
              onClick={() => selectCategory("all")}
            >
              All
            </button>

            <div className="space-y-4">
              {groupedCategories.map(([groupName, categories]) => (
                <div key={groupName} className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-65">{groupName}</p>
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        className={`flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left text-sm font-semibold transition ${String(selectedCategory) === String(category.id) ? "bg-diner-red text-white shadow-soft" : "bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"}`}
                        onClick={() => selectCategory(category.id)}
                      >
                        <span className="truncate">{category.name}</span>
                        <span className={`h-2.5 w-2.5 rounded-full ${categoryThemeDotClass(category.theme)}`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <div ref={itemsSectionRef} className="space-y-4">
            {loading && <p className="text-sm">Loading menu...</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}

            {!loading && !error && (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((item, index) => (
                  <div key={item.id} style={{ animationDelay: `${Math.min(index, 6) * 80}ms` }} className="animate-rise-in">
                    <MenuItemCard
                      item={item}
                      imageBaseUrl={IMAGE_BASE_URL}
                      placeholderLabel={cafe?.label || "Menu Item"}
                      allowCustomization={canCustomizeItem(item) && !!item.extras?.length}
                      onCustomize={openCustomizeModal}
                      onQuickAdd={quickAddItem}
                    />
                  </div>
                ))}
                {!filteredItems.length && (
                  <p className="premium-surface rounded-2xl p-4 text-sm">No items in this category yet.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {customizingItem && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4">
          <div className="premium-surface animate-pop-in w-full max-w-lg space-y-4 rounded-3xl p-6 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black uppercase">{customizingItem.name}</h2>
                <p className="text-sm opacity-70">Base price: {formatCurrency(customizingItem.price)}</p>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingItem(null)}
                className="rounded-xl bg-diner-ink px-3 py-2 text-sm font-bold text-white"
              >
                Close
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wide">Select Extras</h3>

              {!!customizingItem.extras?.length && customizingItem.extras.map((extra) => {
                const checked = selectedExtraIds.includes(Number(extra.id));
                return (
                  <label key={extra.id} className="flex cursor-pointer items-center justify-between rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/10">
                    <span>{extra.name}</span>
                    <span className="flex items-center gap-3">
                      <span className="font-semibold">+{formatCurrency(extra.price)}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExtra(Number(extra.id))}
                        className="h-5 w-5"
                      />
                    </span>
                  </label>
                );
              })}

              {!customizingItem.extras?.length && (
                <p className="rounded-xl bg-black/5 p-3 text-sm dark:bg-white/10">No extras available for this item.</p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-black/5 px-4 py-3 text-sm font-bold dark:bg-white/10">
              <span>Total per item</span>
              <span>{formatCurrency(Number(customizingItem.price) + extrasTotal)}</span>
            </div>

            <button
              type="button"
              onClick={addCustomizedItem}
              className="shimmer-btn w-full rounded-2xl bg-diner-red px-4 py-3 text-base font-bold text-white"
            >
              Add to Cart
            </button>
          </div>
        </div>
      )}

      {cartToast && (
        <div key={cartToast.key} className="fixed bottom-5 left-1/2 z-50 w-[min(96vw,760px)] -translate-x-1/2 animate-toast-in rounded-[2rem] premium-glass px-5 py-5 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-diner-teal">Item Added To Cart</p>
              <p className="text-base font-black md:text-lg">{cartToast.itemName}</p>
              <p className="mt-1 text-sm font-semibold opacity-80">
                {cartCount} item{cartCount === 1 ? "" : "s"} in cart | Subtotal {formatCurrency(cartSubtotal)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={proceedToCheckout}
                className="shimmer-btn rounded-2xl bg-diner-teal px-6 py-3 text-base font-black uppercase tracking-[0.04em] text-white transition duration-200 hover:brightness-95"
              >
                Proceed To Checkout
              </button>
              <button
                type="button"
                onClick={() => setCartToast(null)}
                className="rounded-xl bg-black/10 px-3 py-2 text-xs font-bold uppercase tracking-wide transition hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
