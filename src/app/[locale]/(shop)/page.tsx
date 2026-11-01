import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Arcade } from "@/components/brand/arcade";
import { ProductCard, ProductCardSkeleton } from "@/components/catalog/product-card";
import { Link } from "@/i18n/routing";
import { listProducts, type ProductCardData } from "@/lib/api/catalog";

type Props = { params: Promise<{ locale: string }> };

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4";

// Loaded on the server, streamed in after the page shell (never blocks the hero).
async function LatestProducts() {
  const t = await getTranslations("Catalog");

  let products: ProductCardData[];
  try {
    products = (await listProducts({ sort: "newest", availableOnly: true, limit: 8 })).data;
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

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const tCatalog = await getTranslations("Catalog");

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

      <section aria-labelledby="latest-title" className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4 border-b border-gold pb-3">
          <div className="flex flex-col gap-1">
            <h2 id="latest-title" className="type-h2 text-ink">
              {tCatalog("latestTitle")}
            </h2>
            <p className="type-body text-ink-secondary">{tCatalog("latestText")}</p>
          </div>
          <Link href="/search" className="type-body-medium shrink-0 text-brand underline-offset-4 hover:underline">
            {tCatalog("seeAll")}
          </Link>
        </div>
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