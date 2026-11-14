import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { MarketBrowser } from "@/components/shop/market-browser";
import { getMarkets } from "@/lib/api/catalog-cache";
import type { Market } from "@/lib/api/shops";
import { findMarkets } from "@/lib/api/storefront";
import { isDistrict, type District } from "@/lib/districts";

type RawParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<RawParams> };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Market" });
  return { title: t("metaTitle"), description: t("subtitle") };
}

// /markets?district=sylhet&q=city. The full list comes from the 10-minute cache (shared with the
// search filters) and gives the district chips; a filtered list is asked from the API.
async function MarketList({ searchParams }: { searchParams: Promise<RawParams> }) {
  const t = await getTranslations("Market");
  const raw = await searchParams;

  // Only a known district key and a short text ever reach the API.
  const districtParam = first(raw.district);
  const district = isDistrict(districtParam) ? districtParam : undefined;
  const q = (first(raw.q) ?? "").trim().slice(0, 100);

  let all: Market[];
  let found: Market[];
  try {
    all = await getMarkets();
    // A list cached before markets had districts: ask the API directly until the cache renews.
    if (all.some((market) => !isDistrict(market.district))) all = await findMarkets({});
    found = district || q ? await findMarkets({ district, q }) : all;
  } catch {
    return (
      <p role="alert" className="type-body text-ink-secondary">
        {t("loadError")}
      </p>
    );
  }
  if (all.length === 0) return <p className="type-body text-ink-secondary">{t("empty")}</p>;

  const counts = new Map<District, number>();
  for (const market of all) {
    if (isDistrict(market.district)) counts.set(market.district, (counts.get(market.district) ?? 0) + 1);
  }
  const districts = [...counts].map(([key, count]) => ({ key, count }));

  return <MarketBrowser markets={found} districts={districts} total={all.length} district={district} q={q} />;
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

export default async function MarketsPage({ params, searchParams }: Props) {
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
        <MarketList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
