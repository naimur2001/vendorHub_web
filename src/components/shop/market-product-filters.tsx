"use client";

import { ChevronDown, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useTransition } from "react";
import { useRouter } from "@/i18n/routing";
import { MARKET_SORTS, type MarketSort } from "@/lib/market-sorts";
import { cn } from "@/lib/utils";

type ShopOption = { id: string; name: string };
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

/** Shop picker (all shops, grouped by floor) and sort order for a market's products. Both live in the URL. */
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

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end" aria-busy={pending}>
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor={`${id}-shop`} className="type-body-medium text-ink">
          {t("shopPick")}
        </label>
        <div className="relative">
          <Store className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-highlight" aria-hidden />
          <select id={`${id}-shop`} value={shopId ?? ""} onChange={(e) => go({ shop: e.target.value || null })} disabled={pending} className={cn(select, "pl-12")}>
            <option value="">{t("allShops", { count: total })}</option>
            {floors.map(({ floor, shops }) => (
              <optgroup key={floor ?? "other"} label={floor ?? t("otherFloor")}>
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        </div>
      </div>
      <div className="flex flex-col gap-1.5 sm:w-56">
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
