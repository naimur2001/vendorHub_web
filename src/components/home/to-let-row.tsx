import { CalendarDays, ChevronRight, KeyRound, Ruler } from "lucide-react";
import Image from "next/image";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getHomeToLet, type HomeToLet } from "@/lib/api/catalog-cache";
import { safeMediaUrl } from "@/lib/api/storefront";
import { formatTaka } from "@/lib/format";

/** Home page advert for people looking for a shop to rent. Hidden when nothing is listed. */
export async function ToLetRow() {
  const t = await getTranslations("ToLetHome");
  const tL = await getTranslations("ToLet");
  let items: HomeToLet[];
  try {
    items = await getHomeToLet();
  } catch {
    return null;
  }
  if (items.length === 0) return null;
  const locale = await getLocale();
  const format = await getFormatter();

  return (
    <section aria-labelledby="tolet-home" className="flex flex-col gap-5 rounded-md bg-brand p-5 text-primary-foreground md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id="tolet-home" className="type-h2 flex items-center gap-2">
            <KeyRound className="size-6 text-gold" aria-hidden />
            {t("title")}
          </h2>
          <p className="type-body max-w-xl text-primary-foreground/85">{t("text")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/to-let" className="type-body-medium inline-flex h-11 items-center gap-1 rounded-sm bg-card px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-brand focus-visible:outline-none">
            {t("seeAll")}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
          <Link href="/to-let/new" className="type-body-medium inline-flex h-11 items-center rounded-sm border border-gold px-4 text-primary-foreground hover:bg-brand-alt focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-brand focus-visible:outline-none">
            {t("listYours")}
          </Link>
        </div>
      </div>
      <ul className="scroll-row -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 md:-mx-8 md:px-8">
        {items.map((l) => {
          const cover = safeMediaUrl(l.cover?.thumbUrl) ?? safeMediaUrl(l.cover?.url);
          return (
            <li key={l.id} className="w-60 shrink-0 snap-start">
              <Link href={`/to-let/${l.slug}`} className="group flex h-full flex-col overflow-hidden rounded-md bg-card text-ink shadow-card focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none">
                <span className="relative block aspect-4/3 bg-highlight-soft">
                  {cover ? (
                    <Image src={cover} alt="" fill unoptimized sizes="240px" className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" />
                  ) : (
                    <KeyRound className="absolute inset-0 m-auto size-10 text-highlight" strokeWidth={1.25} aria-hidden />
                  )}
                  <span className="type-caption absolute top-2 left-2 rounded-full bg-gold px-2 py-0.5 font-medium text-ink">{tL("badge")}</span>
                </span>
                <span className="flex flex-1 flex-col gap-1 p-3">
                  <span className="type-body-medium line-clamp-2 group-hover:text-brand">{l.title}</span>
                  <span className="type-price mt-auto text-brand">{tL("perMonth", { rent: formatTaka(l.monthlyRent, locale) })}</span>
                  <span className="type-caption flex flex-wrap gap-x-3 text-ink-secondary">
                    <span className="inline-flex items-center gap-1"><Ruler className="size-3.5" aria-hidden />{tL("sqft", { size: format.number(l.sizeSqft) })}</span>
                    {l.availableFrom && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3.5" aria-hidden />
                        {tL("from", { date: format.dateTime(new Date(`${l.availableFrom}T12:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" }) })}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
