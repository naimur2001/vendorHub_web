import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { InquiryFollow } from "@/components/to-let/inquiry-follow";

type Props = { params: Promise<{ locale: string; id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ToLet" });
  // Private page: never indexed.
  return { title: t("threadTitle"), robots: { index: false, follow: false } };
}

async function View({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!UUID.test(id)) notFound();
  return <InquiryFollow inquiryId={id} />;
}

export default function InquiryPage({ params }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {/* reads ?token= */}
      <Suspense fallback={<div className="h-64 skeleton rounded-md" aria-hidden />}>
        <View params={params} />
      </Suspense>
    </div>
  );
}
