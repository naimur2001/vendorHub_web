import { getTranslations, setRequestLocale } from "next-intl/server";
import { MyReturns } from "@/components/returns/return-list";

type Props = { params: Promise<{ locale: string }> };
export const metadata = { robots: { index: false, follow: false } };

export default async function MyReturnsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Returns");
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-1"><h1 className="type-display text-ink">{t("myTitle")}</h1><p className="type-body text-ink-secondary">{t("mySubtitle")}</p></header>
      <MyReturns />
    </div>
  );
}