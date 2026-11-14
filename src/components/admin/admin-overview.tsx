"use client";

import { useQuery } from "@tanstack/react-query";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ArchBars, CountUp, RankBar } from "@/components/charts/arch-bars";
import { Reveal } from "@/components/motion/reveal";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
import { Link } from "@/i18n/routing";
import { getAdminDashboard } from "@/lib/api/dashboards";
import { getSales } from "@/lib/api/reports";
import { formatTaka } from "@/lib/format";

const CHART_DAYS = 30;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const dhakaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" });

/** The calendar day (Dhaka time, like the reports) a sales point belongs to: "2026-11-14". */
function pointDay(period: string): string {
  if (DAY_ONLY.test(period)) return period;
  const time = Date.parse(period);
  return Number.isNaN(time) ? period : dhakaDay.format(new Date(time));
}

/** Every day from `from` to `to`, so days without sales still take their place in the chart. */
function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += 86_400_000) {
    days.push(isoDay(new Date(time)));
  }
  return days;
}

function Card({ title, value, text, href }: { title: string; value: number; text?: string; href?: string }) {
  const body = (
    <>
      <span className="type-caption text-ink-muted">{title}</span>
      <CountUp value={value} className="font-heading text-[2rem] leading-none text-ink" />
      {text && <span className="type-caption text-ink-secondary">{text}</span>}
    </>
  );
  const cls = "flex flex-col gap-1 rounded-md border border-line bg-card p-4 shadow-card";
  return href ? <Link href={href} className={`${cls} lift hover:border-brand`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function AdminOverview() {
  const t = useTranslations("AdminOverview");
  const tReports = useTranslations("AdminReports");
  const locale = useLocale();
  const format = useFormatter();
  // Last 30 days, fixed when the page opens.
  const [range] = useState(() => {
    const today = new Date();
    return { from: isoDay(new Date(today.getTime() - (CHART_DAYS - 1) * 86_400_000)), to: isoDay(today) };
  });

  const d = useQuery({ queryKey: ["admin", "dashboard"], queryFn: getAdminDashboard, refetchInterval: 60_000 });
  const daily = useQuery({
    queryKey: ["admin", "reports", "sales", { ...range, interval: "day" }],
    queryFn: () => getSales(range.from, range.to, "day"),
  });

  if (d.isPending) return <OwnerSkeleton label={t("loading")} variant="dashboard" />;
  if (d.isError) return <button type="button" onClick={() => d.refetch()} className="type-body-medium text-brand">{t("retry")}</button>;
  const x = d.data;
  const money = (n: number) => formatTaka(n, locale);
  const v = x.verification;
  const topRevenue = Math.max(0, ...x.topShops30d.map((s) => s.revenue));

  const dayLabel = (period: string) => {
    const time = Date.parse(period);
    return Number.isNaN(time) ? period : format.dateTime(new Date(time), { day: "numeric", month: "short" });
  };
  // The API only sends days that had sales; the other days are shown as empty slots.
  const byDay = new Map((daily.data?.points ?? []).map((p) => [pointDay(p.period), p]));
  const bars = daysBetween(range.from, range.to).map((day) => {
    const point = byDay.get(day);
    const revenue = point?.revenue ?? 0;
    return {
      key: day,
      label: dayLabel(day),
      value: revenue,
      detail: tReports("bar", { period: dayLabel(day), revenue: money(revenue), orders: point?.orders ?? 0 }),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      {/* The four headline cards rise in one by one; their numbers count up */}
      <div className="rise-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card title={t("users")} value={x.users.total} text={t("usersNew", { count: x.users.newLast7d, blocked: x.users.blocked })} href="/admin/users" />
        <Card title={t("shops")} value={x.shops.total} text={t("shopsActive", { active: x.shops.active, count: x.shops.newLast7d })} href="/admin/shops" />
        <Card title={t("verification")} value={v.pendingReview + v.autoFlagged} text={t("pending", { count: v.pendingReview, flagged: v.autoFlagged, waiting: v.waitingForOwner })} href="/admin" />
        <Card title={t("liveOffers")} value={x.bargains.live} />
      </div>

      {/* Revenue per day, last 30 days: a row of arches that builds itself */}
      <section className="hero-after rounded-md border border-line bg-card p-4 shadow-card">
        {daily.isPending ? (
          <div className="skeleton h-72 rounded-md" role="status" aria-label={tReports("loading")} />
        ) : daily.isError ? (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="type-body text-ink-secondary">{tReports("loadError")}</p>
            <button type="button" onClick={() => daily.refetch()} className="type-body-medium text-brand">{t("retry")}</button>
          </div>
        ) : (
          <ArchBars
            title={`${tReports("chart", { interval: tReports("day").toLowerCase() })} · ${t("last30d")}`}
            points={bars}
            emptyText={tReports("empty")}
            formatValue={money}
          />
        )}
      </section>

      <Reveal>
        <section className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card">
          <h2 className="type-h3 text-ink">{t("sales")} · {t("orders")}: {x.orders.total}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["last24h", "last7d", "last30d"] as const).map((k) => (
              <div key={k} className="flex flex-col gap-1 rounded-md bg-surface p-3">
                <span className="type-caption text-ink-muted">{t(k)}</span>
                <CountUp value={x.orders.sales[k].revenue} format={money} className="type-price text-[1.25rem] text-ink" />
                <span className="type-caption text-ink-secondary">{t("ordersCount", { count: x.orders.sales[k].orders })}</span>
              </div>
            ))}
          </div>
          <p className="type-caption text-ink-muted">{t("catalog")}: {t("catalogText", { products: x.catalog.products, listings: x.catalog.activeListings, reviews: x.catalog.reviews })}</p>
        </section>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal>
          <section className="flex h-full flex-col gap-2 rounded-md border border-line bg-card p-4 shadow-card">
            <h2 className="type-h3 text-ink">{t("topShops")}</h2>
            {/* Each shop gets a bar as long as its share of the best shop's revenue */}
            <ol className="rank-stagger flex flex-col gap-2.5">
              {x.topShops30d.map((s, i) => (
                <li key={s.shopId} className="flex flex-col gap-1">
                  <div className="type-body flex justify-between gap-2 text-ink">
                    <span>{i + 1}. {s.slug ? <Link href={`/shops/${s.slug}`} className="hover:text-brand">{s.name}</Link> : s.name}</span>
                    <span className="type-caption text-ink-secondary">{money(s.revenue)} · {t("ordersCount", { count: s.orders })}</span>
                  </div>
                  <RankBar value={s.revenue} max={topRevenue} />
                </li>
              ))}
            </ol>
          </section>
        </Reveal>
        <Reveal>
          <section className="flex h-full flex-col gap-2 rounded-md border border-line bg-card p-4 shadow-card">
            <h2 className="type-h3 text-ink">{t("activity")}</h2>
            <ul className="flex flex-col gap-1.5">
              {x.recentActivity.map((a) => (
                <li key={a.id} className="type-caption flex justify-between gap-2 text-ink-secondary">
                  <code className="text-ink">{a.action}</code>
                  <span>{a.actor ?? "System"} · {format.dateTime(new Date(a.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
            <Link href="/admin/audit" className="type-body-medium self-start text-brand underline-offset-4 hover:underline">→ {t("activity")}</Link>
          </section>
        </Reveal>
      </div>
    </div>
  );
}
