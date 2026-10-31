import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Register" });
  return { title: t("shopMetaTitle") };
}

export default async function RegisterShopPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Register");

  // A real sequence, so numbered steps are the right device here.
  const steps = [t("step1"), t("step2"), t("step3"), t("step4")];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 text-center lg:text-left">
        <h1 className="type-h2 text-ink">{t("shopTitle")}</h1>
        <p className="type-body text-ink-secondary">{t("shopSubtitle")}</p>
      </header>

      <section aria-labelledby="steps-title" className="flex flex-col gap-3 border-y border-gold py-5">
        <h2 id="steps-title" className="type-h3 text-ink">
          {t("stepsTitle")}
        </h2>
        <ol className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="w-5 shrink-0 font-heading text-[1.3125rem] leading-6 text-highlight" aria-hidden>
                {i + 1}
              </span>
              <span className="type-body text-ink-secondary">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <Suspense fallback={<div className="h-[32rem]" aria-hidden />}>
        <RegisterForm role="SHOP_OWNER" />
      </Suspense>
    </div>
  );
}