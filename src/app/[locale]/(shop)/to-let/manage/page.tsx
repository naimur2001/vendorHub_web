import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ManageByToken } from "@/components/to-let/to-let-manage";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ToLetManage" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function ManageToLetPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ToLetManage");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="type-display text-ink">{t("title")}</h1>
        <p className="type-body text-ink-secondary">{t("subtitle")}</p>
      </header>
      {/* reads ?token= (the private link from the email) */}
      <Suspense fallback={<div className="h-96 skeleton rounded-md" aria-hidden />}>
        <ManageByToken />
      </Suspense>
    </div>
  );
}
