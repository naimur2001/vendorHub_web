import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AccountBack } from "@/components/layout/account-menu";
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
      <AccountBack />
      {/* Header: eyebrow, title and a gold rule that draws itself once */}
      <header className="relative flex flex-col gap-2 pb-4">
        <span className="type-caption font-medium tracking-[0.2em] text-highlight uppercase">{t("eyebrow")}</span>
        <h1 className="type-display text-ink">{t("title")}</h1>
        <p className="type-body max-w-xl text-ink-secondary">{t("subtitle")}</p>
        <span aria-hidden className="absolute bottom-0 left-0 h-px w-full origin-left bg-gold motion-safe:animate-[vh-draw-x_300ms_cubic-bezier(0.65,0,0.35,1)_backwards]" />
        <span aria-hidden className="absolute -bottom-1 left-0 size-2 rotate-45 bg-gold" />
      </header>
      {/* The list reads ?status= and ?page= from the URL, which needs a Suspense boundary */}
      <Suspense fallback={<div className="h-64 skeleton rounded-md" aria-hidden />}>
        <MyOrders />
      </Suspense>
    </div>
  );
}