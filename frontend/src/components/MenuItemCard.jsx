import { resolveAssetUrl } from "../services/runtimeConfig";

function formatPrice(value) {
  return `$${Number(value).toFixed(2)}`;
}

export default function MenuItemCard({
  item,
  imageBaseUrl,
  placeholderLabel = "Menu Item",
  allowCustomization,
  onCustomize,
  onQuickAdd
}) {
  const placeholderText = encodeURIComponent(placeholderLabel).replace(/%20/g, "+");
  const imageUrl = item.image
    ? resolveAssetUrl(item.image, imageBaseUrl)
    : `https://placehold.co/600x400/1f2933/fefae0?text=${placeholderText}`;

  return (
    <article className="premium-surface group overflow-hidden rounded-[1.6rem] shadow-panel transition duration-300 hover:-translate-y-1">
      <div className="relative">
        <img src={imageUrl} alt={item.name} className="h-48 w-full object-cover" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
        <span className="absolute right-3 top-3 rounded-full bg-diner-red px-3 py-1 text-sm font-bold text-white shadow-soft">
          {formatPrice(item.price)}
        </span>
      </div>

      <div className="space-y-3 p-5">
        <h3 className="text-xl font-black uppercase">{item.name}</h3>
        <p className="text-sm opacity-80">{item.description}</p>

        {allowCustomization && !!item.extras?.length && (
          <p className="inline-flex rounded-full bg-diner-teal/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-diner-teal dark:bg-diner-teal/30 dark:text-teal-100">
            {item.extras.length} extras available
          </p>
        )}

        <button
          type="button"
          className="shimmer-btn w-full rounded-2xl bg-diner-teal px-4 py-3 text-base font-bold text-white transition duration-200 hover:brightness-95 active:scale-[0.99]"
          onClick={() => (allowCustomization ? onCustomize(item) : onQuickAdd(item))}
        >
          {allowCustomization ? "Customize & Add" : "Add to Cart"}
        </button>
      </div>
    </article>
  );
}
