import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getProductReviews, type ReviewSummary } from "@/lib/api/product-reviews";
import { shortName } from "@/lib/api/storefront";
import { cn } from "@/lib/utils";

function Stars({ rating }: { rating: number }) {
  const t = useTranslations("ProductReviews");
  const value = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <span role="img" aria-label={t("stars", { rating: value })} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className={cn("size-4", n <= value ? "fill-highlight text-highlight" : "text-line-strong")} />
      ))}
    </span>
  );
}

function Summary({ summary }: { summary: ReviewSummary }) {
  const t = useTranslations("ProductReviews");
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex flex-col items-start gap-1">
        <span className="font-heading text-[2.5rem] leading-none text-ink">{summary.average?.toFixed(1)}</span>
        <Stars rating={summary.average ?? 0} />
        <span className="type-caption text-ink-muted">{t("count", { count: summary.count })}</span>
      </div>
      <ul className="flex flex-1 flex-col gap-1">
        {(["5", "4", "3", "2", "1"] as const).map((s) => {
          const count = summary.distribution[s] ?? 0;
          const width = summary.count > 0 ? Math.round((count / summary.count) * 100) : 0;
          return (
            <li key={s} className="flex items-center gap-2" aria-label={t("bar", { stars: s, count })}>
              <span aria-hidden className="type-caption w-6 text-ink-secondary">{s}★</span>
              <span aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-subtle">
                <span className="block h-full rounded-full bg-highlight" style={{ width: `${width}%` }} />
              </span>
              <span aria-hidden className="type-caption w-6 text-right text-ink-muted">{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Product page: summary + the newest reviews. Silent "couldn't load" if the API fails. */
export async function ProductReviews({ slug }: { slug: string }) {
  const t = await getTranslations("ProductReviews");
  const format = await getFormatter();

  let data;
  try {
    data = await getProductReviews(slug);
  } catch {
    return <p className="type-body text-ink-muted">{t("loadError")}</p>;
  }
  const { items, summary, total } = data;

  return (
    <section aria-labelledby="reviews-heading" className="flex flex-col gap-5 border-t border-gold pt-6">
      <h2 id="reviews-heading" className="type-h2 text-ink">{t("title")}</h2>
      {!summary || summary.count === 0 ? (
        <p className="type-body text-ink-secondary">{t("empty")}</p>
      ) : (
        <>
          <Summary summary={summary} />
          <ul className="flex flex-col">
            {items.map((r) => (
              <li key={r.id} className="flex flex-col gap-1.5 border-t border-line py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Stars rating={r.rating} />
                  <span className="type-caption text-ink-muted">{format.dateTime(new Date(r.createdAt), { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                {/* Customer text: plain text, React escapes it */}
                {r.comment && <p className="type-body whitespace-pre-line text-ink">{r.comment}</p>}
                <p className="type-caption text-ink-secondary">
                  — {r.reviewer ? shortName(r.reviewer) : ""}
                  {r.shop && (
                    <>
                      {" · "}
                      <Link href={`/shops/${r.shop.slug}`} className="underline-offset-4 hover:underline">{t("boughtAt", { shop: r.shop.name })}</Link>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
          {total > items.length && <p className="type-caption text-ink-muted">{t("showing", { shown: items.length, total })}</p>}
        </>
      )}
    </section>
  );
}