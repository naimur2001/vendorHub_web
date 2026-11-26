import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, MapPin, PackageSearch, Store } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ProductCard, ProductCardSkeleton } from "@/components/catalog/product-card";
import { MarketProductFilters } from "@/components/shop/market-product-filters";
import { MARKET_SORTS, type MarketSort } from "@/lib/market-sorts";
import { MarketShopFinder } from "@/components/shop/market-shop-finder";
import { Link } from "@/i18n/routing";
import { listProducts, type ProductCardData } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/core";
import { publicGet } from "@/lib/api/public";
import type { MarketDetail, MarketShop } from "@/lib/api/storefront";
import { externalLinkProps } from "@/lib/security";
import Image from "next/image";
import { safeMediaUrl } from "@/lib/api/storefront";

type RawParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<RawParams> };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validSlug = (slug: string) => slug.length <= 200 && SLUG.test(slug);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PER_PAGE = 24;
const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4";
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

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

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
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

type View = { shopId: string | null; sort: MarketSort; page: number };

// Only a shop of this market, a known sort and a sane page number are ever used.
function readView(raw: RawParams, market: MarketDetail): View {
  const shopParam = first(raw.shop);
  const shopId = shopParam && UUID.test(shopParam) && market.shops.some((s) => s.id === shopParam) ? shopParam : null;
  const sortParam = first(raw.sort);
  const sort = (MARKET_SORTS as readonly string[]).includes(sortParam ?? "") ? (sortParam as MarketSort) : "newest";
  const pageNumber = Number(first(raw.page));
  const page = Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= 500 ? pageNumber : 1;
  return { shopId, sort, page };
}

function viewHref(slug: string, view: View): string {
  const params = new URLSearchParams();
  if (view.shopId) params.set("shop", view.shopId);
  if (view.sort !== "newest") params.set("sort", view.sort);
  if (view.page > 1) params.set("page", String(view.page));
  const query = params.toString();
  return `/markets/${slug}${query ? `?${query}` : ""}#products`;
}

const pageLink =
  "type-body-medium flex h-11 items-center gap-1.5 rounded-full border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none";

