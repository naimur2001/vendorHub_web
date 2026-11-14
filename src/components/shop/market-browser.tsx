"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Stagger } from "@/components/motion/stagger";
import { MarketCard } from "@/components/shop/market-cards";
import { Link, useRouter } from "@/i18n/routing";
import type { Market } from "@/lib/api/shops";
import { DEFAULT_DISTRICT, isDistrict, type District } from "@/lib/districts";
import { cn } from "@/lib/utils";

const TYPING_PAUSE_MS = 350;

export type DistrictChoice = District | "all";

// The filters live in the URL, so a filtered list can be shared:
// /markets (Dhaka, the default), /markets?district=sylhet&q=city, /markets?district=all.
function marketsHref(district: DistrictChoice, q: string): string {
  const query = new URLSearchParams();
  if (district !== DEFAULT_DISTRICT) query.set("district", district);
  if (q) query.set("q", q);
  const text = query.toString();
  return text ? `/markets?${text}` : "/markets";
}

type Props = {
  /** The markets for the current district and search text. */
  markets: Market[];
  /** Districts that have at least one market, with how many (for the dropdown). */
  districts: { key: District; count: number }[];
  total: number;
  district: DistrictChoice;
  q: string;
};

const fieldClass =
  "type-body h-12 w-full rounded-md border border-input bg-card text-ink placeholder:text-ink-muted hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";

/**
 * /markets: a search by name and a district dropdown (Dhaka first). Choosing a district shows
 * its markets straight away; "All districts" shows every market, grouped by district.
 */
export function MarketBrowser({ markets, districts, total, district, q }: Props) {
  const t = useTranslations("Market");
  const tDistrict = useTranslations("Districts");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The box shows what is being typed. When the URL changes for another reason (back button,
  // a link), it follows the URL; our own searches (sentQ) never overwrite the typing.
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

  // A new district shows its markets at once, keeping whatever is in the search box.
  function chooseDistrict(value: string) {
    if (value !== "all" && !isDistrict(value)) return;
    if (timer.current) clearTimeout(timer.current);
    const next = text.trim().slice(0, 100);
    setSentQ(next);
    startTransition(() => router.push(marketsHref(value, next), { scroll: false }));
  }

  const districtName = (key: District | "other") => (key === "other" ? t("otherDistrict") : tDistrict(key));

  // Dropdown: districts that have markets, by name. The chosen one is listed even when it has none.
  const options = [...districts, ...(district !== "all" && !districts.some((d) => d.key === district) ? [{ key: district, count: 0 }] : [])].sort((a, b) =>
    districtName(a.key).localeCompare(districtName(b.key), locale),
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

  // Nothing found: say why, and offer the wider list.
  const empty =
    district !== "all" && q
      ? { text: t("noMatchIn", { q, district: districtName(district) }), href: marketsHref("all", q), link: t("searchAllDistricts") }
      : district !== "all"
        ? { text: t("noneInDistrict", { district: districtName(district) }), href: marketsHref("all", ""), link: t("showAll") }
        : { text: t("noMatch", { q }), href: marketsHref("all", ""), link: t("showAll") };

  return (
    <div className="flex flex-col gap-5">
      <form role="search" onSubmit={onSubmit} className="flex flex-col gap-1.5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="flex flex-col gap-1.5">
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
                className={cn(fieldClass, "pr-12 pl-10 [&::-webkit-search-cancel-button]:hidden")}
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
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-district`} className="type-body-medium text-ink">
              {t("district")}
            </label>
            <select id={`${id}-district`} value={district} onChange={(e) => chooseDistrict(e.target.value)} className={cn(fieldClass, "px-3")}>
              <option value="all">{t("districtOption", { name: t("allDistricts"), count: total })}</option>
              {options.map(({ key, count }) => (
                <option key={key} value={key}>
                  {t("districtOption", { name: districtName(key), count })}
                </option>
              ))}
            </select>
          </div>
        </div>
        {/* Always in the page, so screen readers hear the count change */}
        <p role="status" className="type-caption min-h-5 text-ink-muted">
          {isPending ? "" : t("resultCount", { count: markets.length })}
        </p>
      </form>

      <div aria-busy={isPending} className={cn("flex flex-col gap-8 motion-safe:transition-opacity motion-safe:duration-200", isPending && "opacity-60")}>
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center">
            <p className="type-body text-ink-secondary">{empty.text}</p>
            <Link
              href={empty.href}
              scroll={false}
              className="type-body-medium flex h-11 items-center rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {empty.link}
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
