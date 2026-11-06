import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuditLog } from "@/components/admin/audit-log";

type Props = { params: Promise<{ locale: string }> };

export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AdminAudit" });
  return { title: t("metaTitle") };
}

export default async function AdminAuditPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("AdminAudit");
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="type-display text-ink">{t("title")}</h1>
        <p className="type-body text-ink-secondary">{t("subtitle")}</p>
      </header>
      <AuditLog />
    </div>
  );
}