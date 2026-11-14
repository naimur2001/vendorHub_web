"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ArchBarPoint = {
  key: string;
  label: string; // short axis label, e.g. "12 Nov"
  value: number;
  detail: string; // full sentence: read on hover / focus and by screen readers
};

/** Rounds the top of the scale up to a tidy number (1, 2, 2.5, 5 or 10 × a power of ten). */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= value) ?? 10;
  return step * power;
}

/**
 * Plain bar chart: one series, one colour (bordeaux), a labelled scale on the left and a few
 * dates along the bottom. Bars rise from the baseline one after another (CSS: .bar-grow).
 * A period with nothing in it keeps its place as a small grey mark, so the days stay evenly spaced.
 * Hover, tap or Tab onto a bar to read its value beside the title; each bar is also a labelled
 * button for screen readers.
 */
export function ArchBars({
  title,
  points,
  emptyText,
  formatValue = String,
  className,
}: {
  title: ReactNode;
  points: ArchBarPoint[];
  emptyText: string;
  formatValue?: (n: number) => string; // for the scale on the left
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const shown = active !== null ? points[active] : undefined;
  const hasData = points.some((p) => p.value > 0);
  // Many bars: keep the whole build-up under about half a second.
  const stepMs = Math.min(40, 450 / Math.max(points.length, 1));
  // A few dates under the bars: first, middle, last (fewer when there are few bars).
  const last = points.length - 1;
  const ticks = [...new Set(last >= 6 ? [0, Math.round(last / 2), last] : [0, last])].filter((i) => i >= 0);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="type-h3 text-ink">{title}</h2>
        <p className="type-caption min-h-5 text-ink-secondary" aria-live="polite">
          {shown?.detail}
        </p>
      </div>

      {!hasData ? (
        <p className="type-body py-10 text-center text-ink-muted">{emptyText}</p>
      ) : (
        <div className="flex gap-2">
          {/* Scale: top, half, zero */}
          <div aria-hidden className="type-caption flex h-56 shrink-0 flex-col justify-between text-right text-ink-muted">
            <span className="-translate-y-1/2">{formatValue(top)}</span>
            <span>{formatValue(top / 2)}</span>
            <span className="translate-y-1/2">{formatValue(0)}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="scroll-row">
              <div className="relative h-56 min-w-full">
                {/* Quiet grid lines behind the bars */}
                <div aria-hidden className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
                <div aria-hidden className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
                <ul
                  className={cn("relative flex h-full items-end border-b border-line-strong", points.length > 45 ? "gap-px" : "gap-1")}
                  onMouseLeave={() => setActive(null)}
                >
                  {points.map((p, i) => (
                    <li key={p.key || i} className="flex h-full min-w-1.5 flex-1 items-end justify-center">
                      <button
                        type="button"
                        aria-label={p.detail}
                        onMouseEnter={() => setActive(i)}
                        onFocus={() => setActive(i)}
                        onBlur={() => setActive(null)}
                        className="group/bar flex h-full w-full max-w-10 items-end focus-visible:outline-none"
                      >
                        <span
                          className={cn(
                            "bar-grow block w-full motion-safe:transition-colors group-focus-visible/bar:ring-2 group-focus-visible/bar:ring-brand group-focus-visible/bar:ring-offset-1",
                            p.value > 0 ? "rounded-t-[4px]" : "rounded-none",
                            p.value <= 0 ? "bg-line-strong" : active === i ? "bg-brand-alt" : "bg-brand group-hover/bar:bg-brand-alt",
                          )}
                          style={{
                            height: p.value > 0 ? `${Math.max(1.5, (p.value / top) * 100)}%` : "2px",
                            animationDelay: `${Math.round(i * stepMs)}ms`,
                          }}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {/* Dates: first, middle, last */}
            <div className="type-caption mt-1.5 flex justify-between text-ink-muted">
              {ticks.map((i) => (
                <span key={i}>{points[i].label}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A number that counts up once from zero when it appears (about 0.7 s, easing out).
 * The real value is in the markup from the start, so screen readers, "reduce motion"
 * and no-script all get the final number straight away.
 */
export function CountUp({
  value,
  format,
  locale,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  locale?: string; // without `format`: plain number in this language's digits
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const show = format ?? (locale ? (n: number) => new Intl.NumberFormat(locale).format(n) : String);
  const formatRef = useRef(show);

  useLayoutEffect(() => {
    formatRef.current = show;
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || value === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const duration = 700;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      el.textContent = formatRef.current(t < 1 ? Math.round(value * eased) : value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    el.textContent = formatRef.current(0);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.textContent = formatRef.current(value);
    };
  }, [value]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {show(value)}
    </span>
  );
}

/** Thin horizontal bar under a ranked row: its length is the row's share of the best one; it draws in from the start. */
export function RankBar({ value, max }: { value: number; max: number }) {
  const share = max > 0 ? Math.max(0.02, Math.min(1, value / max)) : 0;
  return (
    <span aria-hidden className="block h-1 w-full overflow-hidden rounded-full bg-subtle">
      <span className="bar-draw block h-full rounded-full bg-brand/70" style={{ width: `${share * 100}%` }} />
    </span>
  );
}