/** The products of the whole market (or of one shop in it). Prices always come fresh from the server. */
async function MarketProducts({ market, view }: { market: MarketDetail; view: View }) {
  const t = await getTranslations("Market");
  const tSearch = await getTranslations("Search");

  let products: ProductCardData[];
  let total: number;
  let totalPages: number;
  try {
    const result = await listProducts({ marketId: market.id, shopId: view.shopId ?? undefined, sort: view.sort, page: view.page, limit: PER_PAGE });
    products = result.data;
    total = result.meta?.pagination?.total ?? products.length;
    totalPages = result.meta?.pagination?.totalPages ?? 1;
  } catch {
    return (
      <p role="alert" className="type-body rounded-2xl border border-line bg-card p-6 text-center text-ink-secondary">
        {t("productsError")}
      </p>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line-strong bg-card px-6 py-12 text-center">
        <PackageSearch className="size-10 text-highlight" strokeWidth={1.5} aria-hidden />
        <p className="type-h3 text-ink">{view.shopId ? t("productsEmptyShop") : t("productsEmpty")}</p>
        {view.shopId && (
          <Link href={viewHref(market.slug, { ...view, shopId: null, page: 1 })} className={pageLink}>
            {t("showAllShops")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="type-body text-ink-secondary" aria-live="polite">
        {t("productsCount", { count: total })}
      </p>
      <div className={GRID}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {totalPages > 1 && (
        <nav aria-label={tSearch("pagination")} className="flex items-center justify-between gap-3 border-t border-gold pt-5">
          {view.page > 1 ? (
            <Link href={viewHref(market.slug, { ...view, page: view.page - 1 })} rel="prev" className={pageLink}>
              <ChevronLeft className="size-4" aria-hidden />
              {tSearch("previous")}
            </Link>
          ) : (
            <span />
          )}
          <span className="type-body text-ink-secondary">{tSearch("pageOf", { page: view.page, total: totalPages })}</span>
          {view.page < totalPages ? (
            <Link href={viewHref(market.slug, { ...view, page: view.page + 1 })} rel="next" className={pageLink}>
              {tSearch("next")}
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

function ProductsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <div className="h-5 w-32 skeleton rounded-sm" />
      <div className={GRID}>
        {Array.from({ length: 8 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

async function MarketView({ params, searchParams }: Props) {
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

  const view = readView(await searchParams, market);
  // The map link is built by us from numbers only, never from typed text.
  const hasMap = typeof market.latitude === "number" && typeof market.longitude === "number";
  const mapHref = hasMap ? `https://www.google.com/maps/search/?api=1&query=${market.latitude},${market.longitude}` : null;
  const floors = groupByFloor(market.shops);
  const banner = safeMediaUrl(market.image?.url ?? null);
  const place = [market.address, market.city].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-10 md:gap-14">
      <div className="flex flex-col gap-5">
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

        {/* Bordeaux hall: the market's name and facts, its photo standing in a gold arch */}
        <header className="relative isolate grid items-center gap-8 overflow-hidden rounded-3xl bg-brand p-6 text-primary-foreground shadow-card md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:p-10 lg:gap-12">
          <span aria-hidden className="arch-up absolute bottom-0 -left-12 -z-10 h-[85%] w-40 rounded-t-full border border-b-0 border-gold/40" />
          <span aria-hidden className="absolute -right-24 -bottom-24 -z-10 size-96 rounded-full bg-brand-alt/70" />

          <div className="flex flex-col items-start gap-4">
            <span aria-hidden className="flex items-center gap-2">
              <span className="h-px w-8 bg-gold" />
              <span className="size-2 rotate-45 bg-gold" />
            </span>
            <p className="type-caption tracking-[0.18em] text-primary-foreground/85 uppercase">{t("heroEyebrow")}</p>
            <h1 className="type-display wrap-break-word">{market.name}</h1>
            {place && (
              <p className="type-body flex items-start gap-2 text-primary-foreground/85">
                <MapPin className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                {place}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="type-body-medium inline-flex h-10 items-center gap-2 rounded-full bg-primary-foreground/10 px-4">
                <Store className="size-4 text-gold" aria-hidden />
                {t("shopCount", { count: market.shops.length })}
              </span>
              {mapHref && (
                <a
                  href={mapHref}
                  {...externalLinkProps}
                  className="type-body-medium inline-flex h-11 items-center gap-2 rounded-full border border-gold px-4 hover:bg-brand-alt focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
                >
                  <MapPin className="size-4" aria-hidden />
                  {t("openMap")}
                </a>
              )}
            </div>
          </div>

          <div className="relative mx-auto aspect-4/5 w-full max-w-72 overflow-hidden rounded-t-full rounded-b-2xl border-4 border-gold/60 bg-brand-alt shadow-modal">
            {banner ? (
              <Image src={banner} alt={market.name} fill unoptimized priority sizes="(min-width: 768px) 320px, 80vw" className="object-cover" />
            ) : (
              <span aria-hidden className="absolute inset-0 flex items-center justify-center">
                <Store className="size-20 text-gold/60" strokeWidth={1} />
              </span>
            )}
          </div>
        </header>
      </div>

      {/* Every product in the market, or one shop's, picked from the dropdown */}
      <section id="products" aria-labelledby="products-heading" className="flex scroll-mt-28 flex-col gap-6">
        <div className="relative flex flex-col gap-1 pb-3">
          <h2 id="products-heading" className="type-h2 text-ink">
            {t("productsTitle", { market: market.name })}
          </h2>
          <p className="type-body text-ink-secondary">{t("productsText")}</p>
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gold" />
        </div>

        {market.shops.length > 0 && (
          <MarketProductFilters
            marketSlug={market.slug}
            floors={floors.map(([floor, shops]) => ({ floor, shops: shops.map((s) => ({ id: s.id, name: s.name })) }))}
            shopId={view.shopId}
            sort={view.sort}
          />
        )}

        {/* key: a new shop, order or page shows the skeleton instead of the old products */}
        <Suspense key={viewHref(market.slug, view)} fallback={<ProductsSkeleton />}>
          <MarketProducts market={market} view={view} />
        </Suspense>
      </section>

      <section aria-labelledby="shops-heading" className="flex flex-col gap-6">
        <h2 id="shops-heading" className="type-h2 text-ink">
          {t("shopsTitle", { market: market.name })}
        </h2>
        <MarketShopFinder floors={floors} />
      </section>
    </div>
  );
}

function MarketSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden>
      <div className="h-80 skeleton rounded-3xl" />
      <div className="h-8 w-1/2 skeleton rounded-sm" />
      <ProductsSkeleton />
    </div>
  );
}

export default function MarketPage({ params, searchParams }: Props) {
  // The market slug and the chosen shop are only known at request time, so everything waits inside Suspense.
  return (
    <Suspense fallback={<MarketSkeleton />}>
      <MarketView params={params} searchParams={searchParams} />
    </Suspense>
  );
}
