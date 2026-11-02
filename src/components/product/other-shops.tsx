"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { OtherShopRow } from "@/components/product/listing-card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Listing } from "@/lib/api/catalog";

const SHOWN_ON_PAGE = 3;

const LEVEL_RANK: Record<Listing["shop"]["verificationLevel"], number> = {
  UNVERIFIED: 0,
  DOCUMENTS_VERIFIED: 1,
  BUSINESS_VERIFIED: 2,
  PHYSICAL_SHOP_VERIFIED: 3,
  TRUSTED_VENDOR: 4,
};

type SortKey = "price" | "verified" | "market";

function sortListings(listings: Listing[], key: SortKey): Listing[] {
  const copy = [...listings];
  if (key === "price") return copy.sort((a, b) => a.price - b.price);
  if (key === "verified") {
    return copy.sort((a, b) => LEVEL_RANK[b.shop.verificationLevel] - LEVEL_RANK[a.shop.verificationLevel] || a.price - b.price);
  }
  return copy.sort((a, b) => (a.shop.market?.name ?? "~").localeCompare(b.shop.market?.name ?? "~") || a.price - b.price);
}

/** Other shops: up to 3 on the page, all of them (sortable) in a panel when there are more. */
export function OtherShops({ slug, listings }: { slug: string; listings: Listing[] }) {
  const t = useTranslations("Product");
  const sortId = useId();
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("price");
  const sorted = useMemo(() => sortListings(listings, sort), [listings, sort]);

  if (listings.length === 0) return null;
  const cheapestFirst = sortListings(listings, "price");

  return (
    <section id="other-shops" aria-labelledby="other-shops-heading" className="flex scroll-mt-24 flex-col gap-3">
      <h2 id="other-shops-heading" className="type-h3 text-ink">
        {t("otherShopsTitle", { count: listings.length })}
      </h2>

      <ul className="flex flex-col gap-2">
        {cheapestFirst.slice(0, SHOWN_ON_PAGE).map((listing) => (
          <li key={listing.id}>
            <OtherShopRow slug={slug} listing={listing} />
          </li>
        ))}
      </ul>

      {listings.length > SHOWN_ON_PAGE && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="type-body-medium inline-flex h-11 items-center gap-1 self-start rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
            {t("compareAll", { count: listings.length })}
            <ChevronRight className="size-4" aria-hidden />
          </SheetTrigger>
          <SheetContent side="right" className="w-full overflow-y-auto bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="type-h3 text-ink">{t("compareTitle")}</SheetTitle>
              <SheetDescription className="type-body text-ink-secondary">{t("compareText")}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-3 px-4">
              <div className="flex items-center gap-2">
                <label htmlFor={sortId} className="type-body-medium text-ink">
                  {t("sortBy")}
                </label>
                <select
                  id={sortId}
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="type-body h-11 flex-1 rounded-md border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
                >
                  <option value="price">{t("sortPrice")}</option>
                  <option value="verified">{t("sortVerified")}</option>
                  <option value="market">{t("sortMarket")}</option>
                </select>
              </div>
              <ul className="flex flex-col gap-2">
                {sorted.map((listing) => (
                  <li key={listing.id}>
                    <OtherShopRow slug={slug} listing={listing} onSelect={() => setOpen(false)} />
                  </li>
                ))}
              </ul>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </section>
  );
}