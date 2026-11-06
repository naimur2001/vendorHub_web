import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { ChevronRight, MapPin, Search } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { MarketShopCard } from "@/components/shop/market-cards";
import { Link } from "@/i18n/routing";
import { ApiError } from "@/lib/api/core";
import { publicGet } from "@/lib/api/public";
import type { MarketDetail, MarketShop } from "@/lib/api/storefront";
import { externalLinkProps } from "@/lib/security";
import Image from "next/image";
import { safeMediaUrl } from "@/lib/api/storefront";

type Props = { params: Promise<{ locale: string; slug: string }> };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validSlug = (slug: string) => slug.length <= 200 && SLUG.test(slug);

// Markets change rarely: cached 5 minutes. "Not found" is cached too (null), so invented names don't hit the API.
async function marketData(slug: string): Promise<MarketDetail | null> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag("markets");
  try {
    return (await publicGet<MarketDetail>(`/markets/${encodeURIComponent(slug)}`, undefined, { fresh: false })).data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err; // other errors are not cached
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!validSlug(slug)) return {};
  try {
    const market = await marketData(slug);
    if (!market) return {};
    return {
      title: market.name,
      description: [market.address, market.city].filter(Boolean).join(", ") || undefined,
    };
  } catch {
    return {};
  }
}

// "Level 2" -> 2, "Ground floor" -> 0, no floor -> last.
function floorRank(floor: string | null): number {
  if (!floor) return Number.POSITIVE_INFINITY;
  if (/ground/i.test(floor)) return 0;
  const n = floor.match(/-?\d+/);
  return n ? Number(n[0]) : 999;
}

function groupByFloor(shops: MarketShop[]): [string | null, MarketShop[]][] {
  const groups = new Map<string | null, MarketShop[]>();
  for (const shop of shops) {
    const key = shop.levelFloor?.trim() || null;
    groups.set(key, [...(groups.get(key) ?? []), shop]);
  }
  return [...groups.entries()].sort(([a], [b]) => floorRank(a) - floorRank(b) || (a ?? "").localeCompare(b ?? ""));
}

async function MarketView({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!validSlug(slug)) notFound();

  const t = await getTranslations("Market");

  let market: MarketDetail | null;
  try {
    market = await marketData(slug);
  } catch {
    return (
      <p role="alert" className="type-body py-12 text-center text-ink-secondary">
        {t("marketLoadError")}
      </p>
    );
  }
  if (!market) notFound();

  // The map link is built by us from numbers only, never from typed text.
  const hasMap = typeof market.latitude === "number" && typeof market.longitude === "number";
  const mapHref = hasMap ? `https://www.google.com/maps/search/?api=1&query=${market.latitude},${market.longitude}` : null;
  const floors = groupByFloor(market.shops);
  const banner = safeMediaUrl(market.image?.url ?? null);
  return (
    <div className="flex flex-col gap-8">
      <nav aria-label={t("breadcrumb")}>
        <ol className="type-caption flex flex-wrap items-center gap-1 text-ink-muted">
          <li>
            <Link href="/" className="hover:text-brand">
              {t("home")}
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-3.5" />
          </li>
          <li>
            <Link href="/markets" className="hover:text-brand">
              {t("allMarkets")}
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-3.5" />
          </li>
          <li aria-current="page" className="truncate text-ink-secondary">
            {market.name}
          </li>
        </ol>
      </nav>


      {banner && (
        <div className="relative -mx-4 aspect-[16/7] overflow-hidden bg-brand md:mx-0 md:rounded-lg">
          <Image src={banner} alt={market.name} fill unoptimized priority sizes="(min-width: 1280px) 1200px, 100vw" className="object-cover" />
        </div>
      )}

      
      <header className="flex flex-col gap-3 border-b border-gold pb-5">
        <h1 className="type-display text-ink">{market.name}</h1>
        {(market.address || market.city) && (
          <p className="type-body flex items-center gap-2 text-ink-secondary">
            <MapPin className="size-4 shrink-0 text-verified" aria-hidden />
            {[market.address, market.city].filter(Boolean).join(", ")}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/search?marketId=${market.id}`}
            className="type-body-medium flex h-11 items-center justify-center gap-2 rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Search className="size-4" aria-hidden />
            {t("searchHere")}
          </Link>
          {mapHref && (
            <a
              href={mapHref}
              {...externalLinkProps}
              className="type-body-medium flex h-11 items-center justify-center gap-2 rounded-sm border border-brand px-5 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <MapPin className="size-4" aria-hidden />
              {t("openMap")}
            </a>
          )}
        </div>
      </header>

      <section aria-labelledby="shops-heading" className="flex flex-col gap-6">
        <h2 id="shops-heading" className="type-h2 text-ink">
          {t("shopsTitle", { market: market.name })}
        </h2>

        {floors.length === 0 ? (
          <p className="type-body text-ink-secondary">{t("noShops")}</p>
        ) : (
          floors.map(([floor, shops]) => (
            <section key={floor ?? "other"} aria-label={floor ?? t("otherFloor")} className="flex flex-col gap-3">
              <h3 className="type-h3 border-b border-line pb-2 text-ink">{floor ?? t("otherFloor")}</h3>
              <ul className="grid gap-3 md:grid-cols-2">
                {shops.map((shop) => (
                  <li key={shop.id}>
                    <MarketShopCard shop={shop} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </section>
    </div>
  );
}

function MarketSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="h-12 w-2/3 animate-pulse rounded-sm bg-subtle" />
      <div className="h-6 w-1/2 animate-pulse rounded-sm bg-subtle" />
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-md bg-subtle" />
        ))}
      </div>
    </div>
  );
}

export default function MarketPage({ params }: Props) {
  // The market slug is only known at request time, so everything waits inside Suspense.
  return (
    <Suspense fallback={<MarketSkeleton />}>
      <MarketView params={params} />
    </Suspense>
  );
}