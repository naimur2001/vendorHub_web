import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CategoryIcon } from "@/components/catalog/product-card";
import { SelectedListingCard } from "@/components/product/listing-card";
import { OtherShops } from "@/components/product/other-shops";
import { ProductGallery } from "@/components/product/product-gallery";
import { Link } from "@/i18n/routing";
import { getProduct, type ProductDetail } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/core";
import { publicGet } from "@/lib/api/public";
import { ProductReviews } from "@/components/reviews/product-reviews";
import { TryOn } from "@/components/catalog/try-on";

type RawParams = Record<string, string | string[] | undefined>;
type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<RawParams>;
};

// Checked before anything reaches the API.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validSlug = (slug: string) => slug.length <= 200 && SLUG.test(slug);

// Only the title and description for search engines are cached (5 min). Prices on the page are always fresh.
async function productMeta(slug: string) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag("products");
  const { data } = await publicGet<ProductDetail>(`/products/${encodeURIComponent(slug)}`, undefined, { fresh: false });
  return { title: data.product.title, description: data.product.description };
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  if (!validSlug(slug)) return {};
  try {
    const meta = await productMeta(slug);
    return { title: meta.title, description: meta.description?.slice(0, 160) ?? undefined };
  } catch {
    return {};
  }
}

type Loaded = { kind: "ok"; detail: ProductDetail } | { kind: "not-found" } | { kind: "error" };

async function load(slug: string, listingId?: string): Promise<Loaded> {
  try {
    return { kind: "ok", detail: await getProduct(slug, listingId) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      // A listing that does not belong to this product (edited URL): show the default shop instead.
      if (listingId) return load(slug);
      return { kind: "not-found" };
    }
    return { kind: "error" };
  }
}

// function SpecsAndDescription({ detail }: { detail: ProductDetail }) {
//   return null as unknown as React.ReactElement; // replaced below (kept for readability)
// }

async function ProductView({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!validSlug(slug)) notFound();

  const raw = (await searchParams).listing;
  const listingParam = Array.isArray(raw) ? raw[0] : raw;
  const listingId = listingParam && UUID.test(listingParam) ? listingParam : undefined;

  const t = await getTranslations("Product");
  const result = await load(slug, listingId);
  if (result.kind === "not-found") notFound();
  if (result.kind === "error") {
    return (
      <p role="alert" className="type-body py-12 text-center text-ink-secondary">
        {t("loadError")}
      </p>
    );
  }

  const { product, selectedListing, otherListings } = result.detail;
  const specs = Object.entries(product.specs ?? {});
  const label = (key: string) => key.charAt(0).toUpperCase() + key.slice(1).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t("breadcrumb")}>
        <ol className="type-caption flex flex-wrap items-center gap-1 text-ink-muted">
          <li>
            <Link href="/" className="hover:text-brand">
              {t("home")}
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden />
          <li>
            <Link href={`/search?category=${product.category.slug}`} className="hover:text-brand">
              {product.category.name}
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden />
          <li aria-current="page" className="truncate text-ink-secondary">
            {product.title}
          </li>
        </ol>
      </nav>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] lg:gap-12">
        <ProductGallery
          images={product.images}
          title={product.title}
          placeholder={
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-highlight">
              <CategoryIcon categorySlug={product.category.slug} className="size-20" strokeWidth={1} aria-hidden />
              <span className="type-caption text-ink-muted">{t("noPhoto")}</span>
            </span>
          }
        />

        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            {product.brand && <p className="type-body-medium text-ink-secondary">{product.brand.name}</p>}
            <h1 className="type-display text-ink">{product.title}</h1>
            {specs.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {specs.slice(0, 3).map(([key, value]) => (
                  <li key={key} className="type-caption rounded-full border border-line-strong bg-card px-3 py-1 text-ink-secondary">
                    {String(value)}
                  </li>
                ))}
              </ul>
            )}
          </header>

          <div className="border-t border-gold" />

          {selectedListing ? (
            <SelectedListingCard listing={selectedListing} otherCount={otherListings.length} productSlug={product.slug} />
            
          ) : (
            <p className="type-body rounded-md border border-line bg-card p-5 text-ink-secondary">{t("noListings")}</p>
          )}
                   <TryOn slug={product.slug} productId={product.id} />

          <OtherShops slug={product.slug} listings={otherListings} />

          <div className="flex flex-col border-t border-line">
            {specs.length > 0 && (
              <details open className="group border-b border-line py-4">
                <summary className="type-h3 flex cursor-pointer list-none items-center justify-between text-ink">
                  {t("specifications")}
                  <ChevronRight className="size-5 text-ink-muted transition-transform group-open:rotate-90" aria-hidden />
                </summary>
                <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-4 gap-y-2">
                  {specs.map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt className="type-body text-ink-muted">{label(key)}</dt>
                      <dd className="type-body text-ink">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
            {product.description && (
              <details open className="group border-b border-line py-4">
                <summary className="type-h3 flex cursor-pointer list-none items-center justify-between text-ink">
                  {t("description")}
                  <ChevronRight className="size-5 text-ink-muted transition-transform group-open:rotate-90" aria-hidden />
                </summary>
                {/* Plain text from the shop: React escapes it, never rendered as HTML */}
                <p className="type-body mt-3 whitespace-pre-line text-ink-secondary">{product.description}</p>
              </details>
            )}
          </div>
        </div>
      </div>


      <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-subtle" aria-hidden />}>
        <ProductReviews slug={product.slug} />
      </Suspense>

      
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] lg:gap-12" aria-hidden>
      <div className="aspect-[4/5] w-full animate-pulse rounded-t-full rounded-b-sm bg-subtle lg:max-w-[560px]" />
      <div className="flex flex-col gap-4">
        <div className="h-4 w-24 animate-pulse rounded-sm bg-subtle" />
        <div className="h-10 w-3/4 animate-pulse rounded-sm bg-subtle" />
        <div className="h-72 animate-pulse rounded-md bg-subtle" />
      </div>
    </div>
  );
}

export default function ProductPage({ params, searchParams }: Props) {
  // The product slug is only known at request time, so everything waits inside Suspense.
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductView params={params} searchParams={searchParams} />
    </Suspense>
  );
}