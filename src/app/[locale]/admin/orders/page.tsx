import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { OrderMonitor } from "@/components/admin/order-monitor";

type Props = { params: Promise<{ locale: string }> };

// Admin frame checks the role first: no instant navigation pre-check.
export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AdminOrders" });
  return { title: t("title") };
}

export default async function AdminOrdersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("AdminOrders");
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="type-display text-ink">{t("title")}</h1>
        <p className="type-body text-ink-secondary">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<div className="h-64 skeleton rounded-md" aria-hidden />}>
        <OrderMonitor />
      </Suspense>
    </div>
  );
}
