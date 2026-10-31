import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

const ARCH_X = [45, 235, 425, 615, 805];

// A shopping arcade: five arches under one cornice. The centre arch is the shop you walk into.
function Arcade() {
  return (
    <svg viewBox="0 0 1000 232" className="w-full max-w-3xl" aria-hidden="true">
      <line x1="0" y1="14" x2="1000" y2="14" strokeWidth="2" className="stroke-gold" />
      <line x1="0" y1="24" x2="1000" y2="24" strokeWidth="1" className="stroke-gold" />

      {ARCH_X.map((x, i) =>
        i === 2 ? (
          <path key={x} d={`M${x} 230 V128 A75 75 0 0 1 ${x + 150} 128 V230 Z`} className="fill-brand" />
        ) : (
          <path
            key={x}
            d={`M${x} 230 V128 A75 75 0 0 1 ${x + 150} 128 V230`}
            fill="none"
            strokeWidth="2"
            className="stroke-gold"
          />
        ),
      )}

      {/* Keystone and doorway of the centre shop */}
      <path d="M492 46 H508 L505 62 H495 Z" className="fill-gold" />
      <path d="M470 230 V182 A30 30 0 0 1 530 182 V230 Z" className="fill-surface" />

      <line x1="0" y1="231" x2="1000" y2="231" strokeWidth="2" className="stroke-gold" />
    </svg>
  );
}

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
        <Arcade />
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