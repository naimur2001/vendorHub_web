import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Register" });
  return { title: t("metaTitle") };
}

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Register");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 text-center lg:text-left">
        <h1 className="type-h2 text-ink">{t("title")}</h1>
        <p className="type-body text-ink-secondary">{t("subtitle")}</p>
      </header>
      {/* The form reads ?next= from the URL, which needs a Suspense boundary */}
      <Suspense fallback={<div className="h-[32rem]" aria-hidden />}>
        <RegisterForm role="CUSTOMER" />
      </Suspense>
    </div>
  );
}