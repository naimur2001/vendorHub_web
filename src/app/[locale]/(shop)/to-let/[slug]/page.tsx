import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ToLetDetailView } from "@/components/to-let/to-let-detail";
import { Link } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string; slug: string }> };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ToLet" });
  return { title: t("metaTitle") };
}

async function View({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  // Checked before anything reaches the API.
  if (slug.length > 160 || !SLUG.test(slug)) notFound();
  const t = await getTranslations("ToLet");
  return (
    <>
      <Link href="/to-let" className="type-body-medium self-start text-brand underline-offset-4 hover:underline">← {t("backToList")}</Link>
      <ToLetDetailView slug={slug} />
    </>
  );
}

export default function ToLetDetailPage({ params }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<div className="h-96 skeleton rounded-md" aria-hidden />}>
        <View params={params} />
      </Suspense>
    </div>
  );
}
