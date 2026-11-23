import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
import { ShopAnalyticsView } from "@/components/owner/shop-analytics";

type Props = { params: Promise<{ locale: string }> };
export const metadata = { robots: { index: false, follow: false } };

export default async function OwnerAnalyticsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("OwnerAnalytics");
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="type-display text-ink">{t("title")}</h1>
        <p className="type-body text-ink-secondary">{t("subtitle")}</p>
      </header>
      {/* reads ?shop=: inside Suspense */}
      <Suspense fallback={<OwnerSkeleton label={t("loading")} variant="dashboard" />}>
        <ShopAnalyticsView />
      </Suspense>
    </div>
  );
}
