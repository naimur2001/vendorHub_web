"use client";

import { ChevronRight, LoaderCircle, LocateFixed } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { OtherShopRow } from "@/components/product/listing-card";
import { FormModal } from "@/components/ui/form-modal";
import { getListingDistances, type Listing } from "@/lib/api/catalog";

const SHOWN_ON_PAGE = 3;

const LEVEL_RANK: Record<Listing["shop"]["verificationLevel"], number> = {
  UNVERIFIED: 0,
  DOCUMENTS_VERIFIED: 1,
  BUSINESS_VERIFIED: 2,
  PHYSICAL_SHOP_VERIFIED: 3,
  TRUSTED_VENDOR: 4,
};

type SortKey = "price" | "verified" | "market" | "nearest";
type Distances = Record<string, number | null>;

function sortListings(listings: Listing[], key: SortKey, distances?: Distances): Listing[] {
  const copy = [...listings];
  if (key === "nearest" && distances) {
    const d = (l: Listing) => distances[l.id] ?? Number.POSITIVE_INFINITY;
    return copy.sort((a, b) => d(a) - d(b) || a.price - b.price);
  }
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
  const [distances, setDistances] = useState<Distances | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  // Only when the visitor taps: browser location -> distances from our API (nothing is stored).
  function showDistances() {
    if (!("geolocation" in navigator)) return setLocError(t("locationUnavailable"));
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          setDistances(await getListingDistances(slug, pos.coords.latitude, pos.coords.longitude));
          setSort("nearest");
        } catch {
          setLocError(t("distanceError"));
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setLocError(err.code === err.PERMISSION_DENIED ? t("locationDenied") : t("locationUnavailable"));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }
  const sorted = useMemo(() => sortListings(listings, sort, distances ?? undefined), [listings, sort, distances]);

  if (listings.length === 0) return null;
  const cheapestFirst = sortListings(listings, distances ? "nearest" : "price", distances ?? undefined);

  return (
    <section id="other-shops" aria-labelledby="other-shops-heading" className="flex scroll-mt-24 flex-col gap-3">
      <h2 id="other-shops-heading" className="type-h3 text-ink">
        {t("otherShopsTitle", { count: listings.length })}
      </h2>
      {!distances && (
        <button
          type="button"
          onClick={showDistances}
          disabled={locating}
          aria-busy={locating}
          className="type-body-medium inline-flex h-11 items-center gap-2 self-start rounded-full border border-line bg-card px-4 text-ink-secondary hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60"
        >
          {locating ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden /> : <LocateFixed className="size-4" aria-hidden />}
          {t("showDistance")}
        </button>
      )}
      {distances && <p className="type-caption text-ink-muted">{t("nearestFirst")}</p>}
      {locError && (
        <p role="alert" className="type-caption text-error">
          {locError}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {cheapestFirst.slice(0, SHOWN_ON_PAGE).map((listing) => (
          <li key={listing.id}>
            <OtherShopRow slug={slug} listing={listing} distanceKm={distances?.[listing.id]} />
          </li>
        ))}
      </ul>

      {listings.length > SHOWN_ON_PAGE && (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="type-body-medium inline-flex h-11 items-center gap-1 self-start rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            {t("compareAll", { count: listings.length })}
            <ChevronRight className="size-4" aria-hidden />
          </button>
          <FormModal open={open} onClose={() => setOpen(false)} title={t("compareTitle")} description={t("compareText")} size="sm:max-w-xl">
            <div className="flex flex-col gap-3">
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
                  {distances && <option value="nearest">{t("sortNearest")}</option>}
                </select>
              </div>
              <ul className="flex flex-col gap-2">
                {sorted.map((listing) => (
                  <li key={listing.id}>
                    <OtherShopRow slug={slug} listing={listing} onSelect={() => setOpen(false)} distanceKm={distances?.[listing.id]} />
                  </li>
                ))}
              </ul>
            </div>
          </FormModal>
        </>
      )}
    </section>
  );
}