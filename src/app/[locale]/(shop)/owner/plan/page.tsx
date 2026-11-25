import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { OwnerPlan } from "@/components/owner/owner-plan";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "OwnerPlan" });
  // Shop team page: never indexed.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function OwnerPlanPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("OwnerPlan");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="type-display text-ink">{t("title")}</h1>
        <p className="type-body text-ink-secondary">{t("subtitle")}</p>
      </header>
      {/* Reads ?shop= and shows dates, which needs a Suspense boundary */}
      <Suspense fallback={<OwnerSkeleton label={t("loading")} />}>
        <OwnerPlan />
      </Suspense>
    </div>
  );
}
