import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReturnList } from "@/components/returns/return-list";

type Props = { params: Promise<{ locale: string }> };
export const instant = false;

export default async function AdminDisputesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Returns");
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1"><h1 className="type-display text-ink">{t("disputesTitle")}</h1><p className="type-body text-ink-secondary">{t("disputesSubtitle")}</p></header>
      <ReturnList scope={{ kind: "disputes" }} defaultFilter="ESCALATED" />
    </div>
  );
}