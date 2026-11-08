import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
import { ShopSettings } from "@/components/owner/shop-settings";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "OwnerSettings" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function OwnerSettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("OwnerSettings");
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="type-display text-ink">{t("title")}</h1>
        <p className="type-body text-ink-secondary">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<OwnerSkeleton label={t("loading")} />}>
        <ShopSettings />
      </Suspense>
    </div>
  );
}