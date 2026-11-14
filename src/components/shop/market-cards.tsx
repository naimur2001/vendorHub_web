import { ChevronRight } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Arcade } from "@/components/brand/arcade";
import { VerificationSeal } from "@/components/brand/verification-seal";
import { CenterStage } from "@/components/motion/reveal";
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
/** One market on /markets: photo on top (or the small arcade). */
export function MarketCard({ market }: { market: Market }) {
  const t = useTranslations("Market");
  const photo = safeMediaUrl(market.image?.thumbUrl ?? null);
  return (
    <Link
      href={`/markets/${market.slug}`}
      className="group flex flex-col overflow-hidden rounded-md border border-line bg-card shadow-card transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    >
      {photo ? (
        <span className="relative aspect-[16/9] w-full bg-brand">
          <Image src={photo} alt="" fill unoptimized sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
        </span>
      ) : (
        <span className="px-5 pt-5">
          <Arcade className="h-14 w-auto" />
        </span>
      )}
      <div className="flex flex-1 flex-col gap-3 p-5">
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
      </div>
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
 * Home page: a market as a tall arch doorway. With a photo, the photo fills the doorway
 * under a dark fade (text stays readable); without one, the bordeaux door.
 * Hover / focus: the arch lifts, the photo slowly zooms, a gold outline sweeps up around the
 * arch edge and the name slides up (CSS: .door in globals.css). On touch screens the same plays
 * while the door is in the middle of the screen (CenterStage).
 */
export function MarketDoor({ market }: { market: Market }) {
  const t = useTranslations("Market");
  const photo = safeMediaUrl(market.image?.thumbUrl ?? null);
  return (
    <CenterStage className="aspect-[3/4] w-44 shrink-0 snap-start md:w-auto">
      <Link
        href={`/markets/${market.slug}`}
        aria-label={`${t("enterMarket", { market: market.name })}, ${t("shopCount", { count: market.shopCount })}`}
        className="door relative flex size-full flex-col items-center justify-end overflow-hidden rounded-t-full rounded-b-sm bg-brand px-4 pb-6 text-center shadow-card focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      >
        {photo && (
          <>
            <Image src={photo} alt="" fill unoptimized sizes="(min-width: 768px) 25vw, 11rem" className="door-photo object-cover" />
            <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/35 to-ink/10" />
          </>
        )}
        {/* Resting outline, and the bright one that sweeps up over it */}
        <span aria-hidden className="absolute inset-3 rounded-t-full rounded-b-[1px] border border-gold/50" />
        <span
          aria-hidden
          className="door-sweep absolute inset-3 rounded-t-full rounded-b-[1px] border-2 border-gold shadow-[inset_0_0_32px_rgba(176,141,87,0.35)]"
        />
        <span aria-hidden className="absolute top-1.5 left-1/2 h-4 w-3.5 -translate-x-1/2 bg-gold [clip-path:polygon(0_0,100%_0,78%_100%,22%_100%)]" />

        <span className="door-name relative flex flex-col items-center">
          <span className="font-heading text-[1.375rem] leading-tight text-primary-foreground">{market.name}</span>
          {market.city && <span className="type-caption mt-1 text-primary-foreground/80">{market.city}</span>}
        </span>
        <span className="type-caption relative mt-3 rounded-full border border-gold/60 bg-ink/30 px-3 py-1 text-primary-foreground">
          {t("shopCount", { count: market.shopCount })}
        </span>
      </Link>
    </CenterStage>
  );
}