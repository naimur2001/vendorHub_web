import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ToLetBrowse } from "@/components/to-let/to-let-browse";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ToLet" });
  return { title: t("metaTitle"), description: t("subtitle") };
}

export default async function ToLetPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ToLet");
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="type-display text-ink">{t("title")}</h1>
        <p className="type-body max-w-2xl text-ink-secondary">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<div className="h-96 skeleton rounded-md" aria-hidden />}>
        <ToLetBrowse />
      </Suspense>
    </div>
  );
}
