import { ChevronRight, Handshake, Scale, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Arcade } from "@/components/brand/arcade";
import { ProductCard, ProductCardSkeleton } from "@/components/catalog/product-card";
import { CountUp } from "@/components/charts/arch-bars";
import { Reveal } from "@/components/motion/reveal";
import { MarketDoor } from "@/components/shop/market-cards";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import type { ProductCardData } from "@/lib/api/catalog";
import { getLatestProducts, getMarkets } from "@/lib/api/catalog-cache";
import type { Market } from "@/lib/api/shops";
import { OwnerStrip } from "@/components/owner/owner-strip";

type Props = { params: Promise<{ locale: string }> };

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4";
// pt-2: room for the doors to lift on hover/focus without being cut off by the scroll row.
const DOORS = "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pt-2 pb-2md:mx-0 md:grid md:grid-cols-4 md:gap-6 md:overflow-visible md:px-0";

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
        <div key={i} className="aspect-[3/4] skeleton w-44 shrink-0 rounded-t-full rounded-b-sm md:w-auto" />
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

/** Section heading; its gold underline draws from the centre outward when it scrolls into view. */
function SectionHeading({ id, title, text, href, link }: { id: string; title: string; text: string; href?: string; link?: string }) {
  return (
    <Reveal className="relative flex items-end justify-between gap-4 pb-3">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="type-h2 text-ink">
          {title}
        </h2>
        <p className="type-body text-ink-secondary">{text}</p>
      </div>
      {href && link && (
        <Link href={href} className="type-body-medium flex shrink-0 items-center gap-1 text-brand underline-offset-4 hover:underline">
          {link}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
      <span aria-hidden className="line-grow absolute inset-x-0 bottom-0 h-px bg-gold" />
    </Reveal>
  );
}

// Real numbers from the market cache: how many markets and shops are on the site. They count up once.
async function MarketStats({ locale }: { locale: string }) {
  const t = await getTranslations("Home");
  let markets: Market[];
  try {
    markets = await getMarkets();
  } catch {
    return null;
  }
  const shops = markets.reduce((sum, market) => sum + market.shopCount, 0);
  if (markets.length === 0 || shops === 0) return null;

  const stats = [
    { label: t("statsMarkets"), value: markets.length },
    { label: t("statsShops"), value: shops },
  ];
  return (
    <dl className="hero-after flex items-stretch justify-center gap-8 md:gap-14">
      {stats.map(({ label, value }, i) => (
        <div key={label} className={cn("flex flex-col-reverse items-center gap-1", i > 0 && "border-l border-gold pl-8 md:pl-14")}>
          <dt className="type-caption tracking-[0.12em] text-ink-muted uppercase">{label}</dt>
          <dd className="font-heading text-[2.5rem] leading-none text-brand md:text-[3rem]">
            <CountUp value={value} locale={locale} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const tCatalog = await getTranslations("Catalog");
  const tMarket = await getTranslations("Market");

  const features = [
    { icon: ShieldCheck, title: t("verifiedTitle"), text: t("verifiedText") },
    { icon: Scale, title: t("compareTitle"), text: t("compareText") },
    { icon: Handshake, title: t("bargainTitle"), text: t("bargainText") },
  ];
  const steps = [
    { title: t("step1Title"), text: t("step1Text") },
    { title: t("step2Title"), text: t("step2Text") },
    { title: t("step3Title"), text: t("step3Text") },
  ];
  const stepNumber = new Intl.NumberFormat(locale);

  return (
    <div className="flex flex-col gap-14 md:gap-20">
            {/* Owners and staff only: their shop's to-dos (renders nothing for everyone else) */}
      <OwnerStrip />
      <section className="flex flex-col items-center gap-6 pt-4 text-center md:gap-8 md:pt-10">
        {/* Words rise in one by one (whole words only, so Bangla letters are never split) */}
        <h1 className="type-display no-wipe max-w-3xl text-ink">
          {t("heroTitle")
            .split(" ")
            .filter(Boolean)
            .flatMap((word, i) => [
              i > 0 ? " " : null,
              <span key={i} className="hero-word">
                {word}
              </span>,
            ])}
        </h1>
        <p className="type-body hero-after max-w-xl text-ink-secondary">{t("heroText")}</p>
        <Link
          href="/search"
          className="type-body-medium hero-after flex h-12 w-full items-center justify-center rounded-sm bg-action px-8 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:w-fit"
        >
          {t("cta")}
        </Link>
        <Arcade animated className="max-w-3xl" />
        {/* Fixed height, so the numbers arriving never push the page down */}
        <div className="flex min-h-[4.5rem] items-center md:min-h-[5rem]">
          <Suspense>
            <MarketStats locale={locale} />
          </Suspense>
        </div>
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

      {/* How it works: three numbered arches that grow up as you reach them, joined by a gold line */}
      <section aria-labelledby="how-title" className="flex flex-col gap-8">
        <SectionHeading id="how-title" title={t("howTitle")} text={t("howText")} />
        <div className="relative">
          <Reveal className="absolute inset-x-[16.6%] top-8 hidden md:block">
            <span aria-hidden className="line-grow block h-px bg-gold" />
          </Reveal>
          <ol className="relative grid gap-8 md:grid-cols-3 md:gap-6">
            {steps.map(({ title, text }, i) => (
              <li key={title}>
                <Reveal className="flex gap-4 md:flex-col md:items-center md:text-center">
                  <span
                    aria-hidden
                    className="arch-up relative flex h-16 w-12 shrink-0 items-end justify-center rounded-t-full rounded-b-sm bg-brand pb-2 font-heading text-[1.375rem] leading-none text-primary-foreground shadow-card"
                  >
                    <span className="absolute top-1 left-1/2 h-2 w-1.5 -translate-x-1/2 bg-gold [clip-path:polygon(0_0,100%_0,78%_100%,22%_100%)]" />
                    {stepNumber.format(i + 1)}
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="type-h3 text-ink">{title}</h3>
                    <p className="type-body text-ink-secondary">{text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Why Vendors Hub: three cards, each icon pops in once its card has arrived */}
      <section className="grid gap-4 md:grid-cols-3 md:gap-6">
        {features.map(({ icon: Icon, title, text }) => (
          <Reveal key={title} className="flex">
            <div className="flex w-full flex-col gap-3 rounded-md border border-line bg-card p-5 shadow-card">
              <span className="reveal-pop flex size-12 items-center justify-center rounded-full border border-gold bg-highlight-soft text-highlight">
                <Icon className="size-6" strokeWidth={1.5} aria-hidden />
              </span>
              <h2 className="type-h3 text-ink">{title}</h2>
              <p className="type-body text-ink-secondary">{text}</p>
            </div>
          </Reveal>
        ))}
      </section>

      {/* Closing invitation: a bordeaux hall with two gold arches drawn at its sides */}
      <Reveal>
        <section
          aria-labelledby="closing-title"
          className="relative isolate flex flex-col items-center gap-4 overflow-hidden rounded-md bg-brand px-6 py-12 text-center md:py-16"
        >
          <span aria-hidden className="arch-up absolute bottom-0 -left-6 -z-10 h-[85%] w-32 rounded-t-full border border-b-0 border-gold/50 md:left-10 md:w-40" />
          <span aria-hidden className="arch-up absolute -right-6 bottom-0 -z-10 h-[85%] w-32 rounded-t-full border border-b-0 border-gold/50 md:right-10 md:w-40" />
          <h2 id="closing-title" className="type-h2 text-primary-foreground">
            {t("closingTitle")}
          </h2>
          <p className="type-body max-w-md text-primary-foreground/85">{t("closingText")}</p>
          <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/search"
              className="type-body-medium flex h-12 items-center justify-center rounded-sm bg-card px-8 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-brand focus-visible:outline-none"
            >
              {t("cta")}
            </Link>
            <Link
              href="/markets"
              className="type-body-medium flex h-12 items-center justify-center rounded-sm border border-gold px-8 text-primary-foreground hover:bg-brand-alt focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-brand focus-visible:outline-none"
            >
              {t("closingMarkets")}
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}