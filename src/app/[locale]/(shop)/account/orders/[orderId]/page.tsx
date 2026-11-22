import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { OrderTracker } from "@/components/account/order-tracker";

type Props = { params: Promise<{ locale: string; orderId: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "OrderTracking" });
  // Personal page: never indexed.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

async function TrackingView({ params }: Props) {
  const { locale, orderId } = await params;
  setRequestLocale(locale);
  // Checked before anything reaches the API.
  if (!UUID.test(orderId)) notFound();
  return <OrderTracker orderId={orderId} />;
}

export default function OrderTrackingPage({ params }: Props) {
  // The order id is only known at request time, and the tracker reads the time.
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Suspense fallback={<div className="h-96 skeleton rounded-md" aria-hidden />}>
        <TrackingView params={params} />
      </Suspense>
    </div>
  );
}
