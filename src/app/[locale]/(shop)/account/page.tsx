import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AccountPanel } from "@/components/layout/account-menu";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });
  // Personal page: never indexed.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Account");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="type-h2 text-ink">{t("title")}</h1>
      <AccountPanel />
    </div>
  );
}