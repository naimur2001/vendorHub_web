import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { DeliveryMonitor } from "@/components/admin/delivery-monitor";
import { Link } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

// Admin frame checks the role first: no instant navigation pre-check.
export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AdminDeliveryMonitor" });
  return { title: t("title") };
}

export default async function AdminDeliveryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("AdminDeliveryMonitor");
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="type-display text-ink">{t("title")}</h1>
          <p className="type-body text-ink-secondary">{t("subtitle")}</p>
        </div>
        <Link href="/admin/delivery/settings" className="type-body-medium inline-flex h-11 items-center rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
          {t("settingsLink")}
        </Link>
      </header>
      {/* The monitor reads "today" in Dhaka time, so it sits inside Suspense */}
      <Suspense fallback={<div className="h-96 skeleton rounded-md" aria-hidden />}>
        <DeliveryMonitor />
      </Suspense>
    </div>
  );
}
