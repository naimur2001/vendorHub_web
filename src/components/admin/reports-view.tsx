"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { ArchBars, CountUp, RankBar } from "@/components/charts/arch-bars";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
import { Link } from "@/i18n/routing";
import { formatTaka } from "@/lib/format";
import { getSales, getTop, type Interval } from "@/lib/api/reports";
import { cn } from "@/lib/utils";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const input = "type-body h-11 rounded-md border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";

function validRange(from: string, to: string) {
  if (!DATE.test(from) || !DATE.test(to)) return false;
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  return days >= 0 && days <= 365;
}

export function ReportsView() {
  const t = useTranslations("AdminReports");
  const locale = useLocale();
  const format = useFormatter();
  const ids = { from: useId(), to: useId(), interval: useId() };
  const today = new Date();
  const [draft, setDraft] = useState({ from: iso(new Date(today.getTime() - 29 * 86_400_000)), to: iso(today), interval: "day" as Interval });
  const [range, setRange] = useState(draft);
  const [error, setError] = useState<string | null>(null);

  const sales = useQuery({ queryKey: ["admin", "reports", "sales", range], queryFn: () => getSales(range.from, range.to, range.interval), placeholderData: keepPreviousData });
  const top = useQuery({ queryKey: ["admin", "reports", "top", range.from, range.to], queryFn: () => getTop(range.from, range.to), placeholderData: keepPreviousData });

  function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validRange(draft.from, draft.to)) return setError(t("rangeError"));
    setError(null);
    setRange(draft);
  }

  const money = (n: number) => formatTaka(n, locale);
  const periodLabel = (p: string) => {
    const d = Date.parse(p);
    if (Number.isNaN(d)) return p;
    return format.dateTime(new Date(d), range.interval === "month" ? { month: "short", year: "numeric" } : { day: "numeric", month: "short" });
  };

  const points = sales.data?.points ?? [];
  const bars = points.map((p, i) => ({
    key: p.period || String(i),
    label: periodLabel(p.period),
    value: p.revenue,
    detail: t("bar", { period: periodLabel(p.period), revenue: money(p.revenue), orders: p.orders }),
  }));
  const topShopRevenue = Math.max(0, ...(top.data?.shops ?? []).map((s) => s.revenue));
  const topProductUnits = Math.max(0, ...(top.data?.products ?? []).map((p) => p.units));

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={apply} className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-card p-4">
        <label htmlFor={ids.from} className="flex flex-col gap-1"><span className="type-caption text-ink-secondary">{t("from")}</span><input id={ids.from} type="date" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} className={input} /></label>
        <label htmlFor={ids.to} className="flex flex-col gap-1"><span className="type-caption text-ink-secondary">{t("to")}</span><input id={ids.to} type="date" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} className={input} /></label>
        <label htmlFor={ids.interval} className="flex flex-col gap-1">
          <span className="type-caption text-ink-secondary">{t("interval")}</span>
          <select id={ids.interval} value={draft.interval} onChange={(e) => setDraft((d) => ({ ...d, interval: e.target.value as Interval }))} className={input}>
            {(["day", "week", "month"] as Interval[]).map((i) => <option key={i} value={i}>{t(i)}</option>)}
          </select>
        </label>
        <button type="submit" className="type-body-medium h-11 rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover">{t("apply")}</button>
        {error && <p role="alert" className="type-caption w-full text-error">{error}</p>}
      </form>

      {sales.isPending ? (
        <OwnerSkeleton label={t("loading")} variant="dashboard" />
      ) : sales.isError ? (
        <button type="button" onClick={() => sales.refetch()} className="type-body-medium self-start text-brand">{t("retry")}</button>
      ) : (
        <>
          {/* Totals rise in one by one and count up */}
          <div className="rise-stagger grid gap-3 sm:grid-cols-3">
            {[{ k: "orders", v: sales.data.orders, f: String }, { k: "revenue", v: sales.data.revenue, f: money }, { k: "average", v: sales.data.average, f: money }].map((c) => (
              <div key={c.k} className="flex flex-col gap-1 rounded-md border border-line bg-card p-4 shadow-card">
                <span className="type-caption text-ink-muted">{t(c.k)}</span>
                <CountUp value={c.v} format={c.f} className="font-heading text-[1.75rem] leading-none text-ink" />
              </div>
            ))}
          </div>

          {/* Bars are arches that build themselves; a new range builds a new row */}
          <section className={cn("rounded-md border border-line bg-card p-4 shadow-card motion-safe:transition-opacity", sales.isPlaceholderData && "opacity-60")}>
            <ArchBars title={t("chart", { interval: t(range.interval).toLowerCase() })} points={bars} emptyText={t("empty")} formatValue={money} />
          </section>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-md border border-line bg-card p-4 shadow-card">
          <h2 className="type-h3 text-ink">{t("topShops")}</h2>
          {(top.data?.shops ?? []).length === 0 ? <p className="type-body text-ink-muted">{t("empty")}</p> : (
            <ol className="rank-stagger flex flex-col gap-2.5">
              {top.data?.shops.map((s, i) => (
                <li key={s.id || i} className="flex flex-col gap-1">
                  <div className="type-body flex justify-between gap-2 text-ink">
                    <span>{i + 1}. {s.slug ? <Link href={`/shops/${s.slug}`} className="hover:text-brand">{s.name}</Link> : s.name}</span>
                    <span className="type-caption text-ink-secondary">{money(s.revenue)}</span>
                  </div>
                  <RankBar value={s.revenue} max={topShopRevenue} />
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="flex flex-col gap-2 rounded-md border border-line bg-card p-4 shadow-card">
          <h2 className="type-h3 text-ink">{t("topProducts")}</h2>
          {(top.data?.products ?? []).length === 0 ? <p className="type-body text-ink-muted">{t("empty")}</p> : (
            <ol className="rank-stagger flex flex-col gap-2.5">
              {top.data?.products.map((p, i) => (
                <li key={p.id || i} className="flex flex-col gap-1">
                  <div className="type-body flex justify-between gap-2 text-ink">
                    <span>{i + 1}. {p.slug ? <Link href={`/products/${p.slug}`} className="hover:text-brand">{p.title}</Link> : p.title}</span>
                    <span className="type-caption text-ink-secondary">{t("units", { count: p.units })}</span>
                  </div>
                  <RankBar value={p.units} max={topProductUnits} />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}