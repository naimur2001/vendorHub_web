"use client";

import { ChevronDown, ChevronRight, LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useTransition } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { MARKET_SORTS, type MarketSort } from "@/lib/market-sorts";
import { cn } from "@/lib/utils";

type Props = {
  marketSlug: string;
  shopCount: number;
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
 * "All shops" (opens the market's shop directory) and the sort order of the products (kept in the URL).
 */
export function MarketProductFilters({ marketSlug, shopCount, shopId, sort }: Props) {
  const t = useTranslations("Market");
  const tSearch = useTranslations("Search");
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();

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
      <div className="flex flex-col gap-2">
        <p className="type-body-medium text-ink">{t("shopPick")}</p>
        {/* Opens the market's shop directory: every shop, by floor, with a search */}
        <Link
          href={`/markets/${marketSlug}/shops`}
          className={cn(chip, "group self-start border-brand bg-brand text-primary-foreground hover:bg-brand-alt")}
        >
          <LayoutGrid className="size-4" aria-hidden />
          {t("allShops", { count: shopCount })}
          <ChevronRight className="size-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
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
