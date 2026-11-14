import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { MarketCard } from "@/components/shop/market-cards";
import { getMarkets } from "@/lib/api/catalog-cache";
import type { Market } from "@/lib/api/shops";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Market" });
  return { title: t("metaTitle"), description: t("subtitle") };
}

// From the 10-minute cache (shared with the search filters).
async function MarketList() {
  const t = await getTranslations("Market");

  let markets: Market[];
  try {
    markets = await getMarkets();
  } catch {
    return (
      <p role="alert" className="type-body text-ink-secondary">
        {t("loadError")}
      </p>
    );
  }
  if (markets.length === 0) return <p className="type-body text-ink-secondary">{t("empty")}</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {markets.map((market) => (
        <MarketCard key={market.id} market={market} />
      ))}
    </div>
  );
}

function MarketListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="h-48 skeleton rounded-md" />
      ))}
    </div>
  );
}

export default async function MarketsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Market");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 border-b border-gold pb-5">
        <h1 className="type-display text-ink">{t("title")}</h1>
        <p className="type-body max-w-2xl text-ink-secondary">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<MarketListSkeleton />}>
        <MarketList />
      </Suspense>
    </div>
  );
}