import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ResetForm } from "@/components/auth/reset-form";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Reset" });
  return {
    title: t("metaTitle"),
    // The URL carries a secret token: never send it to other sites, never index the page.
    referrer: "no-referrer",
    robots: { index: false, follow: false },
  };
}

export default async function ResetPasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Reset");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 text-center lg:text-left">
        <h1 className="type-h2 text-ink">{t("title")}</h1>
        <p className="type-body text-ink-secondary">{t("subtitle")}</p>
      </header>
      {/* The form reads ?token= from the URL, which needs a Suspense boundary */}
      <Suspense fallback={<div className="h-48" aria-hidden />}>
        <ResetForm />
      </Suspense>
    </div>
  );
}