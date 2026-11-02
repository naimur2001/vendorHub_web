import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CartView } from "@/components/cart/cart-view";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Cart" });
  // Personal page: never indexed.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function CartPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Cart");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="type-display text-ink">{t("title")}</h1>
      <CartView />
    </div>
  );
}