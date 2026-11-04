import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { VerificationQueue } from "@/components/admin/verification-queue";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.queue" });
  return { title: t("title") };
}

export default async function AdminQueuePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin.queue");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="type-display text-ink">{t("title")}</h1>
        <p className="type-body text-ink-secondary">{t("subtitle")}</p>
      </header>
      {/* The queue reads its filters from the URL, which needs a Suspense boundary */}
      <Suspense fallback={<OwnerSkeleton label={t("title")} />}>
        <VerificationQueue />
      </Suspense>
    </div>
  );
}