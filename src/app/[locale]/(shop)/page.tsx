import { getTranslations, setRequestLocale } from "next-intl/server";
import { Arcade } from "@/components/brand/arcade";
import { Link } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

// Home page until the browsing screens (search, products, markets) exist.
export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  const features = [
    { title: t("verifiedTitle"), text: t("verifiedText") },
    { title: t("compareTitle"), text: t("compareText") },
    { title: t("bargainTitle"), text: t("bargainText") },
  ];

  return (
    <div className="flex flex-col gap-14 md:gap-20">
      <section className="flex flex-col items-center gap-6 pt-4 text-center md:gap-8 md:pt-10">
        <h1 className="type-display max-w-3xl text-ink">{t("heroTitle")}</h1>
        <p className="type-body max-w-xl text-ink-secondary">{t("heroText")}</p>
        <Link
          href="/search"
          className="type-body-medium flex h-12 w-full items-center justify-center rounded-sm bg-action px-8 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:w-fit"
        >
          {t("cta")}
        </Link>
        <Arcade className="max-w-3xl" />
      </section>

      <section className="grid gap-10 md:grid-cols-3">
        {features.map(({ title, text }) => (
          <div key={title} className="flex flex-col gap-2 border-t border-gold pt-5">
            <h2 className="type-h3 text-ink">{title}</h2>
            <p className="type-body text-ink-secondary">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}