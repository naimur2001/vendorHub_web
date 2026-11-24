"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useLocale, useNow, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { DayBars } from "@/components/admin/day-bars";
import { ShipmentsTable } from "@/components/admin/shipments-table";
import {
  deliveryKeys,
  getDeliveryByProvider,
  getDeliveryByShop,
  getDeliverySeries,
  getDeliverySummary,
  listCouriers,
  type DeliveryMetrics,
  type RangeFilter,
  type Ranked,
} from "@/lib/api/delivery";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const RANGES = [7, 30, 90] as const;
const select = "type-body h-11 rounded-sm border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";
const chip = (on: boolean) =>
  cn("type-body-medium h-11 rounded-full border px-4 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none", on ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand");

/** YYYY-MM-DD in Dhaka, `daysAgo` days before `now`. */
function dhakaDay(now: Date, daysAgo = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now.getTime() - daysAgo * 86_400_000));
}

function useDuration() {
  const t = useTranslations("AdminDeliveryMonitor");
  return (mins: number | null) => {
    if (mins === null) return "—";
    if (mins < 60) return t("mins", { m: Math.round(mins) });
    const h = Math.floor(mins / 60);
    return h < 48 ? t("hoursMins", { h, m: Math.round(mins % 60) }) : t("days", { d: Math.round(h / 24) });
  };
}

/** Admin: every courier delivery in one place: volume, speed, failures, money in and out. */
export function DeliveryMonitor() {
  const t = useTranslations("AdminDeliveryMonitor");
  const locale = useLocale();
  const now = useNow({ updateInterval: 60_000 });
  const uid = useId();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [providerId, setProviderId] = useState("");
  const today = dhakaDay(now);
  const filter: RangeFilter = useMemo(() => ({ from: dhakaDay(new Date(`${today}T12:00:00+06:00`), days - 1), to: today, ...(providerId && { providerId }) }), [today, days, providerId]);

  const couriers = useQuery({ queryKey: deliveryKeys.couriers, queryFn: listCouriers, staleTime: 5 * 60_000 });
  const summary = useQuery({ queryKey: deliveryKeys.summary(filter), queryFn: () => getDeliverySummary(filter), refetchInterval: 60_000 });
  const series = useQuery({ queryKey: deliveryKeys.series(filter), queryFn: () => getDeliverySeries(filter) });
  const byProvider = useQuery({ queryKey: deliveryKeys.byProvider(filter), queryFn: () => getDeliveryByProvider(filter) });
  const byShop = useQuery({ queryKey: deliveryKeys.byShop(filter), queryFn: () => getDeliveryByShop(filter) });

  const taka = (n: number) => formatTaka(n, locale);
  const points = series.data?.points ?? [];
  const totalDelivered = points.reduce((n, p) => n + p.delivered, 0);
  const totalMargin = points.reduce((n, p) => n + p.margin, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Filters: one row above everything they change */}
      <div className="flex flex-wrap items-end gap-3">
        <div role="group" aria-label={t("rangeLabel")} className="flex gap-2">
          {RANGES.map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={chip(days === d)}>
              {t("lastDays", { days: d })}
            </button>
          ))}
        </div>
        <label htmlFor={`${uid}-p`} className="flex flex-col gap-1">
          <span className="type-caption text-ink-secondary">{t("courier")}</span>
          <select id={`${uid}-p`} value={providerId} onChange={(e) => setProviderId(e.target.value)} className={select}>
            <option value="">{t("allCouriers")}</option>
            {(couriers.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>

      {summary.isPending ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="relative h-24 skeleton overflow-hidden rounded-md" aria-hidden />)}
        </div>
      ) : summary.isError ? (
        <Retry onRetry={() => summary.refetch()} />
      ) : (
        <Tiles m={summary.data} counts={summary.data.countsByStatus} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {series.isPending ? (
          <>
            <div className="relative h-72 skeleton overflow-hidden rounded-md" aria-hidden />
            <div className="relative h-72 skeleton overflow-hidden rounded-md" aria-hidden />
          </>
        ) : series.isError ? (
          <Retry onRetry={() => series.refetch()} />
        ) : (
          <>
            <DayBars
              title={t("chartDelivered")}
              points={points.map((p) => ({ day: p.day, value: p.delivered, note: p.failed ? t("failedNote", { count: p.failed }) : undefined }))}
              format={(n) => String(Math.round(n))}
              summary={t("chartDeliveredSummary", { count: totalDelivered, days })}
            />
            <DayBars
              title={t("chartMargin")}
              points={points.map((p) => ({ day: p.day, value: p.margin, note: t("marginNote", { fees: taka(p.customerFees), cost: taka(p.courierCost) }) }))}
              format={taka}
              summary={t("chartMarginSummary", { total: taka(totalMargin), days })}
            />
          </>
        )}
      </div>

      <Ranking title={t("byCourier")} q={byProvider} name={(r) => r.providerName ?? r.providerCode ?? "—"} />
      <Ranking title={t("byShop")} q={byShop} name={(r) => r.shopName ?? "—"} />

      <ShipmentsTable filter={filter} />
    </div>
  );
}

