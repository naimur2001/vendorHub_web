import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { MyOrders } from "@/components/account/my-orders";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "MyOrders" });
  // Personal page: never indexed.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function MyOrdersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("MyOrders");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="type-display text-ink">{t("title")}</h1>
      {/* The list reads ?status= and ?page= from the URL, which needs a Suspense boundary */}
      <Suspense fallback={<div className="h-64 skeleton rounded-md" aria-hidden />}>
        <MyOrders />
      </Suspense>
    </div>
  );
}