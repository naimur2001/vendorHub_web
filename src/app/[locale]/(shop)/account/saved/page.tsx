import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AccountBack } from "@/components/layout/account-menu";
import { SavedItems } from "@/components/wishlist/saved-items";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Wishlist" });
  // Personal page: never indexed.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function SavedPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Wishlist");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <AccountBack />
      <h1 className="type-display text-ink">{t("title")}</h1>
      {/* Reads ?page= from the URL */}
      <Suspense fallback={<div className="h-64 skeleton rounded-md" aria-hidden />}>
        <SavedItems />
      </Suspense>
    </div>
  );
}
