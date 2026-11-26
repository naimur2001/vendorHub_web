"use client";

import { Layers, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { MarketShopCard } from "@/components/shop/market-cards";
import type { MarketShop } from "@/lib/api/storefront";
import { cn } from "@/lib/utils";

type Floor = [string | null, MarketShop[]];

const ALL = "__all__";
const OTHER = "__other__";
const keyOf = (floor: string | null) => floor ?? OTHER;

/**
 * The market's shops with a search box (shop name or number) and floor tabs ("All floors", "Level 1"...).
 * With every floor shown, the shops stand under their floor's heading.
 */
export function MarketShopFinder({ floors }: { floors: Floor[] }) {
  const t = useTranslations("Market");
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [floorKey, setFloorKey] = useState<string>(ALL);
  const q = query.trim().toLowerCase().slice(0, 60);
  const total = floors.reduce((n, [, shops]) => n + shops.length, 0);

  const shown = useMemo<Floor[]>(() => {
    const onFloor = floorKey === ALL ? floors : floors.filter(([floor]) => keyOf(floor) === floorKey);
    if (!q) return onFloor;
    return onFloor
      .map(([floor, shops]): Floor => [floor, shops.filter((s) => s.name.toLowerCase().includes(q) || (s.shopNumber ?? "").toLowerCase().includes(q))])
      .filter(([, shops]) => shops.length > 0);
  }, [floors, floorKey, q]);
  const count = shown.reduce((n, [, shops]) => n + shops.length, 0);
  const floorName = (floor: string | null) => floor ?? t("otherFloor");

  const tab =
    "type-body-medium inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 shadow-card focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none motion-safe:transition-colors motion-safe:duration-200";

  return (
    <div className="flex flex-col gap-6">
      {/* Search and floors sit together on an ivory panel */}
      <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-4 shadow-card md:p-5">
        <div className="relative w-full md:max-w-md">
          <label htmlFor={inputId} className="sr-only">
            {t("findLabel")}
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-highlight" aria-hidden />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={60}
            placeholder={t("findPlaceholder")}
            className="type-body h-12 w-full rounded-full border border-line-strong bg-card pr-12 pl-11 text-ink placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("clearFind")}
              className="absolute top-0.5 right-0.5 flex size-11 items-center justify-center rounded-full text-ink-muted hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>

        {floors.length > 1 && (
          <div role="group" aria-label={t("floorFilter")} className="flex flex-col gap-2">
            <p className="type-caption flex items-center gap-1.5 text-ink-secondary">
              <Layers className="size-4 text-highlight" aria-hidden />
              {t("floorFilter")}
            </p>
            <div className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
              {[[ALL, t("allFloors"), total] as const, ...floors.map(([floor, shops]) => [keyOf(floor), floorName(floor), shops.length] as const)].map(
                ([key, label, n]) => {
                  const on = floorKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setFloorKey(key)}
                      className={cn(tab, on ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand hover:text-brand")}
                    >
                      {label}
                      <span className={cn("type-caption rounded-full px-2 py-0.5", on ? "bg-primary-foreground/15 text-primary-foreground" : "bg-highlight-soft text-ink-secondary")}>
                        {n}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </div>
        )}
      </div>

      <p role="status" className="type-body text-ink-secondary">
        {t("findResults", { count })}
      </p>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line-strong bg-card px-6 py-12 text-center">
          <Search className="size-10 text-highlight" strokeWidth={1.5} aria-hidden />
          <p className="type-h3 text-ink">{q ? t("findNone", { query: query.trim() }) : t("noShops")}</p>
          {(q || floorKey !== ALL) && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFloorKey(ALL);
              }}
              className="type-body-medium flex h-11 items-center rounded-full border border-brand px-5 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              {t("showEveryShop")}
            </button>
          )}
        </div>
      ) : (
        shown.map(([floor, shops]) => (
          <section key={keyOf(floor)} aria-label={floorName(floor)} className="flex flex-col gap-3">
            <h2 className="type-h3 flex items-center gap-3 text-ink">
              <span aria-hidden className="size-2 rotate-45 bg-gold" />
              {floorName(floor)}
              <span className="type-caption text-ink-muted">{t("shopCount", { count: shops.length })}</span>
              <span aria-hidden className="h-px flex-1 bg-line" />
            </h2>
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {shops.map((shop) => (
                <li key={shop.id}>
                  <MarketShopCard shop={shop} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
