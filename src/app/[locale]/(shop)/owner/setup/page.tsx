import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SetupWizard } from "@/components/owner/setup-wizard";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "OwnerSetup" });
  // Private page for one owner: never indexed.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function OwnerSetupPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("OwnerSetup");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="type-h2 text-ink">{t("title")}</h1>
        <p className="type-body text-ink-secondary">{t("subtitle")}</p>
      </header>
      <SetupWizard />
    </div>
  );
}