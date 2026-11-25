import { ArrowRight, Flame, Zap } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ArchFrame } from "@/components/brand/arch-frame";
import { CategoryIcon } from "@/components/catalog/product-card";
import { Stagger } from "@/components/motion/stagger";
import { Link } from "@/i18n/routing";
import type { ProductCardData } from "@/lib/api/catalog";
import { getShelf } from "@/lib/api/catalog-cache";
import { safeMediaUrl } from "@/lib/api/storefront";
import { formatTaka } from "@/lib/format";

// What the visitor saves against the regular price (prices from the server only).
function saving(p: ProductCardData) {
  return typeof p.msrp === "number" && p.msrp > p.lowestPrice
    ? p.msrp - p.lowestPrice
    : 0;
}

function Photo({
  product,
  sizes,
}: {
  product: ProductCardData;
  sizes: string;
}) {
  const src = safeMediaUrl(product.image);
  return src ? (
    <Image
      src={src}
      alt=""
      fill
      unoptimized
      sizes={sizes}
      className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
    />
  ) : (
    <span className="absolute inset-0 flex items-center justify-center text-highlight">
      <CategoryIcon
        categorySlug={product.category.slug}
        className="size-1/3"
        strokeWidth={1.25}
        aria-hidden
      />
    </span>
  );
}

/**
 * "Trending this week": the #1 product (sales + add-to-carts, last 7 days) as a big bordeaux
 * showcase, and #2–#4 beside it. Same 1-minute cache as the home shelves; nothing when empty.
 */
export async function TrendingSpotlight({ heading }: { heading: ReactNode }) {
  const [t, tCatalog, locale] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Catalog"),
    getLocale(),
  ]);
  let products: ProductCardData[];
  try {
    products = await getShelf("trending");
  } catch {
    return null; // the rest of the home page still works
  }
  const [top, ...rest] = products.slice(0, 4);
  if (!top) return null;
  const rank = new Intl.NumberFormat(locale);
  const topSave = saving(top);

  return (
    <section aria-labelledby="spotlight-title" className="flex flex-col gap-5">
      {heading}
      <Stagger className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-6">
        {/* #1: the showcase */}
        <Link
          href={`/products/${top.slug}`}
          className="group relative isolate flex flex-col gap-5 overflow-hidden rounded-md bg-brand p-5 text-primary-foreground shadow-card focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:flex-row sm:items-center sm:p-6"
        >
          {/* Gold arch outlines in the corner (decoration) */}
          <span
            aria-hidden
            className="absolute -right-10 -bottom-10 -z-10 h-64 w-44 rounded-t-full border border-b-0 border-gold/40"
          />
          <span
            aria-hidden
            className="absolute -right-2 -bottom-10 -z-10 h-52 w-32 rounded-t-full border border-b-0 border-gold/25"
          />

          <ArchFrame className="mx-auto w-full max-w-60 shrink-0 border-4 border-gold/60 bg-highlight-soft sm:mx-0 sm:w-56 sm:max-w-none md:w-64">
            <Photo product={top} sizes="(min-width: 640px) 16rem, 90vw" />
            {topSave > 0 && (
              <span className="type-body-medium absolute top-1/4 left-0 rounded-r-full bg-gold py-1 pr-3 pl-2 text-ink shadow-card">
                {t("spotlightSave", { amount: formatTaka(topSave, locale) })}
              </span>
            )}
            {top.deal && (
              <span className="type-caption absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-card px-2 py-0.5 font-medium text-brand">
                <Zap className="size-3.5" aria-hidden />
                {tCatalog("flashDeal")}
              </span>
            )}
          </ArchFrame>

          <div className="flex min-w-0 flex-col gap-3">
            <p className="type-caption flex items-center gap-1.5 tracking-[0.12em] text-primary-foreground/85 uppercase">
              <Flame className="size-4 text-gold" aria-hidden />
              {t("spotlightEyebrow")}
            </p>
            {top.brand && (
              <p className="type-caption text-primary-foreground/75">
                {top.brand.name}
              </p>
            )}
            <h3 className="type-h2 line-clamp-3 text-primary-foreground">
              {top.title}
            </h3>
            <p className="flex flex-wrap items-baseline gap-x-2">
              {top.shopCount > 1 && (
                <span className="type-body text-primary-foreground/80">
                  {tCatalog("from")}
                </span>
              )}
              <span className="font-heading text-[2rem] leading-none">
                {formatTaka(top.lowestPrice, locale)}
              </span>
              {topSave > 0 && top.msrp && (
                <s className="type-body text-primary-foreground/60">
                  {formatTaka(top.msrp, locale)}
                </s>
              )}
            </p>
            <p className="type-body text-primary-foreground/85">
              {tCatalog("shops", { count: top.shopCount })}
              {top.bargainAvailable && (
                <>
                  {" "}
                  · <span aria-hidden>🤝 </span>
                  {tCatalog("bargain")}
                </>
              )}
            </p>
            <span className="type-body-medium mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-card px-6 text-brand group-hover:bg-subtle sm:w-fit">
              {t("spotlightCta")}
              <ArrowRight
                className="size-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-1"
                aria-hidden
              />
            </span>
          </div>
        </Link>

        {/* #2–#4 */}
        {rest.length > 0 && (
          <ol className="flex flex-col gap-3">
            {rest.map((product, i) => {
              const save = saving(product);
              return (
                <li key={product.id} className="flex-1">
                  <Link
                    href={`/products/${product.slug}`}
                    className="group flex h-full items-center gap-4 rounded-md border border-line bg-card p-3 shadow-card hover:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-0.5"
                  >
                    <span
                      aria-hidden
                      className="w-8 shrink-0 text-center font-heading text-[1.75rem] leading-none text-gold"
                    >
                      {rank.format(i + 2)}
                    </span>
                    <ArchFrame
                      ratio="tall"
                      className="w-16 shrink-0 bg-highlight-soft"
                    >
                      <Photo product={product} sizes="4rem" />
                    </ArchFrame>
                    <div className="flex min-w-0 flex-col gap-1">
                      <h3 className="type-body-medium line-clamp-2 text-ink group-hover:text-brand">
                        {product.title}
                      </h3>
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="type-body-medium text-brand">
                          {formatTaka(product.lowestPrice, locale)}
                        </span>
                        {save > 0 && (
                          <span className="type-caption rounded-full bg-highlight-soft px-2 text-highlight">
                            {t("spotlightSave", {
                              amount: formatTaka(save, locale),
                            })}
                          </span>
                        )}
                      </p>
                      <p className="type-caption text-ink-muted">
                        {tCatalog("shops", { count: product.shopCount })}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </Stagger>
    </section>
  );
}

export function TrendingSpotlightSkeleton() {
  return (
    <div
      className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-6"
      aria-hidden
    >
      <div className="skeleton h-96 rounded-md sm:h-80" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="skeleton h-24 rounded-md" />
        ))}
      </div>
    </div>
  );
}