function Retry({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("AdminDeliveryMonitor");
  return (
    <div role="alert" className="flex items-center gap-3 rounded-md border border-line bg-card p-4">
      <p className="type-body text-ink-secondary">{t("loadError")}</p>
      <button type="button" onClick={onRetry} className="type-body-medium h-11 rounded-sm border border-brand px-4 text-brand hover:bg-subtle">{t("retry")}</button>
    </div>
  );
}

/** Headline numbers. Money owed is the call to action, so it gets the gold frame when not zero. */
function Tiles({ m, counts }: { m: DeliveryMetrics; counts: Record<string, number> }) {
  const t = useTranslations("AdminDeliveryMonitor");
  const locale = useLocale();
  const dur = useDuration();
  const taka = (n: number) => formatTaka(n, locale);
  const active = ["PENDING", "BOOKED", "PICKUP_ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].reduce((n, s) => n + (counts[s] ?? 0), 0);
  const tiles: { label: string; value: string; sub?: string; alert?: boolean }[] = [
    { label: t("tileShipments"), value: String(m.shipments), sub: t("tileActive", { count: active }) },
    { label: t("tileSuccess"), value: m.successRate === null ? "—" : `${m.successRate}%`, sub: t("tileOutcome", { delivered: m.delivered, failed: m.failed, returned: m.returned }) },
    { label: t("tilePickup"), value: dur(m.avgPickupMinutes), sub: t("tilePickupSub") },
    { label: t("tileDelivery"), value: dur(m.avgDeliveryMinutes), sub: t("tileDeliverySub") },
    { label: t("tileFees"), value: taka(m.customerFees), sub: t("tileFeesSub") },
    { label: t("tileCost"), value: taka(m.courierCost), sub: t("tileCostSub") },
    { label: t("tileMargin"), value: taka(m.margin), sub: t("tileMarginSub") },
    { label: t("tileOwed"), value: taka(m.codOwedByCourier), sub: t("tileOwedSub", { shops: taka(m.owedToShops) }), alert: m.codOwedByCourier > 0 || m.owedToShops > 0 },
  ];
  return (
    <ul className="rise-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((x) => (
        <li key={x.label} className={cn("flex flex-col gap-1 rounded-md border bg-card p-4 shadow-card", x.alert ? "border-gold" : "border-line")}>
          <span className="type-caption flex items-center gap-1 text-ink-secondary">
            {x.alert && <AlertTriangle className="size-3.5 text-highlight" aria-hidden />}
            {x.label}
          </span>
          <span className="type-h2 text-ink tabular-nums">{x.value}</span>
          {x.sub && <span className="type-caption text-ink-muted">{x.sub}</span>}
        </li>
      ))}
    </ul>
  );
}

function Ranking({ title, q, name }: { title: string; q: { isPending: boolean; isError: boolean; data?: { items: Ranked[] }; refetch: () => unknown }; name: (r: Ranked) => string }) {
  const t = useTranslations("AdminDeliveryMonitor");
  const locale = useLocale();
  const dur = useDuration();
  const taka = (n: number) => formatTaka(n, locale);
  const rows = q.data?.items ?? [];

  return (
    <section className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card md:p-5">
      <h2 className="type-h3 text-ink">{title}</h2>
      {q.isPending ? (
        <div className="relative h-32 skeleton overflow-hidden rounded-sm" aria-hidden />
      ) : q.isError ? (
        <Retry onRetry={() => q.refetch()} />
      ) : rows.length === 0 ? (
        <p className="type-body text-ink-secondary">{t("noData")}</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <table className="w-full min-w-[40rem] text-left">
            <thead>
              <tr className="type-caption text-ink-muted">
                <th scope="col" className="py-2 font-medium">{t("colName")}</th>
                <th scope="col" className="py-2 text-right font-medium">{t("colShipments")}</th>
                <th scope="col" className="py-2 text-right font-medium">{t("colSuccess")}</th>
                <th scope="col" className="py-2 text-right font-medium">{t("colDeliveryTime")}</th>
                <th scope="col" className="py-2 text-right font-medium">{t("colMargin")}</th>
                <th scope="col" className="py-2 text-right font-medium">{t("colOwedShop")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((r, i) => (
                <tr key={r.shopId ?? r.providerId ?? i} className="type-body border-t border-line text-ink">
                  <td className="py-2">{name(r)}</td>
                  <td className="py-2 text-right tabular-nums">{r.shipments}</td>
                  <td className="py-2 text-right tabular-nums">{r.successRate === null ? "—" : `${r.successRate}%`}</td>
                  <td className="py-2 text-right tabular-nums">{dur(r.avgDeliveryMinutes)}</td>
                  <td className="py-2 text-right tabular-nums">{taka(r.margin)}</td>
                  <td className="py-2 text-right tabular-nums">{taka(r.owedToShops)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
