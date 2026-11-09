import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ShopReturns } from "@/components/returns/return-list";

type Props = { params: Promise<{ locale: string }> };
export const metadata = { robots: { index: false, follow: false } };

export default async function OwnerReturnsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Returns");
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1"><h1 className="type-display text-ink">{t("shopTitle")}</h1><p className="type-body text-ink-secondary">{t("shopSubtitle")}</p></header>
      <Suspense fallback={null}><ShopReturns /></Suspense>
    </div>
  );
}