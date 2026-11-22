"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { MarketShopCard } from "@/components/shop/market-cards";
import type { MarketShop } from "@/lib/api/storefront";

type Floor = [string | null, MarketShop[]];

const floorId = (floor: string | null, i: number) => `floor-${i}-${(floor ?? "other").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

/** The market's shops by floor, with a search box (name or shop number) and floor jump links. */
export function MarketShopFinder({ floors }: { floors: Floor[] }) {
  const t = useTranslations("Market");
  const inputId = useId();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase().slice(0, 60);

  const shown = useMemo<Floor[]>(() => {
    if (!q) return floors;
    return floors
      .map(([floor, shops]): Floor => [floor, shops.filter((s) => s.name.toLowerCase().includes(q) || (s.shopNumber ?? "").toLowerCase().includes(q))])
      .filter(([, shops]) => shops.length > 0);
  }, [floors, q]);
  const count = shown.reduce((n, [, shops]) => n + shops.length, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <label htmlFor={inputId} className="sr-only">
            {t("findLabel")}
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={60}
            placeholder={t("findPlaceholder")}
            className="type-body h-11 w-full rounded-full border border-input bg-card pr-11 pl-9 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("clearFind")}
              className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-full text-ink-muted hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        {!q && floors.length > 1 && (
          <nav aria-label={t("floorsLabel")} className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
            {floors.map(([floor], i) => (
              <a
                key={floorId(floor, i)}
                href={`#${floorId(floor, i)}`}
                className="type-caption flex h-11 shrink-0 items-center rounded-full border border-line bg-card px-4 text-ink-secondary hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                {floor ?? t("otherFloor")}
              </a>
            ))}
          </nav>
        )}
      </div>

      <p role="status" className="sr-only">
        {q ? t("findResults", { count }) : ""}
      </p>

      {shown.length === 0 ? (
        <p className="type-body text-ink-secondary">{q ? t("findNone", { query: query.trim() }) : t("noShops")}</p>
      ) : (
        shown.map(([floor, shops]) => {
          const index = floors.findIndex(([f]) => f === floor);
          return (
            <section key={floor ?? "other"} id={floorId(floor, index)} aria-label={floor ?? t("otherFloor")} className="flex scroll-mt-24 flex-col gap-3">
              <h3 className="type-h3 border-b border-line pb-2 text-ink">{floor ?? t("otherFloor")}</h3>
              <ul className="grid gap-3 md:grid-cols-2">
                {shops.map((shop) => (
                  <li key={shop.id}>
                    <MarketShopCard shop={shop} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
