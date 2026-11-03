import { ChevronRight, Package, Star } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { VerificationSeal } from "@/components/brand/verification-seal";
import { Link } from "@/i18n/routing";
import { searchShops, type ShopSearchItem } from "@/lib/api/shop-search";
import { safeMediaUrl, shopPlace } from "@/lib/api/storefront";

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

function ShopResultCard({ shop }: { shop: ShopSearchItem }) {
  const t = useTranslations("ShopSearch");
  const photo = safeMediaUrl(shop.coverPhoto?.url) ?? safeMediaUrl(shop.logoUrl);
  const place = [shopPlace(shop.levelFloor, shop.shopNumber), shop.market?.name].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/shops/${shop.slug}`}
      className="group flex h-full items-center gap-3 rounded-md border border-line bg-card p-3 shadow-card transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    >
      <span className="relative flex h-16 w-14 shrink-0 items-end justify-center overflow-hidden rounded-t-full rounded-b-sm bg-brand pb-2">
        {photo ? (
          <Image src={photo} alt="" fill unoptimized sizes="56px" className="object-cover" />
        ) : (
          <span className="font-heading text-[1rem] text-primary-foreground" aria-hidden>
            {initials(shop.name)}
          </span>
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="type-body-medium truncate text-ink group-hover:text-brand">{shop.name}</span>
          {shop.verificationLevel !== "UNVERIFIED" && <VerificationSeal level={shop.verificationLevel} size="sm" />}
        </div>
        {place && <span className="type-caption truncate text-ink-muted">{place}</span>}
        <span className="type-caption flex items-center gap-3 text-ink-secondary">
          <span className="flex items-center gap-1">
            <Star className="size-3.5 text-highlight" aria-hidden />
            {shop.ratingAverage !== null
              ? t("rating", { average: shop.ratingAverage.toFixed(1), count: shop.reviewCount })
              : t("noReviews")}
          </span>
          <span className="flex items-center gap-1">
            <Package className="size-3.5 text-highlight" aria-hidden />
            {t("products", { count: shop.productCount })}
          </span>
        </span>
      </div>

      <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
    </Link>
  );
}

/**
 * Shops whose name matches the search text, shown above the products.
 * Silent on errors or no matches: the product results still show.
 */
export async function ShopResults({ q, marketId }: { q: string; marketId?: string }) {
  const t = await getTranslations("ShopSearch");

  let result;
  try {
    result = await searchShops({ q, marketId, limit: 6 });
  } catch {
    return null;
  }

  const shops = result.data;
  if (shops.length === 0) return null;
  const total = result.meta?.pagination?.total ?? shops.length;

  return (
    <section aria-labelledby="shop-results-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h2 id="shop-results-heading" className="type-h3 break-words text-ink">
          {t("title", { q })}
        </h2>
        <span className="type-caption shrink-0 text-ink-muted">{t("count", { count: total })}</span>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {shops.map((shop) => (
          <li key={shop.id} className="w-72 shrink-0 snap-start md:w-auto">
            <ShopResultCard shop={shop} />
          </li>
        ))}
      </ul>
    </section>
  );
}