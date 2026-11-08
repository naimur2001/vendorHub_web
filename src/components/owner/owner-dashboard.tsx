"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  ExternalLink,
  Inbox,
  PackageCheck,
  PackageX,
  ShieldAlert,
  ShieldCheck,
  Star,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { useSession } from "@/components/app-providers";
import { VerificationSeal } from "@/components/brand/verification-seal";
import { AvailabilityBadge } from "@/components/catalog/availability-badge";
import { Link, useRouter } from "@/i18n/routing";
import { getShopDashboard, ownerKeys, type ShopDashboard } from "@/lib/api/owner";
import { getMyShops, shopKeys } from "@/lib/api/shops";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
const panel = "flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center";
const primaryLink =
  "type-body-medium flex h-12 items-center rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none";

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card md:p-5", className)}>
      <h2 className="type-h3 border-b border-line pb-2 text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** A to-do card: big number, label; gold border and a link when there is something to do. */
function TodoCard({ icon: Icon, count, label, href }: { icon: LucideIcon; count: number; label: string; href?: string }) {
  const urgent = count > 0;
  const body = (
    <>
      <Icon className={cn("size-6", urgent ? "text-highlight" : "text-ink-muted")} aria-hidden />
      <span className="font-heading text-[2rem] leading-none text-ink">{count}</span>
      <span className="type-body text-ink-secondary">{label}</span>
    </>
  );
  const box = cn(
    "flex flex-col gap-2 rounded-md border bg-card p-4 shadow-card",
    urgent ? "border-highlight" : "border-line",
  );
  if (href && urgent) {
    return (
      <Link href={href} className={cn(box, "hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none")}>
        {body}
      </Link>
    );
  }
  return <div className={box}>{body}</div>;
}

function SalesCard({ label, revenue, orders }: { label: string; revenue: string; orders: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-line bg-surface p-4">
      <span className="type-caption text-ink-muted">{label}</span>
      <span className="type-price text-[1.375rem] text-ink">{revenue}</span>
      <span className="type-caption text-ink-secondary">{orders}</span>
    </div>
  );
}

function VerificationBanner({ d }: { d: ShopDashboard }) {
  const t = useTranslations("OwnerDashboard.verify");
  const open = d.verification.openRequest;

  if (open?.status === "CORRECTION_REQUESTED") {
    return (
      <div className="flex flex-col gap-2 rounded-md border-l-4 border-error bg-error-soft p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="type-body flex gap-2 text-ink">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-error" aria-hidden />
          <span>
            <strong className="type-body-medium">{t("correctionTitle")}.</strong> {t("correctionText")}
          </span>
        </p>
        <Link href="/owner/setup" className="type-body-medium shrink-0 text-brand underline-offset-4 hover:underline">
          {t("correctionLink")} →
        </Link>
      </div>
    );
  }
  if (open) {
    return (
      <p className="type-body flex gap-2 rounded-md bg-info-soft p-4 text-verified">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
        <span>
          <strong className="type-body-medium">{t("reviewTitle")}.</strong> {t("reviewText")}
        </span>
      </p>
    );
  }
  if (d.verification.level === "UNVERIFIED") {
    return (
      <div className="flex flex-col gap-2 rounded-md border-l-4 border-highlight bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="type-body flex gap-2 text-ink">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-highlight" aria-hidden />
          <span>
            <strong className="type-body-medium">{t("finishTitle")}.</strong> {t("finishText")}
          </span>
        </p>
        <Link href="/owner/setup" className="type-body-medium shrink-0 text-brand underline-offset-4 hover:underline">
          {t("finishLink")} →
        </Link>
      </div>
    );
  }
  return null;
}

