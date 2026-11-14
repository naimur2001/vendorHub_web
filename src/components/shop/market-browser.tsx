"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { MarketCard } from "@/components/shop/market-cards";
import type { Market } from "@/lib/api/shops";

/** /markets: every market, with a search by name. The list is short and cached, so it filters in the browser. */
export function MarketBrowser({ markets }: { markets: Market[] }) {
  const t = useTranslations("Market");
  const inputId = useId();
  const [text, setText] = useState("");

  const q = text.trim().toLocaleLowerCase();
  const shown = q ? markets.filter((market) => market.name.toLocaleLowerCase().includes(q)) : markets;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex max-w-xl flex-col gap-1.5">
        <label htmlFor={inputId} className="type-body-medium text-ink">
          {t("searchLabel")}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            id={inputId}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            maxLength={100}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="type-body h-12 w-full rounded-md border border-input bg-card pr-12 pl-10 text-ink placeholder:text-ink-muted hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {text && (
            <button
              type="button"
              onClick={() => setText("")}
              aria-label={t("clearSearch")}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md text-ink-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <X className="size-5" aria-hidden />
            </button>
          )}
        </div>
        {/* Always in the page, so screen readers hear the count change */}
        <p role="status" className="type-caption min-h-5 text-ink-muted">
          {q ? t("resultCount", { count: shown.length }) : ""}
        </p>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center">
          <p className="type-body text-ink-secondary">{t("noMatch", { q: text.trim() })}</p>
          <button
            type="button"
            onClick={() => setText("")}
            className="type-body-medium flex h-11 items-center rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {t("clearSearch")}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}
    </div>
  );
}
