"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/app-providers";
import { ArchBars, RankBar } from "@/components/charts/arch-bars";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
import { Link } from "@/i18n/routing";
import { getShopAnalytics, toolKeys, type AnalyticsRange, type ShopAnalytics } from "@/lib/api/shop-tools";
import { getMyShops, shopKeys } from "@/lib/api/shops";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

type Metric = "revenue" | "orders" | "views" | "addToCarts";
const METRICS: Metric[] = ["revenue", "orders", "views", "addToCarts"];

const box = "flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center";
const chip = (on: boolean) =>
  cn(
    "type-body-medium h-11 rounded-full border px-4 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
    on ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand",
  );

export function ShopAnalyticsView() {
  const t = useTranslations("OwnerAnalytics");
  const searchParams = useSearchParams();
  const { status: session, user } = useSession();
  const isTeam = user?.role === "SHOP_OWNER" || user?.role === "SHOP_STAFF";
  const [range, setRange] = useState<AnalyticsRange>("7d");

  const shops = useQuery({ queryKey: shopKeys.mine, queryFn: getMyShops, enabled: session === "authenticated" && isTeam });
  const shop = (shops.data ?? []).find((s) => s.id === searchParams.get("shop")) ?? shops.data?.[0];
  const data = useQuery({
    queryKey: toolKeys.analytics(shop?.id ?? "", range),
    queryFn: () => getShopAnalytics(shop?.id ?? "", range),
    enabled: Boolean(shop),
    staleTime: 5 * 60_000,
  });

  if (session === "loading" || (isTeam && shops.isPending)) return <OwnerSkeleton label={t("loading")} variant="dashboard" />;
  if (session === "guest") {
    return (
      <div className={box}>
        <h2 className="type-h3 text-ink">{t("guestTitle")}</h2>
        <Link href={`/auth/login?next=${encodeURIComponent("/owner/analytics")}`} className="type-body-medium flex h-11 items-center rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover">
          {t("logIn")}
        </Link>
      </div>
    );
  }
  if (!isTeam) return <div className={box}><h2 className="type-h3 text-ink">{t("notTeam")}</h2></div>;
  if (!shops.isError && !shop) return <div className={box}><p className="type-body text-ink-secondary">{t("noShop")}</p></div>;

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label={t("rangeLabel")} className="flex gap-2">
        {(["7d", "30d"] as const).map((r) => (
          <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)} className={chip(range === r)}>
            {t(`range.${r}`)}
          </button>
        ))}
      </div>
      {shops.isError || data.isError ? (
        <div role="alert" className={box}>
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => (shops.isError ? shops.refetch() : data.refetch())} className="type-body-medium h-11 rounded-sm border border-brand px-4 text-brand hover:bg-subtle">
            {t("retry")}
          </button>
        </div>
      ) : data.isPending ? (
        <OwnerSkeleton label={t("loading")} variant="dashboard" />
      ) : (
        <Report data={data.data} />
      )}
    </div>
  );
}

function Report({ data }: { data: ShopAnalytics }) {
  const t = useTranslations("OwnerAnalytics");
  const locale = useLocale();
  const format = useFormatter();
  const [metric, setMetric] = useState<Metric>("revenue");
  const num = (n: number) => format.number(n);
  const money = (n: number) => formatTaka(n, locale);
  const show = (m: Metric, n: number) => (m === "revenue" ? money(n) : num(n));
  const { totals } = data;
  // days are plain dates (YYYY-MM-DD, Dhaka): read them at noon UTC so no time zone shifts the day
  const dayLabel = (d: string) => format.dateTime(new Date(`${d}T12:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });
  const conversion = totals.views > 0 ? Math.round((totals.orders / totals.views) * 1000) / 10 : null;

  const tiles: { key: string; label: string; value: string }[] = [
    { key: "revenue", label: t("revenue"), value: money(totals.revenue) },
    { key: "orders", label: t("orders"), value: num(totals.orders) },
    { key: "views", label: t("views"), value: num(totals.views) },
    { key: "carts", label: t("addToCarts"), value: num(totals.addToCarts) },
    { key: "conv", label: t("conversion"), value: conversion === null ? "—" : `${format.number(conversion)}%` },
    { key: "win", label: t("bargainWin"), value: totals.bargainWinRate === null ? "—" : `${format.number(totals.bargainWinRate)}%` },
  ];
  const maxViews = Math.max(1, ...data.topListings.map((l) => l.views));

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <div key={tile.key} className="flex flex-col-reverse gap-1 rounded-md border border-line bg-card p-4 shadow-card">
            <dt className="type-caption text-ink-muted">{tile.label}</dt>
            <dd className="font-heading text-[1.5rem] leading-none text-brand">{tile.value}</dd>
          </div>
        ))}
      </dl>
      <p className="type-caption -mt-3 text-ink-muted">{t("bargainNote", { offers: totals.bargainOffers, accepted: totals.bargainsAccepted })}</p>

      <section className="flex flex-col gap-4 rounded-md border border-line bg-card p-4 shadow-card md:p-5">
        <div role="group" aria-label={t("metricLabel")} className="scroll-row -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {METRICS.map((m) => (
            <button key={m} type="button" aria-pressed={metric === m} onClick={() => setMetric(m)} className={chip(metric === m)}>
              {t(m)}
            </button>
          ))}
        </div>
        <ArchBars
          key={`${metric}-${data.range}`}
          title={t("perDay", { metric: t(metric) })}
          emptyText={t("empty")}
          formatValue={(n) => show(metric, n)}
          points={data.days.map((d) => ({
            key: d.date,
            label: dayLabel(d.date),
            value: d[metric],
            detail: t("dayDetail", { day: dayLabel(d.date), value: show(metric, d[metric]) }),
          }))}
        />
      </section>

      <section aria-labelledby="top-h" className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card md:p-5">
        <h2 id="top-h" className="type-h3 text-ink">{t("topTitle")}</h2>
        {data.topListings.length === 0 ? (
          <p className="type-body text-ink-secondary">{t("topEmpty")}</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {data.topListings.map((l, i) => (
              <li key={l.listingId} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="type-body-medium min-w-0 truncate text-ink">
                    {format.number(i + 1)}.{" "}
                    {l.productSlug ? (
                      <Link href={`/products/${l.productSlug}?listing=${l.listingId}`} className="hover:text-brand hover:underline">
                        {l.productTitle}
                      </Link>
                    ) : (
                      (l.productTitle ?? t("unknown"))
                    )}
                  </span>
                  <span className="type-caption shrink-0 text-ink-muted">{money(l.revenue)}</span>
                </div>
                <RankBar value={l.views} max={maxViews} />
                <p className="type-caption text-ink-muted">{t("topLine", { views: l.views, carts: l.addToCarts, sold: l.unitsSold })}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
