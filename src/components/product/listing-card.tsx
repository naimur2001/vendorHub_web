import { ChevronRight, MapPin, Store, Truck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { PriceTicket } from "@/components/brand/price-ticket";
import { VerificationSeal } from "@/components/brand/verification-seal";
import { AddToCartButton } from "@/components/cart/add-to-cart";
import { AvailabilityBadge } from "@/components/catalog/availability-badge";
import { MakeOfferButton } from "@/components/bargain/offer-sheet";
import { Link } from "@/i18n/routing";
import type { Listing, ListingShop } from "@/lib/api/catalog";
import { cn } from "@/lib/utils";

/** "Level 3 · Shop 42 · Jamuna Future Park" (adds "Shop" to a bare number). */
export function shopLocation(shop: ListingShop): string {
  const number = shop.shopNumber ? (/^shop\b/i.test(shop.shopNumber) ? shop.shopNumber : `Shop ${shop.shopNumber}`) : null;
  return [shop.levelFloor, number, shop.market?.name].filter(Boolean).join(" · ") || shop.addressLine;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

/** Small arch with the shop's initials (logos come with the storefront step). */
function ShopMark({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-end justify-center rounded-t-full rounded-b-sm bg-brand pb-1 font-heading text-primary-foreground",
        size === "md" ? "h-12 w-10 text-[0.9375rem]" : "h-10 w-8 text-[0.8125rem]",
      )}
    >
      {initials(name)}
    </span>
  );
}

function ServiceLine({ on, icon: Icon, yes, no }: { on: boolean; icon: typeof Truck; yes: string; no: string }) {
  return (
    <li className={cn("type-body flex items-center gap-2", on ? "text-ink" : "text-ink-muted line-through decoration-1")}>
      <Icon className={cn("size-4 shrink-0", on ? "text-success-ink" : "text-ink-disabled")} aria-hidden />
      {on ? yes : no}
    </li>
  );
}

/** The selected shop's offer: the main card next to the photos (spec: ShopListingSelectorCard). */
export function SelectedListingCard({
  listing,
  otherCount,
  productSlug,
}: {
  listing: Listing;
  otherCount: number;
  productSlug: string;
}) {
  const t = useTranslations("Product");
  // const tCart = useTranslations("Cart");
  const format = useFormatter();
  const { shop } = listing;
  const outOfStock = listing.availability === "OUT_OF_STOCK";

  const trust: string[] = [
    shop.rating.average !== null
      ? t("rating", { average: shop.rating.average.toFixed(1), count: shop.rating.count })
      : t("noRating"),
  ];
  if (shop.avgResponseMins) trust.push(t("responds", { minutes: shop.avgResponseMins }));
  if (shop.lastAuditedAt) {
    trust.push(t("audited", { date: format.dateTime(new Date(shop.lastAuditedAt), { month: "short", year: "numeric" }) }));
  }

  return (
    <section aria-labelledby="seller-heading" className="flex flex-col gap-4 rounded-md border border-line bg-card p-5 shadow-card">
      <div className="flex items-start gap-3">
        <ShopMark name={shop.name} />
        <div className="min-w-0 flex-1">
          <p className="type-caption text-ink-muted">{t("soldBy")}</p>
          <h2 id="seller-heading" className="type-h3 text-ink">
            <Link href={`/shops/${shop.slug}`} className="rounded-sm hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
              {shop.name}
            </Link>
          </h2>
          <p className="type-caption mt-1 inline-flex items-center gap-1 rounded-sm bg-info-soft px-2 py-0.5 text-verified">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {shopLocation(shop)}
          </p>
        </div>
        {shop.verificationLevel !== "UNVERIFIED" && <VerificationSeal level={shop.verificationLevel} size="lg" />}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <PriceTicket amount={listing.price} msrp={null} size="lg" />
        {listing.discountPercent !== null && listing.discountPercent > 0 && (
          <span className="type-caption text-success-ink">{t("saveVsMsrp", { percent: listing.discountPercent })}</span>
        )}
      </div>

      <AvailabilityBadge value={listing.availability} className="self-start" />

      <ul className="flex flex-col gap-1.5">
        <ServiceLine on={shop.supportsDelivery} icon={Truck} yes={t("delivery")} no={t("noDelivery")} />
        <ServiceLine on={shop.supportsPickup} icon={Store} yes={t("pickup")} no={t("noPickup")} />
      </ul>

      <p className="type-caption text-ink-secondary">{trust.join(" · ")}</p>

      {otherCount > 0 && (
        <a href="#other-shops" className="type-body-medium inline-flex items-center gap-1 self-start text-brand underline-offset-4 hover:underline">
          {t("compareLink", { count: otherCount })}
          <ChevronRight className="size-4" aria-hidden />
        </a>
      )}

        <div className="flex flex-col gap-2 border-t border-line pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <AddToCartButton listingId={listing.id} productSlug={productSlug} disabled={outOfStock} />
          </div>
          {listing.bargainEnabled && !outOfStock && (
            <div className="flex-1">
              <MakeOfferButton listingId={listing.id} productSlug={productSlug} />
            </div>
          )}
        </div>
        {outOfStock && <p className="type-caption text-ink-muted">{t("outOfStock")}</p>}
      </div>
    </section>
  );
}

/** One other shop in the comparison list; tapping it makes it the selected offer. */
export function OtherShopRow({ slug, listing, onSelect }: { slug: string; listing: Listing; onSelect?: () => void }) {
  const { shop } = listing;
  return (
    <Link
      href={`/products/${slug}?listing=${listing.id}`}
      onClick={onSelect}
      className="flex items-center gap-3 rounded-md border border-line bg-card p-3 hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    >
      <ShopMark name={shop.name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="type-body-medium truncate text-ink">{shop.name}</p>
          {shop.verificationLevel !== "UNVERIFIED" && <VerificationSeal level={shop.verificationLevel} size="sm" />}
        </div>
        <p className="type-caption truncate text-ink-muted">{shopLocation(shop)}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <AvailabilityBadge value={listing.availability} />
          {shop.supportsDelivery && <Truck className="size-4 text-ink-muted" aria-hidden />}
          {shop.supportsPickup && <Store className="size-4 text-ink-muted" aria-hidden />}
        </div>
      </div>
      <PriceTicket amount={listing.price} />
      <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
    </Link>
  );
}