export function OwnerDashboard() {
  const t = useTranslations("OwnerDashboard");
  const tOrder = useTranslations("Order");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectId = useId();
  const { status: session, user } = useSession();

  const isTeam = user?.role === "SHOP_OWNER" || user?.role === "SHOP_STAFF";

  // Only the user's own shops can be chosen; a shop id typed into the URL is ignored otherwise.
  const shops = useQuery({ queryKey: shopKeys.mine, queryFn: getMyShops, enabled: session === "authenticated" && isTeam });
  const shopList = shops.data ?? [];
  const shop = shopList.find((s) => s.id === searchParams.get("shop")) ?? shopList[0];

  const dashboard = useQuery({
    queryKey: ownerKeys.dashboard(shop?.id ?? ""),
    queryFn: () => getShopDashboard(shop?.id ?? ""),
    enabled: Boolean(shop),
    refetchInterval: 60_000,
  });

  const loading = <OwnerSkeleton label={t("loading")} variant="dashboard" />;

  if (session === "loading") return loading;

  if (session === "guest") {
    return (
      <div className={panel}>
        <h2 className="type-h3 text-ink">{t("guestTitle")}</h2>
        <Link href={`/auth/login?next=${encodeURIComponent("/owner")}`} className={primaryLink}>
          {t("logIn")}
        </Link>
      </div>
    );
  }

  if (!isTeam) {
    return (
      <div className={panel}>
        <h2 className="type-h3 text-ink">{t("notTeamTitle")}</h2>
        <p className="type-body text-ink-secondary">{t("notTeamText")}</p>
      </div>
    );
  }

  if (shops.isPending) return loading;

  if (shops.isError) {
    return (
      <div role="alert" className={panel}>
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => shops.refetch()} className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand">
          {t("retry")}
        </button>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className={panel}>
        <h2 className="type-h3 text-ink">{t("noShopTitle")}</h2>
        <p className="type-body max-w-sm text-ink-secondary">{t("noShopText")}</p>
        <Link href="/owner/setup" className={primaryLink}>
          {t("setup")}
        </Link>
      </div>
    );
  }

  if (dashboard.isPending) return loading;

  if (dashboard.isError) {
    return (
      <div role="alert" className={panel}>
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => dashboard.refetch()} className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand">
          {t("retry")}
        </button>
      </div>
    );
  }

  const d = dashboard.data;
  const money = (n: number) => formatTaka(n, locale);
  const shopQuery = shopList.length > 1 ? `?shop=${shop.id}` : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="type-h2 text-ink">{d.shop.name}</h2>
            {d.shop.verificationLevel !== "UNVERIFIED" && <VerificationSeal level={d.shop.verificationLevel} size="md" withLabel />}
          </div>
          <Link href={`/shops/${d.shop.slug}`} className="type-body-medium flex items-center gap-1 self-start text-brand underline-offset-4 hover:underline">
            {t("viewStorefront")}
            <ExternalLink className="size-4" aria-hidden />
          </Link>
        </div>

        {shopList.length > 1 && (
          <div className="flex flex-col gap-1.5 sm:w-72">
            <label htmlFor={selectId} className="type-body-medium text-ink">
              {t("shopLabel")}
            </label>
            <select
              id={selectId}
              value={shop.id}
              onChange={(e) => router.replace(`/owner?shop=${e.target.value}`, { scroll: false })}
              className="type-body h-12 rounded-md border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
            >
              {shopList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!d.shop.isActive && (
        <p role="alert" className="type-body flex gap-2 rounded-md bg-error-soft p-4 text-error">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          {t("inactive")}
        </p>
      )}
      <VerificationBanner d={d} />

      <section aria-labelledby="todo-heading" className="flex flex-col gap-3">
        <h2 id="todo-heading" className="type-h3 text-ink">
          {t("todoTitle")}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TodoCard icon={Inbox} count={d.actions.bargainsWaiting} label={t("offersWaiting")} href={`/owner/bargains${shopQuery}`} />
                   <TodoCard
            icon={PackageCheck}
            count={d.actions.ordersToConfirm}
            label={t("ordersToConfirm")}
            href={`/owner/orders?${shopList.length > 1 ? `shop=${shop.id}&` : ""}status=PLACED`}
          />
          <TodoCard icon={CreditCard} count={d.actions.ordersAwaitingPayment} label={t("awaitingPayment")} />
          <TodoCard icon={PackageX} count={d.actions.lowStockCount} label={t("lowStock")} href={`/owner/listings${shopQuery}`} />
           </div>
      </section>

      <Section title={t("salesTitle")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <SalesCard label={t("last24h")} revenue={money(d.sales.last24h.revenue)} orders={t("ordersCount", { count: d.sales.last24h.orders })} />
          <SalesCard label={t("last7d")} revenue={money(d.sales.last7d.revenue)} orders={t("ordersCount", { count: d.sales.last7d.orders })} />
          <SalesCard label={t("last30d")} revenue={money(d.sales.last30d.revenue)} orders={t("ordersCount", { count: d.sales.last30d.orders })} />
        </div>
        <p className="type-body text-ink">{t("completed30d", { amount: money(d.sales.completedRevenueLast30d) })}</p>
        <p className="type-caption text-ink-muted">{t("salesNote")}</p>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t("recentTitle")}>
          {d.orders.recent.length === 0 ? (
            <p className="type-body text-ink-muted">{t("noOrders")}</p>
          ) : (
            <ul className="flex flex-col">
              {d.orders.recent.map((o) => (
                <li key={o.id} className="flex flex-col gap-1 border-t border-line py-3 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="type-body-medium text-ink">{o.orderNumber}</span>
                    <span className="type-price text-ink">{money(o.total)}</span>
                  </div>
                  <span className="type-caption text-ink-muted">
                    {o.customer} · {format.dateTime(new Date(o.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <span className="type-caption rounded-full bg-info-soft px-2.5 py-0.5 text-verified">{tOrder(`status.${o.status}`)}</span>
                    <span
                      className={cn(
                        "type-caption rounded-full px-2.5 py-0.5",
                        o.paymentStatus === "PAID" ? "bg-success-soft text-success-ink" : "bg-highlight-soft text-highlight",
                      )}
                    >
                      {tOrder(`paymentStatus.${o.paymentStatus}`)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t("lowStockTitle")}>
          {d.actions.lowStock.length === 0 ? (
            <p className="type-body text-ink-muted">{t("noLowStock")}</p>
          ) : (
            <ul className="flex flex-col">
              {d.actions.lowStock.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
                  <div className="flex min-w-0 flex-col gap-1">
                    <Link href={`/products/${l.product.slug}?listing=${l.id}`} className="type-body-medium truncate text-ink hover:text-brand">
                      {l.product.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      <AvailabilityBadge value={l.availability} />
                      {/* The shop may see its own stock number; customers never do */}
                      <span className="type-caption text-ink-muted">
                        {l.stockQty !== null ? t("stockLeft", { count: l.stockQty }) : t("stockUntracked")}
                      </span>
                    </div>
                  </div>
                  <span className="type-price shrink-0 text-ink-secondary">{money(l.price)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t("topTitle")}>
          {d.topProducts30d.length === 0 ? (
            <p className="type-body text-ink-muted">{t("noTop")}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {d.topProducts30d.map((p, i) => (
                <li key={p.title} className="type-body flex items-center justify-between gap-3 text-ink">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="type-caption flex size-6 shrink-0 items-center justify-center rounded-full bg-highlight-soft text-highlight">{i + 1}</span>
                    <span className="truncate">{p.title}</span>
                  </span>
                  <span className="type-caption shrink-0 text-ink-muted">{t("unitsSold", { count: p.unitsSold })}</span>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title={t("reputationTitle")}>
          <ul className="type-body flex flex-col gap-2 text-ink">
            <li className="flex items-center gap-2">
              <Star className="size-4 text-highlight" aria-hidden />
              {d.reputation.ratingAverage !== null
                ? t("rating", { average: d.reputation.ratingAverage.toFixed(1), count: d.reputation.reviewCount })
                : t("noRating")}
            </li>
            <li>{t("followers", { count: d.reputation.followers })}</li>
            {d.shop.avgResponseMins !== null && <li>{t("responds", { minutes: d.shop.avgResponseMins })}</li>}
            <li className="text-ink-secondary">{t("listings", { active: d.listings.active, inactive: d.listings.inactive })}</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}