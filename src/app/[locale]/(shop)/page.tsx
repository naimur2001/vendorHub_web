import { ChevronRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Arcade } from "@/components/brand/arcade";
import { ProductCard, ProductCardSkeleton } from "@/components/catalog/product-card";
import { MarketDoor } from "@/components/shop/market-cards";
import { Link } from "@/i18n/routing";
import type { ProductCardData } from "@/lib/api/catalog";
import { getLatestProducts, getMarkets } from "@/lib/api/catalog-cache";
import type { Market } from "@/lib/api/shops";

type Props = { params: Promise<{ locale: string }> };

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4";
const DOORS = "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-6 md:overflow-visible md:px-0";

// Up to 4 markets with the most shops, from the 10-minute market cache.
async function MarketDoors() {
  let markets: Market[];
  try {
    markets = await getMarkets();
  } catch {
    return null; // the rest of the home page still works
  }
  const top = [...markets].sort((a, b) => b.shopCount - a.shopCount).slice(0, 4);
  if (top.length === 0) return null;

  return (
    <div className={DOORS}>
      {top.map((market) => (
        <MarketDoor key={market.id} market={market} />
      ))}
    </div>
  );
}

function MarketDoorsSkeleton() {
  return (
    <div className={DOORS} aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="aspect-[3/4] w-44 shrink-0 animate-pulse rounded-t-full rounded-b-sm bg-subtle md:w-auto" />
      ))}
    </div>
  );
}

// Cached for 60 seconds on the server (see catalog-cache.ts), streamed in after the page shell.
async function LatestProducts() {
  const t = await getTranslations("Catalog");

  let products: ProductCardData[];
  try {
    products = await getLatestProducts();
  } catch {
    return <p className="type-body text-ink-secondary">{t("loadError")}</p>;
  }
  if (products.length === 0) return null;

  return (
    <div className={GRID}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

function LatestSkeleton() {
  return (
    <div className={GRID}>
      {Array.from({ length: 8 }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

function SectionHeading({ id, title, text, href, link }: { id: string; title: string; text: string; href: string; link: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-gold pb-3">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="type-h2 text-ink">
          {title}
        </h2>
        <p className="type-body text-ink-secondary">{text}</p>
      </div>
      <Link href={href} className="type-body-medium flex shrink-0 items-center gap-1 text-brand underline-offset-4 hover:underline">
        {link}
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const tCatalog = await getTranslations("Catalog");
  const tMarket = await getTranslations("Market");

  const features = [
    { title: t("verifiedTitle"), text: t("verifiedText") },
    { title: t("compareTitle"), text: t("compareText") },
    { title: t("bargainTitle"), text: t("bargainText") },
  ];

  return (
    <div className="flex flex-col gap-14 md:gap-20">
      <section className="flex flex-col items-center gap-6 pt-4 text-center md:gap-8 md:pt-10">
        <h1 className="type-display max-w-3xl text-ink">{t("heroTitle")}</h1>
        <p className="type-body max-w-xl text-ink-secondary">{t("heroText")}</p>
        <Link
          href="/search"
          className="type-body-medium flex h-12 w-full items-center justify-center rounded-sm bg-action px-8 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:w-fit"
        >
          {t("cta")}
        </Link>
        <Arcade className="max-w-3xl" />
      </section>

      <section aria-labelledby="markets-title" className="flex flex-col gap-5">
        <SectionHeading
          id="markets-title"
          title={tMarket("homeTitle")}
          text={tMarket("homeText")}
          href="/markets"
          link={tMarket("viewAll")}
        />
        <Suspense fallback={<MarketDoorsSkeleton />}>
          <MarketDoors />
        </Suspense>
      </section>

      <section aria-labelledby="latest-title" className="flex flex-col gap-5">
        <SectionHeading
          id="latest-title"
          title={tCatalog("latestTitle")}
          text={tCatalog("latestText")}
          href="/search"
          link={tCatalog("seeAll")}
        />
        <Suspense fallback={<LatestSkeleton />}>
          <LatestProducts />
        </Suspense>
      </section>

      <section className="grid gap-10 md:grid-cols-3">
        {features.map(({ title, text }) => (
          <div key={title} className="flex flex-col gap-2 border-t border-gold pt-5">
            <h2 className="type-h3 text-ink">{title}</h2>
            <p className="type-body text-ink-secondary">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}