"use client";

import { useQuery } from "@tanstack/react-query";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useSession } from "@/components/app-providers";
import { Link } from "@/i18n/routing";
import { getCustomerDashboard } from "@/lib/api/dashboards";
import { formatTaka } from "@/lib/format";

function Stat({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = (
    <>
      <span className="type-caption text-ink-muted">{label}</span>
      <span className="font-heading text-[1.5rem] leading-none text-ink">{value}</span>
    </>
  );
  const cls = "flex flex-col gap-1 rounded-md border border-line bg-card p-3 shadow-card";
  return href ? <Link href={href} className={`${cls} hover:border-brand`}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** On /account for logged-in customers: numbers, things to do, latest orders. */
export function CustomerOverview() {
  const t = useTranslations("Overview");
  const tOrder = useTranslations("Order");
  const locale = useLocale();
  const format = useFormatter();
  const { status } = useSession();
  const d = useQuery({ queryKey: ["dashboard", "customer"], queryFn: getCustomerDashboard, enabled: status === "authenticated" });

  if (status !== "authenticated" || !d.data) return null;
  const x = d.data;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="type-h2 text-ink">{t("title")}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label={t("orders")} value={x.orders.total} href="/account/orders" />
        <Stat label={t("spent")} value={formatTaka(x.orders.totalSpent, locale)} />
        <Stat label={t("cart")} value={t("cartItems", { items: x.cart.itemCount, shops: x.cart.shopCount })} href="/cart" />
        <Stat label={t("offersWaiting")} value={x.bargains.waitingForMe} href="/bargains" />
        <Stat label={t("offersReady")} value={x.bargains.acceptedReadyToBuy} href="/bargains" />
        <Stat label={t("following")} value={x.following} />
      </div>

      {x.toReview.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-highlight bg-highlight-soft/40 p-3">
          <h3 className="type-body-medium text-ink">{t("rateTitle")}</h3>
          <ul className="flex flex-col gap-1">
            {x.toReview.map((r) => (
              <li key={r.orderId} className="flex items-center justify-between gap-2">
                <span className="type-body text-ink">{r.shop.name}</span>
                <Link href="/account/orders" className="type-body-medium text-brand underline-offset-4 hover:underline">{t("rate")}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="type-body-medium text-ink">{t("recent")}</h3>
        {x.orders.recent.length === 0 ? (
          <p className="type-body text-ink-muted">{t("noOrders")}</p>
        ) : (
          <ul className="flex flex-col rounded-md border border-line bg-card">
            {x.orders.recent.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 first:border-t-0">
                <span className="type-body text-ink">{o.orderNumber} · {o.shop.name}</span>
                <span className="type-caption text-ink-muted">
                  {tOrder(`status.${o.status}`)} · {formatTaka(o.total, locale)} · {format.dateTime(new Date(o.createdAt), { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}