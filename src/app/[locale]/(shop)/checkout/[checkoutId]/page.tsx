import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { OrderConfirmation } from "@/components/checkout/order-confirmation";

type Props = { params: Promise<{ locale: string; checkoutId: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Order" });
  // Personal page: never indexed.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

async function ConfirmationView({ params }: Props) {
  const { locale, checkoutId } = await params;
  setRequestLocale(locale);
  // Checked before anything reaches the API.
  if (!UUID.test(checkoutId)) notFound();
  return <OrderConfirmation checkoutId={checkoutId} />;
}

export default function CheckoutConfirmationPage({ params }: Props) {
  // The checkout id is only known at request time, so the page waits inside Suspense.
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-subtle" aria-hidden />}>
      <ConfirmationView params={params} />
    </Suspense>
  );
}