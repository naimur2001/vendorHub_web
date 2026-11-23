import { Package, Sparkles, Store } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PriceTicket } from "@/components/brand/price-ticket";
import { VerificationSeal } from "@/components/brand/verification-seal";
import { Link } from "@/i18n/routing";
import { getFeaturedProducts, getFeaturedShops, type FeaturedProduct, type FeaturedShop } from "@/lib/api/catalog-cache";
import { safeMediaUrl } from "@/lib/api/storefront";

const ROW = "scroll-row -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-1 pb-2 md:mx-0 md:px-0";

function Heading({ id, title, text }: { id: string; title: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 id={id} className="type-h2 flex items-center gap-2 text-ink">
        <Sparkles className="size-6 text-gold" aria-hidden />
        {title}
      </h2>
      <p className="type-body text-ink-secondary">{text}</p>
    </div>
  );
}

/** Admin-picked products. Nothing shows when there are none or the API is down. */
export async function FeaturedProducts() {
  const t = await getTranslations("Featured");
  let items: FeaturedProduct[];
  try {
    items = await getFeaturedProducts();
  } catch {
    return null;
  }
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="featured-products" className="flex flex-col gap-5">
      <Heading id="featured-products" title={t("productsTitle")} text={t("productsText")} />
      <ul className={ROW}>
        {items.map(({ slotId, product: p }) => {
          const photo = safeMediaUrl(p.thumbnail) ?? safeMediaUrl(p.image);
          return (
            <li key={slotId} className="w-40 shrink-0 snap-start sm:w-48">
              <Link
                href={`/products/${p.slug}`}
                className="group lift flex h-full flex-col gap-2 rounded-md border border-gold/60 bg-card p-2 pb-3 shadow-card hover:border-gold focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                <span className="relative block aspect-4/5 overflow-hidden rounded-t-full rounded-b-sm bg-highlight-soft">
                  {photo ? (
                    <Image src={photo} alt="" fill unoptimized sizes="192px" className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" />
                  ) : (
                    <Package className="absolute inset-0 m-auto size-10 text-highlight" strokeWidth={1.25} aria-hidden />
                  )}
                </span>
                <span className="type-body-medium line-clamp-2 px-1 text-ink group-hover:text-brand">{p.title}</span>
                <span className="mt-auto flex flex-wrap items-baseline gap-1.5 px-1">
                  {p.shopCount > 1 && <span className="type-caption text-ink-muted">{t("from")}</span>}
                  <PriceTicket amount={p.lowestPrice} msrp={p.msrp} />
                </span>
                <span className="type-caption px-1 text-ink-muted">{t("shops", { count: p.shopCount })}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Admin-picked shops. Nothing shows when there are none or the API is down. */
export async function FeaturedShops() {
  const t = await getTranslations("Featured");
  let items: FeaturedShop[];
  try {
    items = await getFeaturedShops();
  } catch {
    return null;
  }
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="featured-shops" className="flex flex-col gap-5">
      <Heading id="featured-shops" title={t("shopsTitle")} text={t("shopsText")} />
      <ul className={ROW}>
        {items.map(({ slotId, shop }) => {
          const logo = safeMediaUrl(shop.logoUrl);
          return (
            <li key={slotId} className="w-64 shrink-0 snap-start">
              <Link
                href={`/shops/${shop.slug}`}
                className="group flex h-full items-center gap-3 rounded-2xl border border-gold/60 bg-card p-3 shadow-card hover:border-gold focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                <span className="relative flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden rounded-t-full rounded-b-sm bg-brand">
                  {logo ? <Image src={logo} alt="" fill unoptimized sizes="56px" className="object-cover" /> : <Store className="size-5 text-primary-foreground" aria-hidden />}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-1.5">
                    <span className="type-body-medium truncate text-ink group-hover:text-brand">{shop.name}</span>
                    {shop.verificationLevel !== "UNVERIFIED" && <VerificationSeal level={shop.verificationLevel} size="sm" />}
                  </span>
                  {shop.market && <span className="type-caption truncate text-ink-muted">{shop.market.name}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
