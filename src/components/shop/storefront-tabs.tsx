import { ChevronLeft, ChevronRight, MessageSquareText, PackageSearch, Star } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArchFrame } from "@/components/brand/arch-frame";
import { PriceTicket } from "@/components/brand/price-ticket";
import { AvailabilityBadge } from "@/components/catalog/availability-badge";
import { CategoryIcon } from "@/components/catalog/product-card";
import { Link } from "@/i18n/routing";
import {
  listShopCategories,
  listShopProducts,
  listShopReviews,
  safeMediaUrl,
  shortName,
  type ShopCategory,
  type ShopProduct,
  type Storefront,
} from "@/lib/api/storefront";
import {
  DEFAULT_STOREFRONT,
  REVIEW_PAGE_SIZE,
  SHOP_PAGE_SIZE,
  storefrontHref,
  type ShopTab,
  type StorefrontState,
} from "@/lib/storefront-params";
import { cn } from "@/lib/utils";

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4";
export const CONTENT_ID = "shop-content";

const chipClass = (active: boolean) =>
  cn(
    "type-body-medium flex h-10 items-center gap-1.5 rounded-full border px-4 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
    active ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand",
  );

// ---------- Tabs ----------

export function StorefrontTabs({ shop, state }: { shop: Storefront; state: StorefrontState }) {
  const t = useTranslations("Shop");
  const tabs: { tab: ShopTab; label: string; count?: number }[] = [
    { tab: "products", label: t("tabProducts") },
    { tab: "bargains", label: t("tabBargains"), count: shop.stats.activeBargains },
    { tab: "reviews", label: t("tabReviews"), count: shop.stats.reviewCount },
  ];

  return (
    <nav
      aria-label={t("tabsLabel")}
      className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 -mx-4 overflow-x-auto border-b border-line bg-background px-4 md:top-[calc(4.5rem+env(safe-area-inset-top))] md:mx-0 md:px-0"
    >
      <ul className="flex w-max gap-6">
        {tabs.map(({ tab, label, count }) => {
          const active = state.tab === tab;
          return (
            <li key={tab}>
              <Link
                href={storefrontHref(shop.slug, DEFAULT_STOREFRONT, { tab })}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "type-body-medium flex h-12 items-center gap-2 border-b-[3px] focus-visible:bg-subtle focus-visible:outline-none",
                  active ? "border-brand text-ink" : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {label}
                {count !== undefined && count > 0 && (
                  <span className="type-caption rounded-full bg-highlight-soft px-2 text-highlight">{count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---------- Shared pieces ----------

function Pagination({ slug, state, totalPages }: { slug: string; state: StorefrontState; totalPages: number }) {
  const t = useTranslations("Shop");
  if (totalPages <= 1) return null;
  const linkClass =
    "type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none";

  return (
    <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3 border-t border-gold pt-5">
      {state.page > 1 ? (
        <Link href={storefrontHref(slug, state, { page: state.page - 1 }, CONTENT_ID)} rel="prev" className={linkClass}>
          <ChevronLeft className="size-4" aria-hidden />
          {t("previous")}
        </Link>
      ) : (
        <span />
      )}
      <span className="type-body text-ink-secondary">{t("pageOf", { page: state.page, total: totalPages })}</span>
      {state.page < totalPages ? (
        <Link href={storefrontHref(slug, state, { page: state.page + 1 }, CONTENT_ID)} rel="next" className={linkClass}>
          {t("next")}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function ShopProductCard({ item }: { item: ShopProduct }) {
  const image = safeMediaUrl(item.product.image);
  return (
    // Opens the product page with this shop's offer selected.
    <Link
      href={`/products/${item.product.slug}?listing=${item.listingId}`}
      className="group flex flex-col gap-2 rounded-md border border-line bg-card p-2 pb-3 shadow-card transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    >
      <ArchFrame className="bg-highlight-soft">
        {image ? (
          <Image src={image} alt="" fill unoptimized sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-highlight">
            <CategoryIcon categorySlug="" className="size-10" strokeWidth={1.25} aria-hidden />
          </span>
        )}
        {item.bargainEnabled && item.availability !== "OUT_OF_STOCK" && (
          <span className="type-caption absolute bottom-2 left-2 rounded-sm bg-highlight px-1.5 py-0.5 text-primary-foreground">
            🤝
          </span>
        )}
      </ArchFrame>
      <div className="flex flex-col gap-1 px-1">
        {item.product.brand && <p className="type-caption text-ink-muted">{item.product.brand}</p>}
        <h3 className="type-body-medium line-clamp-2 text-ink group-hover:text-brand">{item.product.title}</h3>
      </div>
      <PriceTicket amount={item.price} msrp={item.msrp} className="mx-1 self-start" />
      <AvailabilityBadge value={item.availability} className="mx-1 self-start" />
    </Link>
  );
}

function CategoryChips({ slug, state, categories }: { slug: string; state: StorefrontState; categories: ShopCategory[] }) {
  const t = useTranslations("Shop");
  if (categories.length < 2) return null;
  const chips = [{ slug: undefined as string | undefined, name: t("allCategories"), count: undefined as number | undefined }].concat(
    categories.map((c) => ({ slug: c.slug, name: c.name, count: c.productCount })),
  );

  return (
    <nav aria-label={t("categories")} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex w-max gap-2 pb-1">
        {chips.map((chip) => (
          <li key={chip.slug ?? "all"}>
            <Link
              href={storefrontHref(slug, state, { category: chip.slug })}
              scroll={false}
              aria-current={state.category === chip.slug ? "page" : undefined}
              className={chipClass(state.category === chip.slug)}
            >
              {chip.name}
              {chip.count !== undefined && <span className="type-caption opacity-75">{chip.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ---------- Products and Active bargains ----------

export async function ShopProducts({ shop, state }: { shop: Storefront; state: StorefrontState }) {
  const t = await getTranslations("Shop");
  const bargains = state.tab === "bargains";

  const [categoriesResult, productsResult] = await Promise.allSettled([
    listShopCategories(shop.slug),
    listShopProducts(shop.slug, {
      category: state.category,
      sort: state.sort,
      bargainOnly: bargains || undefined,
      availableOnly: bargains || state.availableOnly || undefined,
      page: state.page,
      limit: SHOP_PAGE_SIZE,
    }),
  ]);

  if (productsResult.status === "rejected") {
    return (
      <p role="alert" className="type-body text-ink-secondary">
        {t("listLoadError")}
      </p>
    );
  }

  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
  const { data: products, meta } = productsResult.value;
  const total = meta?.pagination?.total ?? products.length;
  const totalPages = meta?.pagination?.totalPages ?? 1;

  const sorts = [
    { sort: "newest" as const, label: t("sortNewest") },
    { sort: "price_asc" as const, label: t("sortPriceAsc") },
    { sort: "price_desc" as const, label: t("sortPriceDesc") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <CategoryChips slug={shop.slug} state={state} categories={categories} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="type-body-medium mr-1 text-ink-secondary">{t("sortLabel")}:</span>
        {sorts.map(({ sort, label }) => (
          <Link
            key={sort}
            href={storefrontHref(shop.slug, state, { sort })}
            scroll={false}
            aria-current={state.sort === sort ? "true" : undefined}
            className={chipClass(state.sort === sort)}
          >
            {label}
          </Link>
        ))}
        {!bargains && (
          <Link
            href={storefrontHref(shop.slug, state, { availableOnly: !state.availableOnly })}
            scroll={false}
            aria-pressed={state.availableOnly}
            className={chipClass(state.availableOnly)}
          >
            {t("inStockOnly")}
          </Link>
        )}
      </div>

      <p className="type-body text-ink-secondary">{t("productCount", { count: total })}</p>

      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center">
          <PackageSearch className="size-10 text-highlight" strokeWidth={1.5} aria-hidden />
          <p className="type-body text-ink-secondary">{bargains ? t("emptyBargains") : t("emptyProducts")}</p>
          {!bargains && (state.category || state.availableOnly) && (
            <Link href={storefrontHref(shop.slug, DEFAULT_STOREFRONT)} scroll={false} className="type-body-medium text-brand underline-offset-4 hover:underline">
              {t("clearFilters")}
            </Link>
          )}
        </div>
      ) : (
        <div className={GRID}>
          {products.map((item) => (
            <ShopProductCard key={item.listingId} item={item} />
          ))}
        </div>
      )}

      <Pagination slug={shop.slug} state={state} totalPages={totalPages} />
    </div>
  );
}

// ---------- Reviews ----------

function Stars({ rating }: { rating: number }) {
  const t = useTranslations("Shop");
  const value = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <span role="img" aria-label={t("stars", { rating: value })} className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn("size-4", i < value ? "fill-highlight text-highlight" : "text-line-strong")} aria-hidden />
      ))}
    </span>
  );
}

export async function ShopReviews({ shop, state }: { shop: Storefront; state: StorefrontState }) {
  const t = await getTranslations("Shop");
  const format = await getFormatter();

  const type = state.reviews === "trust" ? "SHOP_TRUST" : state.reviews === "product" ? "PRODUCT" : undefined;
  let result;
  try {
    result = await listShopReviews(shop.slug, { type, page: state.page, limit: REVIEW_PAGE_SIZE });
  } catch {
    return (
      <p role="alert" className="type-body text-ink-secondary">
        {t("listLoadError")}
      </p>
    );
  }

  const reviews = result.data;
  const totalPages = result.meta?.pagination?.totalPages ?? 1;
  const filters = [
    { reviews: "all" as const, label: t("reviewsAll") },
    { reviews: "trust" as const, label: t("reviewsTrust") },
    { reviews: "product" as const, label: t("reviewsProduct") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t("reviewsFilter")} className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.reviews}
            href={storefrontHref(shop.slug, state, { reviews: f.reviews })}
            scroll={false}
            aria-current={state.reviews === f.reviews ? "page" : undefined}
            className={chipClass(state.reviews === f.reviews)}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {reviews.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center">
          <MessageSquareText className="size-10 text-highlight" strokeWidth={1.5} aria-hidden />
          <p className="type-body max-w-sm text-ink-secondary">{t("noReviewsYet")}</p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {reviews.map((review) => (
            <li key={review.id} className="flex flex-col gap-2 border-b border-line py-4">
              <div className="flex items-center justify-between gap-3">
                <Stars rating={review.rating} />
                <span className="type-caption text-ink-muted">
                  {format.dateTime(new Date(review.createdAt), { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              <p className="type-caption text-highlight">
                {review.type === "SHOP_TRUST" ? t("reviewTypeTrust") : t("reviewTypeProduct")}
                {review.product && (
                  <>
                    {" · "}
                    <Link href={`/products/${review.product.slug}`} className="underline-offset-4 hover:underline">
                      {t("reviewedProduct", { product: review.product.title })}
                    </Link>
                  </>
                )}
              </p>
              {/* Customer text: plain text, React escapes it */}
              {review.comment && <p className="type-body whitespace-pre-line text-ink">{review.comment}</p>}
              <p className="type-caption text-ink-secondary">— {shortName(review.reviewer)}</p>
            </li>
          ))}
        </ul>
      )}

      <Pagination slug={shop.slug} state={state} totalPages={totalPages} />
    </div>
  );
}