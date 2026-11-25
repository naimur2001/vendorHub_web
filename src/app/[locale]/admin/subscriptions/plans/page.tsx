import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { SubscriptionPlans } from "@/components/admin/subscription-plans";
import { Link } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

// The admin frame shows its content only after confirming the visitor is an admin,
// so this page can't be pre-checked for instant navigation (and doesn't need it).
export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AdminSubscriptions" });
  return { title: t("plans.metaTitle") };
}

export default async function AdminSubscriptionPlansPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("AdminSubscriptions");
  const tab = "type-body-medium flex h-11 items-center rounded-full border px-4 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="type-display text-ink">{t("title")}</h1>
        <p className="type-body text-ink-secondary">{t("subtitle")}</p>
      </header>
      <nav aria-label={t("sections")} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-2">
          <li><Link href="/admin/subscriptions" className={`${tab} border-line-strong bg-card text-ink hover:border-brand`}>{t("tabOverview")}</Link></li>
          <li><Link href="/admin/subscriptions/plans" aria-current="page" className={`${tab} border-brand bg-brand text-primary-foreground`}>{t("tabPlans")}</Link></li>
        </ul>
      </nav>
      <Suspense fallback={<div className="h-64 skeleton rounded-md" aria-hidden />}>
        <SubscriptionPlans />
      </Suspense>
    </div>
  );
}
