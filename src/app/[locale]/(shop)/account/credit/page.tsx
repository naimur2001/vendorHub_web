import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CreditView } from "@/components/account/credit-view";

type Props = { params: Promise<{ locale: string }> };
export const metadata = { robots: { index: false, follow: false } };

export default async function CreditPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Credit");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="type-display text-ink">{t("title")}</h1>
        <p className="type-body text-ink-secondary">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<div className="h-64 skeleton rounded-md" aria-hidden />}>
        <CreditView />
      </Suspense>
    </div>
  );
}
