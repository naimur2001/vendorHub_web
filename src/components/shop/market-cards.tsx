import { ChevronRight } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Arcade } from "@/components/brand/arcade";
import { VerificationSeal } from "@/components/brand/verification-seal";
import { Link } from "@/i18n/routing";
import type { Market } from "@/lib/api/shops";
import { safeMediaUrl, shopPlace, type MarketShop } from "@/lib/api/storefront";

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

/** One market on /markets. */
export function MarketCard({ market }: { market: Market }) {
  const t = useTranslations("Market");
  return (
    <Link
      href={`/markets/${market.slug}`}
      className="group flex flex-col gap-3 rounded-md border border-line bg-card p-5 shadow-card transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    >
      <Arcade className="h-14 w-auto self-start" />
      <div className="flex flex-col gap-1">
        <h2 className="type-h3 text-ink group-hover:text-brand">{market.name}</h2>
        {(market.address || market.city) && (
          <p className="type-body text-ink-secondary">{[market.address, market.city].filter(Boolean).join(", ")}</p>
        )}
      </div>
      <p className="type-body-medium mt-auto flex items-center justify-between border-t border-line pt-3 text-ink">
        {t("shopCount", { count: market.shopCount })}
        <ChevronRight className="size-5 text-ink-muted" aria-hidden />
      </p>
    </Link>
  );
}

/** One shop inside a market page. */
export function MarketShopCard({ shop }: { shop: MarketShop }) {
  const photo = safeMediaUrl(shop.coverPhoto?.url) ?? safeMediaUrl(shop.logoUrl);
  const place = shopPlace(null, shop.shopNumber);

  return (
    <Link
      href={`/shops/${shop.slug}`}
      className="group flex items-center gap-4 rounded-md border border-line bg-card p-3 transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
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
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="type-body-medium truncate text-ink group-hover:text-brand">{shop.name}</p>
          {shop.verificationLevel !== "UNVERIFIED" && <VerificationSeal level={shop.verificationLevel} size="sm" />}
        </div>
        {place && <p className="type-caption text-ink-muted">{place}</p>}
      </div>
      <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
    </Link>
  );
}

/**
 * Home page: a market as a tall arch doorway (bordeaux arch, gold inner outline, gold keystone).
 * Hover / focus: the doorway deepens and the gold outline lights up, like light through an entrance.
 */
export function MarketDoor({ market }: { market: Market }) {
  const t = useTranslations("Market");
  return (
    <Link
      href={`/markets/${market.slug}`}
      aria-label={`${t("enterMarket", { market: market.name })}, ${t("shopCount", { count: market.shopCount })}`}
      className="group relative flex aspect-[3/4] w-44 shrink-0 snap-start flex-col items-center justify-end overflow-hidden rounded-t-full rounded-b-sm bg-brand px-4 pb-6 text-center shadow-card transition-colors duration-300 hover:bg-brand-alt focus-visible:bg-brand-alt focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none md:w-auto"
    >
      {/* Inner doorway: a thin gold arch that lights up on hover / focus */}
      <span
        aria-hidden
        className="absolute inset-3 rounded-t-full rounded-b-[1px] border border-gold/50 transition-[border-color,box-shadow] duration-300 group-hover:border-gold group-hover:shadow-[inset_0_0_32px_rgba(176,141,87,0.35)] group-focus-visible:border-gold"
      />
      {/* Keystone at the top of the arch */}
      <span aria-hidden className="absolute top-1.5 left-1/2 h-4 w-3.5 -translate-x-1/2 bg-gold [clip-path:polygon(0_0,100%_0,78%_100%,22%_100%)]" />

      <span className="relative font-heading text-[1.375rem] leading-tight text-primary-foreground">{market.name}</span>
      {market.city && <span className="type-caption relative mt-1 text-primary-foreground/75">{market.city}</span>}
      <span className="type-caption relative mt-3 rounded-full border border-gold/60 px-3 py-1 text-primary-foreground">
        {t("shopCount", { count: market.shopCount })}
      </span>
    </Link>
  );
}