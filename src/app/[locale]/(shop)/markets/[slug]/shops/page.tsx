import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronRight, LayoutGrid, MapPin, Store } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { MarketShopFinder } from "@/components/shop/market-shop-finder";
import { Link } from "@/i18n/routing";
import { groupByFloor, marketData, validSlug } from "@/lib/market-data";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  if (!validSlug(slug)) return {};
  try {
    const market = await marketData(slug);
    if (!market) return {};
    const t = await getTranslations({ locale, namespace: "Market" });
    return { title: t("shopsTitle", { market: market.name }) };
  } catch {
    return {};
  }
}

/** Every shop of one market: search by name or shop number, and pick a floor. */
async function MarketShopsView({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!validSlug(slug)) notFound();

  const t = await getTranslations("Market");

  let market;
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

  const floors = groupByFloor(market.shops);
  const place = [market.address, market.city].filter(Boolean).join(", ");
  const floorCount = floors.filter(([floor]) => floor).length;

  return (
    <div className="flex flex-col gap-8 md:gap-10">
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
          <li>
            <Link href={`/markets/${market.slug}`} className="hover:text-brand">
              {market.name}
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-3.5" />
          </li>
          <li aria-current="page" className="text-ink-secondary">
            {t("shopsCrumb")}
          </li>
        </ol>
      </nav>

      {/* Bordeaux directory board: the market's name, its floors and shop count */}
      <header className="relative isolate flex flex-col gap-5 overflow-hidden rounded-3xl bg-brand p-6 text-primary-foreground shadow-card md:flex-row md:items-end md:justify-between md:p-10">
        <span aria-hidden className="arch-up absolute -right-10 bottom-0 -z-10 h-[90%] w-44 rounded-t-full border border-b-0 border-gold/40" />
        <span aria-hidden className="arch-up absolute right-16 bottom-0 -z-10 h-[60%] w-28 rounded-t-full border border-b-0 border-gold/25" />
        <span aria-hidden className="absolute -bottom-28 -left-20 -z-10 size-80 rounded-full bg-brand-alt/70" />

        <div className="flex flex-col items-start gap-3">
          <span aria-hidden className="flex items-center gap-2">
            <span className="h-px w-8 bg-gold" />
            <span className="size-2 rotate-45 bg-gold" />
          </span>
          <p className="type-caption tracking-[0.18em] text-primary-foreground/85 uppercase">{t("shopsEyebrow")}</p>
          <h1 className="type-display wrap-break-word">{t("shopsTitle", { market: market.name })}</h1>
          {place && (
            <p className="type-body flex items-start gap-2 text-primary-foreground/85">
              <MapPin className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
              {place}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <span className="type-body-medium inline-flex h-10 items-center gap-2 rounded-full bg-primary-foreground/10 px-4">
              <Store className="size-4 text-gold" aria-hidden />
              {t("shopCount", { count: market.shops.length })}
            </span>
            {floorCount > 0 && (
              <span className="type-body-medium inline-flex h-10 items-center rounded-full bg-primary-foreground/10 px-4">
                {t("floorCount", { count: floorCount })}
              </span>
            )}
          </div>
        </div>

        <Link
          href={`/markets/${market.slug}`}
          className="type-body-medium inline-flex h-12 shrink-0 items-center gap-2 self-start rounded-full bg-gold px-5 text-ink shadow-card hover:bg-gold/90 focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-brand focus-visible:outline-none md:self-auto"
        >
          <LayoutGrid className="size-4" aria-hidden />
          {t("seeProducts")}
        </Link>
      </header>

      <MarketShopFinder floors={floors} />
    </div>
  );
}

function ShopsSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden>
      <div className="h-56 skeleton rounded-3xl" />
      <div className="h-32 skeleton rounded-3xl" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-22 skeleton rounded-md" />
        ))}
      </div>
    </div>
  );
}

export default function MarketShopsPage({ params }: Props) {
  return (
    <Suspense fallback={<ShopsSkeleton />}>
      <MarketShopsView params={params} />
    </Suspense>
  );
}
