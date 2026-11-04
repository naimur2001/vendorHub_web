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
    <div className="flex flex-col gap-6">
      {/* Same header as the other owner tabs: large title on the left, one line under it */}
      <header className="flex flex-col gap-1">
        <h1 className="type-display text-ink">{t("title")}</h1>
        <p className="type-body text-ink-secondary">{t("subtitle")}</p>
      </header>
      {/* The wizard keeps a comfortable form width, aligned left under the title */}
      <div className="w-full max-w-2xl">
        <SetupWizard />
      </div>
    </div>
  );
}