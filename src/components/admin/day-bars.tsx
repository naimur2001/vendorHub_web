"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

type Point = { day: string; value: number; note?: string };

/** Round the top of the axis up to a tidy number (1, 2, 2.5, 5 × 10ⁿ). */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/**
 * One measure per day as thin bars (one series, so no legend: the title names it).
 * Hover shows the day's value; a table view carries the same numbers for screen readers and print.
 * Bars can go below zero (a day that lost money), measured from the zero line.
 */
export function DayBars({ title, points, format: fmt, summary }: { title: string; points: Point[]; format: (n: number) => string; summary: string }) {
  const t = useTranslations("AdminDeliveryMonitor");
  const format = useFormatter();
  const uid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const min = Math.min(0, ...points.map((p) => p.value)) < 0 ? -niceMax(-Math.min(...points.map((p) => p.value))) : 0;
  const span = max - min || 1;
  const y = (v: number) => ((max - v) / span) * 100; // % from the top
  const zero = y(0);
  const day = (d: string) => format.dateTime(new Date(`${d}T12:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });
  const ticks = min < 0 ? [max, 0, min] : [max, max / 2, 0];
  const h = hover !== null ? points[hover] : null;

  return (
    <figure className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card md:p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span id={`${uid}-t`} className="type-h3 text-ink">{title}</span>
        <button type="button" onClick={() => setTable(!table)} aria-pressed={table} className="type-body-medium h-11 rounded-sm px-3 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
          {table ? t("showChart") : t("showTable")}
        </button>
      </figcaption>

      {points.length === 0 ? (
        <p className="type-body py-10 text-center text-ink-secondary">{t("noData")}</p>
      ) : table ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-left">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="type-caption text-ink-muted">
                <th scope="col" className="py-1 font-medium">{t("day")}</th>
                <th scope="col" className="py-1 text-right font-medium">{title}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.day} className="type-body border-t border-line text-ink">
                  <td className="py-1.5">{day(p.day)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmt(p.value)}{p.note && <span className="type-caption ml-2 text-ink-muted">{p.note}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2">
          {/* y axis: recessive labels */}
          <div aria-hidden className="type-caption relative w-14 shrink-0 text-right text-ink-muted tabular-nums">
            {ticks.map((v) => (
              <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: `${(y(v) / 100) * 12}rem` }}>{fmt(v)}</span>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <div role="img" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-s`} className="relative h-48" onMouseLeave={() => setHover(null)}>
              <span id={`${uid}-s`} className="sr-only">{summary}</span>
              {ticks.map((v) => (
                <span key={v} aria-hidden className={cn("absolute inset-x-0 h-px", v === 0 ? "bg-line-strong" : "bg-line")} style={{ top: `${y(v)}%` }} />
              ))}
              <div className="absolute inset-0 flex gap-0.5">
                {points.map((p, i) => {
                  const top = Math.min(y(p.value), zero);
                  const height = Math.abs(y(p.value) - zero);
                  return (
                    // the hit area is the whole column, wider and taller than the bar
                    <div key={p.day} className="relative h-full min-w-0 flex-1" onMouseEnter={() => setHover(i)}>
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-x-0 mx-auto max-w-6 origin-bottom transition-opacity duration-150 motion-safe:animate-[vh-grow-up_300ms_cubic-bezier(0.22,1,0.36,1)_backwards]",
                          p.value >= 0 ? "rounded-t-[4px] bg-brand" : "rounded-b-[4px] bg-ink-muted",
                          hover !== null && hover !== i && "opacity-40",
                        )}
                        style={{ top: `${top}%`, height: `max(${height}%, ${p.value === 0 ? 0 : 2}px)` }}
                      />
                    </div>
                  );
                })}
              </div>
              {h && hover !== null && (
                <div
                  aria-hidden
                  className="type-caption pointer-events-none absolute top-0 z-10 flex -translate-x-1/2 flex-col rounded-sm border border-line bg-card px-2.5 py-1.5 whitespace-nowrap shadow-card"
                  style={{ left: `clamp(3rem, ${((hover + 0.5) / points.length) * 100}%, calc(100% - 3rem))` }}
                >
                  <span className="text-ink-muted">{day(h.day)}</span>
                  <span className="type-body-medium text-ink tabular-nums">{fmt(h.value)}</span>
                  {h.note && <span className="text-ink-secondary">{h.note}</span>}
                </div>
              )}
            </div>
            <div aria-hidden className="type-caption mt-1.5 flex justify-between text-ink-muted">
              <span>{day(points[0].day)}</span>
              {points.length > 2 && <span>{day(points[Math.floor(points.length / 2)].day)}</span>}
              <span>{day(points[points.length - 1].day)}</span>
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}
