"use client";

import { ChevronDown, ChevronRight, LayoutGrid, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useTransition } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { MARKET_SORTS, type MarketSort } from "@/lib/market-sorts";
import { cn } from "@/lib/utils";

type ShopOption = { id: string; name: string; slug: string };
type Props = {
  marketSlug: string;
  floors: { floor: string | null; shops: ShopOption[] }[]; // shops grouped by floor, in floor order
  shopId: string | null;
  sort: MarketSort;
};

const SORT_LABEL: Record<MarketSort, string> = {
  newest: "sortNewest",
  popular: "sortPopular",
  price_asc: "sortPriceAsc",
  price_desc: "sortPriceDesc",
};

const select =
  "type-body-medium h-12 w-full appearance-none rounded-full border border-line-strong bg-card pr-10 text-ink shadow-card hover:border-brand focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none disabled:opacity-60";

/**
 * The market's shops as buttons ("All shops" shows every product here; a shop button opens that shop's page),
 * and the sort order of the products (kept in the URL).
 */
export function MarketProductFilters({ marketSlug, floors, shopId, sort }: Props) {
  const t = useTranslations("Market");
  const tSearch = useTranslations("Search");
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const total = floors.reduce((sum, f) => sum + f.shops.length, 0);

  function go(next: { shop?: string | null; sort?: MarketSort }) {
    const params = new URLSearchParams();
    const shop = next.shop === undefined ? shopId : next.shop;
    const order = next.sort ?? sort;
    if (shop) params.set("shop", shop);
    if (order !== "newest") params.set("sort", order);
    const query = params.toString();
    // Page 1 again after any change; stay where the products are.
    startTransition(() => router.push(`/markets/${marketSlug}${query ? `?${query}` : ""}#products`, { scroll: false }));
  }

  const chip =
    "type-body-medium inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 shadow-card focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none";

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <nav aria-label={t("shopPick")} className="flex flex-col gap-2">
        <p className="type-body-medium text-ink">{t("shopPick")}</p>
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href={`/markets/${marketSlug}${sort !== "newest" ? `?sort=${sort}` : ""}#products`}
              scroll={false}
              aria-current={shopId ? undefined : "page"}
              className={cn(chip, shopId ? "border-line-strong bg-card text-ink hover:border-brand" : "border-brand bg-brand text-primary-foreground")}
            >
              <LayoutGrid className="size-4" aria-hidden />
              {t("allShops", { count: total })}
            </Link>
          </li>
          {floors.flatMap(({ floor, shops }) =>
            shops.map((shop) => (
              <li key={shop.id}>
                {/* Opens the shop's own page */}
                <Link href={`/shops/${encodeURIComponent(shop.slug)}`} className={cn(chip, "group border-line-strong bg-card text-ink hover:border-brand hover:text-brand")}>
                  <Store className="size-4 text-highlight" aria-hidden />
                  <span>{shop.name}</span>
                  {floor && <span className="type-caption text-ink-muted">· {floor}</span>}
                  <ChevronRight className="size-4 text-ink-muted motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            )),
          )}
        </ul>
      </nav>
      <div className="flex flex-col gap-1.5 sm:w-64">
        <label htmlFor={`${id}-sort`} className="type-body-medium text-ink">
          {tSearch("sort")}
        </label>
        <div className="relative">
          <select id={`${id}-sort`} value={sort} onChange={(e) => go({ sort: e.target.value as MarketSort })} disabled={pending} className={cn(select, "pl-5")}>
            {MARKET_SORTS.map((s) => (
              <option key={s} value={s}>
                {tSearch(SORT_LABEL[s])}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        </div>
      </div>
    </div>
  );
}
