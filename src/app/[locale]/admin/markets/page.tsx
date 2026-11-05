import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketsManager } from "@/components/admin/markets-manager";

type Props = { params: Promise<{ locale: string }> };

// The admin frame shows its content only after confirming the visitor is an admin,
// so this page can't be pre-checked for instant navigation (and doesn't need it).
export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AdminMarkets" });
  return { title: t("metaTitle") };
}

export default async function AdminMarketsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("AdminMarkets");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="type-display text-ink">{t("title")}</h1>
        <p className="type-body text-ink-secondary">{t("subtitle")}</p>
      </header>
      <MarketsManager />
    </div>
  );
}