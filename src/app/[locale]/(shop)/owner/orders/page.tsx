import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { OrderQueue } from "@/components/owner/order-queue";
import { Link } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "OwnerOrders" });
  // Shop team page: never indexed.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function OwnerOrdersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("OwnerOrders");
  const tDashboard = await getTranslations("OwnerDashboard");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/owner"
          className="type-body-medium flex items-center gap-1 self-start rounded-sm text-ink-secondary hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {tDashboard("back")}
        </Link>
        <h1 className="type-display text-ink">{t("title")}</h1>
        <p className="type-body text-ink-secondary">{t("subtitle")}</p>
      </header>
      {/* The list reads ?shop=, ?status= and ?page= from the URL, which needs a Suspense boundary */}
      <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-subtle" aria-hidden />}>
        <OrderQueue />
      </Suspense>
    </div>
  );
}