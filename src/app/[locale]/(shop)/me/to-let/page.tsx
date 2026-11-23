import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { MyToLet } from "@/components/to-let/to-let-manage";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ToLetManage" });
  return { title: t("mineTitle"), robots: { index: false, follow: false } };
}

export default async function MyToLetPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ToLetManage");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="type-display text-ink">{t("mineTitle")}</h1>
        <p className="type-body text-ink-secondary">{t("subtitle")}</p>
      </header>
      {/* the logged-in owner's listings */}
      <Suspense fallback={<div className="h-96 skeleton rounded-md" aria-hidden />}>
        <MyToLet />
      </Suspense>
    </div>
  );
}
