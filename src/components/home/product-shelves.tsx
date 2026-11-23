import { getTranslations } from "next-intl/server";
import { ProductCard } from "@/components/catalog/product-card";
import { ShelfTabs } from "@/components/home/shelf-tabs";
import type { ProductCardData } from "@/lib/api/catalog";
import { getShelf, SHELF_KEYS as KEYS } from "@/lib/api/catalog-cache";
const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4";

/** Home page "Explore the shelves": tabs of products (trending, best sellers, best prices, bargain, premium, long-time favourites). Empty tabs are left out. */
export async function ProductShelves() {
  const t = await getTranslations("Shelves");
  const lists = await Promise.all(KEYS.map((k) => getShelf(k).catch((): ProductCardData[] => [])));
  const tabs = KEYS.map((key, i) => ({ key, products: lists[i] }))
    .filter((s) => s.products.length > 0)
    .map(({ key, products }) => ({
      key,
      label: t(`tabs.${key}`),
      panel: (
        <div className={GRID}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ),
    }));
  if (tabs.length === 0) return null; // nothing to show (or the API is down): the rest of the page still works

  return (
    <section aria-labelledby="shelves-title" className="flex flex-col gap-5">
      <div className="relative flex flex-col gap-1 pb-3">
        <h2 id="shelves-title" className="type-h2 text-ink">
          {t("title")}
        </h2>
        <p className="type-body text-ink-secondary">{t("text")}</p>
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gold" />
      </div>
      <ShelfTabs tabs={tabs} label={t("tabsLabel")} />
    </section>
  );
}
