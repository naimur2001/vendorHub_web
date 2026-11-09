"use client";

import { useQuery } from "@tanstack/react-query";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
import { Link } from "@/i18n/routing";
import { getAdminDashboard } from "@/lib/api/dashboards";
import { formatTaka } from "@/lib/format";

function Card({ title, value, text, href }: { title: string; value: string | number; text?: string; href?: string }) {
  const body = (
    <>
      <span className="type-caption text-ink-muted">{title}</span>
      <span className="font-heading text-[2rem] leading-none text-ink">{value}</span>
      {text && <span className="type-caption text-ink-secondary">{text}</span>}
    </>
  );
  const cls = "flex flex-col gap-1 rounded-md border border-line bg-card p-4 shadow-card";
  return href ? <Link href={href} className={`${cls} hover:border-brand`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function AdminOverview() {
  const t = useTranslations("AdminOverview");
  const locale = useLocale();
  const format = useFormatter();
  const d = useQuery({ queryKey: ["admin", "dashboard"], queryFn: getAdminDashboard, refetchInterval: 60_000 });

  if (d.isPending) return <OwnerSkeleton label={t("loading")} variant="dashboard" />;
  if (d.isError) return <button type="button" onClick={() => d.refetch()} className="type-body-medium text-brand">{t("retry")}</button>;
  const x = d.data;
  const money = (n: number) => formatTaka(n, locale);
  const v = x.verification;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card title={t("users")} value={x.users.total} text={t("usersNew", { count: x.users.newLast7d, blocked: x.users.blocked })} href="/admin/users" />
        <Card title={t("shops")} value={x.shops.total} text={t("shopsActive", { active: x.shops.active, count: x.shops.newLast7d })} href="/admin/shops" />
        <Card title={t("verification")} value={v.pendingReview + v.autoFlagged} text={t("pending", { count: v.pendingReview, flagged: v.autoFlagged, waiting: v.waitingForOwner })} href="/admin" />
        <Card title={t("liveOffers")} value={x.bargains.live} />
      </div>

      <section className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card">
        <h2 className="type-h3 text-ink">{t("sales")} · {t("orders")}: {x.orders.total}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["last24h", "last7d", "last30d"] as const).map((k) => (
            <div key={k} className="flex flex-col gap-1 rounded-md bg-surface p-3">
              <span className="type-caption text-ink-muted">{t(k)}</span>
              <span className="type-price text-[1.25rem] text-ink">{money(x.orders.sales[k].revenue)}</span>
              <span className="type-caption text-ink-secondary">{t("ordersCount", { count: x.orders.sales[k].orders })}</span>
            </div>
          ))}
        </div>
        <p className="type-caption text-ink-muted">{t("catalog")}: {t("catalogText", { products: x.catalog.products, listings: x.catalog.activeListings, reviews: x.catalog.reviews })}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-md border border-line bg-card p-4 shadow-card">
          <h2 className="type-h3 text-ink">{t("topShops")}</h2>
          <ol className="flex flex-col gap-1.5">
            {x.topShops30d.map((s, i) => (
              <li key={s.shopId} className="type-body flex justify-between gap-2 text-ink">
                <span>{i + 1}. {s.slug ? <Link href={`/shops/${s.slug}`} className="hover:text-brand">{s.name}</Link> : s.name}</span>
                <span className="type-caption text-ink-secondary">{money(s.revenue)} · {t("ordersCount", { count: s.orders })}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="flex flex-col gap-2 rounded-md border border-line bg-card p-4 shadow-card">
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
      </div>
    </div>
  );
}