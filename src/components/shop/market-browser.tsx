"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Stagger } from "@/components/motion/stagger";
import { MarketCard } from "@/components/shop/market-cards";
import { Link, useRouter } from "@/i18n/routing";
import type { Market } from "@/lib/api/shops";
import { isDistrict, type District } from "@/lib/districts";
import { cn } from "@/lib/utils";

const TYPING_PAUSE_MS = 350;

// The filters live in the URL (/markets?district=sylhet&q=city), so a filtered list can be shared.
function marketsHref(district: District | undefined, q: string): string {
  const query = new URLSearchParams();
  if (district) query.set("district", district);
  if (q) query.set("q", q);
  const text = query.toString();
  return text ? `/markets?${text}` : "/markets";
}

type Props = {
  /** What the API found for the current filters. */
  markets: Market[];
  /** Districts that have at least one market, with how many (for the chips). */
  districts: { key: District; count: number }[];
  total: number;
  district?: District;
  q: string;
};

/** /markets: a search by name, district chips, and the markets found, grouped by district. */
export function MarketBrowser({ markets, districts, total, district, q }: Props) {
  const t = useTranslations("Market");
  const tDistrict = useTranslations("Districts");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The box shows what is being typed. When the URL changes for another reason (back button,
  // a district chip), it follows the URL; our own searches (sentQ) never overwrite the typing.
  const [text, setText] = useState(q);
  const [seenQ, setSeenQ] = useState(q);
  const [sentQ, setSentQ] = useState(q);
  if (q !== seenQ) {
    setSeenQ(q);
    if (q !== sentQ) {
      setSentQ(q);
      setText(q);
    }
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function search(value: string) {
    if (timer.current) clearTimeout(timer.current);
    const next = value.trim().slice(0, 100);
    if (next === sentQ) return;
    setSentQ(next);
    startTransition(() => router.replace(marketsHref(district, next), { scroll: false }));
  }

  // Searches by itself after a short pause in typing (or at once on Enter).
  function onType(value: string) {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(value), TYPING_PAUSE_MS);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    search(text);
  }

  function clear() {
    setText("");
    search("");
  }

  const districtName = (key: District | "other") => (key === "other" ? t("otherDistrict") : tDistrict(key));

  // Chips: most markets first, then by name. A district from the URL with no market still shows.
  const chips = [...districts, ...(district && !districts.some((d) => d.key === district) ? [{ key: district, count: 0 }] : [])].sort(
    (a, b) => b.count - a.count || districtName(a.key).localeCompare(districtName(b.key), locale),
  );

  // Results by district, the district with the most markets first ("other" = an unknown key, last).
  const byDistrict = new Map<District | "other", Market[]>();
  for (const market of markets) {
    const key = isDistrict(market.district) ? market.district : "other";
    byDistrict.set(key, [...(byDistrict.get(key) ?? []), market]);
  }
  const groups = [...byDistrict]
    .map(([key, list]) => ({ key, list }))
    .sort((a, b) => {
      if (a.key === "other" || b.key === "other") return a.key === b.key ? 0 : a.key === "other" ? 1 : -1;
      return b.list.length - a.list.length || districtName(a.key).localeCompare(districtName(b.key), locale);
    });

  const filtered = Boolean(district || q);
  const emptyText =
    district && q
      ? t("noMatchIn", { q, district: districtName(district) })
      : district
        ? t("noneInDistrict", { district: districtName(district) })
        : t("noMatch", { q });

  const chip = (active: boolean) =>
    cn(
      "type-body-medium flex h-11 items-center gap-2 rounded-full border px-4 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
      active ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand",
    );
  const chipCount = (active: boolean) => cn("type-caption", active ? "text-primary-foreground/80" : "text-ink-muted");

  return (
    <div className="flex flex-col gap-5">
      <form role="search" onSubmit={onSubmit} className="flex max-w-xl flex-col gap-1.5">
        <label htmlFor={`${id}-q`} className="type-body-medium text-ink">
          {t("searchLabel")}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            id={`${id}-q`}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            maxLength={100}
            value={text}
            onChange={(e) => onType(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="type-body h-12 w-full rounded-md border border-input bg-card pr-12 pl-10 text-ink placeholder:text-ink-muted hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {isPending ? (
            <span className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-muted">
              <LoaderCircle className="size-5 animate-spin" aria-hidden />
            </span>
          ) : (
            text && (
              <button
                type="button"
                onClick={clear}
                aria-label={t("clearSearch")}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md text-ink-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                <X className="size-5" aria-hidden />
              </button>
            )
          )}
        </div>
        {/* Always in the page, so screen readers hear the count change */}
        <p role="status" className="type-caption min-h-5 text-ink-muted">
          {filtered && !isPending ? t("resultCount", { count: markets.length }) : ""}
        </p>
      </form>

      {chips.length > 1 && (
        <nav aria-label={t("districtFilter")}>
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link href={marketsHref(undefined, q)} scroll={false} aria-current={district ? undefined : "true"} className={chip(!district)}>
                {t("allDistricts")}
                <span className={chipCount(!district)}>{format.number(total)}</span>
              </Link>
            </li>
            {chips.map(({ key, count }) => (
              <li key={key}>
                <Link href={marketsHref(key, q)} scroll={false} aria-current={district === key ? "true" : undefined} className={chip(district === key)}>
                  {districtName(key)}
                  <span className={chipCount(district === key)}>{format.number(count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div aria-busy={isPending} className={cn("flex flex-col gap-8 motion-safe:transition-opacity motion-safe:duration-200", isPending && "opacity-60")}>
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center">
            <p className="type-body text-ink-secondary">{emptyText}</p>
            <Link
              href="/markets"
              scroll={false}
              className="type-body-medium flex h-11 items-center rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {t("showAll")}
            </Link>
          </div>
        ) : (
          groups.map(({ key, list }) => (
            <section key={key} aria-labelledby={`${id}-${key}`} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
                <h2 id={`${id}-${key}`} className="type-h3 text-ink">
                  {districtName(key)}
                </h2>
                <span className="type-caption shrink-0 text-ink-muted">{t("marketCount", { count: list.length })}</span>
              </div>
              <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((market) => (
                  <MarketCard key={market.id} market={market} />
                ))}
              </Stagger>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
