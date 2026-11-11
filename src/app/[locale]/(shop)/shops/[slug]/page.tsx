import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { Store, Truck, Undo2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { StorefrontHeader } from "@/components/shop/storefront-header";
import { CONTENT_ID, ShopProducts, ShopReviews, StorefrontTabs } from "@/components/shop/storefront-tabs";
import { ApiError } from "@/lib/api/core";
import { publicGet } from "@/lib/api/public";
import { getStorefront, type Storefront } from "@/lib/api/storefront";
import { parseStorefrontParams, storefrontHref } from "@/lib/storefront-params";
import { cn } from "@/lib/utils";
import { ShopGallery } from "@/components/shop/shop-photos";
type RawParams = Record<string, string | string[] | undefined>;
type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<RawParams>;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validSlug = (slug: string) => slug.length <= 200 && SLUG.test(slug);

// Only the title and description for search engines are cached (5 min). The page itself is always fresh.
async function shopMeta(slug: string) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag("shops");
  const { data } = await publicGet<Storefront>(`/shops/${encodeURIComponent(slug)}`, undefined, { fresh: false });
  return { name: data.name, description: data.description, market: data.market?.name ?? null };
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  if (!validSlug(slug)) return {};
  try {
    const meta = await shopMeta(slug);
    return {
      title: meta.market ? `${meta.name} · ${meta.market}` : meta.name,
      description: meta.description?.slice(0, 160) ?? undefined,
    };
  } catch {
    return {};
  }
}

function ServiceLine({ on, icon: Icon, yes, no }: { on: boolean; icon: typeof Truck; yes: string; no: string }) {
  return (
    <li className={cn("type-body flex items-center gap-2", on ? "text-ink" : "text-ink-muted line-through decoration-1")}>
      <Icon className={cn("size-4 shrink-0", on ? "text-success-ink" : "text-ink-disabled")} aria-hidden />
      {on ? yes : no}
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="aspect-[4/5] animate-pulse rounded-t-full rounded-b-sm bg-subtle" />
      ))}
    </div>
  );
}

async function StorefrontView({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!validSlug(slug)) notFound();

  const t = await getTranslations("Shop");
  const state = parseStorefrontParams(await searchParams);

  let shop: Storefront;
  try {
    shop = await getStorefront(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    return (
      <p role="alert" className="type-body py-12 text-center text-ink-secondary">
        {t("loadError")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <StorefrontHeader shop={shop} />
<ShopGallery slug={shop.slug} />
      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="about-heading" className="flex flex-col gap-3">
          <h2 id="about-heading" className="type-h3 text-ink">
            {t("about")}
          </h2>
          {/* Text from the shop: plain text, React escapes it */}
          {shop.description && <p className="type-body whitespace-pre-line text-ink-secondary">{shop.description}</p>}
          <h3 className="type-body-medium mt-2 text-ink">{t("services")}</h3>
          <ul className="flex flex-col gap-1.5">
            <ServiceLine on={shop.supportsDelivery} icon={Truck} yes={t("delivery")} no={t("noDelivery")} />
            <ServiceLine on={shop.supportsPickup} icon={Store} yes={t("pickup")} no={t("noPickup")} />
          </ul>
          {shop.photoCount > 0 && <p className="type-caption text-ink-muted">{t("photos", { count: shop.photoCount })}</p>}
        </section>

        <section aria-labelledby="returns-heading" className="flex flex-col gap-3 md:border-l md:border-gold md:pl-8">
          <h2 id="returns-heading" className="type-h3 flex items-center gap-2 text-ink">
            <Undo2 className="size-5 text-highlight" aria-hidden />
            {t("returnPolicy")}
          </h2>
          {shop.returnPolicy ? (
            <>
              {shop.returnPolicy.windowDays !== null && (
                <p className="type-body-medium text-ink">{t("returnWindow", { days: shop.returnPolicy.windowDays })}</p>
              )}
              <p className="type-body whitespace-pre-line text-ink-secondary">{shop.returnPolicy.text}</p>
            </>
          ) : (
            <p className="type-body text-ink-muted">{t("noReturnPolicy")}</p>
          )}
        </section>
      </div>

      <div id={CONTENT_ID} className="flex scroll-mt-32 flex-col gap-5">
        <StorefrontTabs shop={shop} state={state} />
        {/* key: switching tab, filter or page shows the skeleton instead of the old list */}
        <Suspense key={storefrontHref(slug, state)} fallback={<ListSkeleton />}>
          {state.tab === "reviews" ? <ShopReviews shop={shop} state={state} /> : <ShopProducts shop={shop} state={state} />}
        </Suspense>
      </div>
    </div>
  );
}

function StorefrontSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="-mx-4 -mt-6 h-40 animate-pulse bg-subtle md:mx-0 md:mt-0 md:h-60 md:rounded-lg" />
      <div className="h-10 w-2/3 animate-pulse rounded-sm bg-subtle" />
      <div className="h-24 animate-pulse rounded-md bg-subtle" />
    </div>
  );
}

export default function ShopPage({ params, searchParams }: Props) {
  // The shop slug is only known at request time, so everything waits inside Suspense.
  return (
    <Suspense fallback={<StorefrontSkeleton />}>
      <StorefrontView params={params} searchParams={searchParams} />
    </Suspense>
  );
}