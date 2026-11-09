import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminOverview } from "@/components/admin/admin-overview";

type Props = { params: Promise<{ locale: string }> };
export const instant = false;

export default async function AdminOverviewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("AdminOverview");
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1"><h1 className="type-display text-ink">{t("title")}</h1><p className="type-body text-ink-secondary">{t("subtitle")}</p></header>
      <AdminOverview />
    </div>
  );
}