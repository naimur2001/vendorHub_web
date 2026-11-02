"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, LoaderCircle, PackageSearch, Store, Truck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useSession } from "@/components/app-providers";
import { VerificationSeal } from "@/components/brand/verification-seal";
import { OrderBadges } from "@/components/checkout/order-confirmation";
import { Link, useRouter } from "@/i18n/routing";
import { checkoutKeys, listOrders, ORDER_STATUSES, type Order, type OrderStatus } from "@/lib/api/checkout";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

// URL values are checked; anything unexpected falls back to the default.
function readStatus(value: string | null): OrderStatus | undefined {
  return value && (ORDER_STATUSES as string[]).includes(value) ? (value as OrderStatus) : undefined;
}
function readPage(value: string | null): number {
  const n = value && /^\d{1,3}$/.test(value) ? Number(value) : 1;
  return n >= 1 && n <= 500 ? n : 1;
}
function ordersHref(status: OrderStatus | undefined, page: number): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/account/orders?${query}` : "/account/orders";
}

const panel = "flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center";
const primaryButton =
  "type-body-medium flex h-12 items-center justify-center rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none";
const chipClass = (active: boolean) =>
  cn(
    "type-body-medium flex h-10 items-center rounded-full border px-4 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
    active ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand",
  );

export function MyOrders() {
  const t = useTranslations("MyOrders");
  const tOrder = useTranslations("Order");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: session } = useSession();

  const status = readStatus(searchParams.get("status"));
  const page = readPage(searchParams.get("page"));

  const orders = useQuery({
    queryKey: checkoutKeys.orders(status, page),
    queryFn: () => listOrders({ status, page, limit: PAGE_SIZE }),
    enabled: session === "authenticated",
    placeholderData: keepPreviousData, // keep the old list visible while the next page loads
  });

  const go = (nextStatus: OrderStatus | undefined, nextPage: number) =>
    router.replace(ordersHref(nextStatus, nextPage), { scroll: false });

  if (session === "loading" || (session === "authenticated" && orders.isPending)) {
    return (
      <p role="status" className="type-body flex items-center justify-center gap-2 py-12 text-ink-secondary">
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
        {t("loading")}
      </p>
    );
  }

  if (session === "guest") {
    return (
      <div className={panel}>
        <h2 className="type-h3 text-ink">{t("guestTitle")}</h2>
        <Link href={`/auth/login?next=${encodeURIComponent("/account/orders")}`} className={primaryButton}>
          {t("logIn")}
        </Link>
      </div>
    );
  }

  if (orders.isError || !orders.data) {
    return (
      <div role="alert" className={panel}>
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => orders.refetch()} className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand hover:bg-subtle">
          {t("retry")}
        </button>
      </div>
    );
  }

  const list = orders.data.data;
  const total = orders.data.meta?.pagination?.total ?? list.length;
  const totalPages = orders.data.meta?.pagination?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label={t("filterLabel")} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-2 pb-1">
          <li>
            <button type="button" onClick={() => go(undefined, 1)} aria-pressed={!status} className={chipClass(!status)}>
              {t("all")}
            </button>
          </li>
          {ORDER_STATUSES.map((s) => (
            <li key={s}>
              <button type="button" onClick={() => go(s, 1)} aria-pressed={status === s} className={chipClass(status === s)}>
                {tOrder(`status.${s}`)}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {list.length === 0 ? (
        <div className={panel}>
          <PackageSearch className="size-10 text-highlight" strokeWidth={1.5} aria-hidden />
          {status ? (
            <>
              <p className="type-body text-ink-secondary">{t("emptyFiltered")}</p>
              <button type="button" onClick={() => go(undefined, 1)} className="type-body-medium text-brand underline-offset-4 hover:underline">
                {t("showAll")}
              </button>
            </>
          ) : (
            <>
              <h2 className="type-h3 text-ink">{t("emptyTitle")}</h2>
              <p className="type-body text-ink-secondary">{t("emptyText")}</p>
              <Link href="/search" className={primaryButton}>
                {t("startShopping")}
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="type-body text-ink-secondary" aria-live="polite">
            {t("count", { count: total })}
          </p>
          <ul className={cn("flex flex-col gap-3 transition-opacity", orders.isPlaceholderData && "opacity-60")}>
            {list.map((order) => (
              <li key={order.id}>
                <OrderRow order={order} />
              </li>
            ))}
          </ul>
        </>
      )}

      {totalPages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3 border-t border-gold pt-5">
          <button
            type="button"
            onClick={() => go(status, page - 1)}
            disabled={page <= 1}
            className="type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand hover:bg-subtle disabled:invisible"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {t("previous")}
          </button>
          <span className="type-body text-ink-secondary">{t("pageOf", { page, total: totalPages })}</span>
          <button
            type="button"
            onClick={() => go(status, page + 1)}
            disabled={page >= totalPages}
            className="type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand hover:bg-subtle disabled:invisible"
          >
            {t("next")}
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  const t = useTranslations("MyOrders");
  const tOrder = useTranslations("Order");
  const locale = useLocale();
  const format = useFormatter();
  const items = order.items.reduce((n, i) => n + i.quantity, 0);
  const payPending = order.paymentMethod === "ONLINE" && order.paymentStatus === "PENDING" && order.status !== "CANCELLED";
  const detailHref = `/checkout/${order.checkoutId}`;

  return (
    <article className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card md:flex-row md:items-center md:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="type-body-medium text-ink">{tOrder("orderNumber", { number: order.orderNumber })}</h2>
          <span className="type-caption text-ink-muted">
            {format.dateTime(new Date(order.createdAt), { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="type-body truncate text-ink-secondary">{order.shop.name}</span>
          {order.shop.verificationLevel !== "UNVERIFIED" && <VerificationSeal level={order.shop.verificationLevel} size="sm" />}
        </div>
        <OrderBadges order={order} />
        <p className="type-caption flex items-center gap-1.5 text-ink-muted">
          {order.deliveryMethod === "STORE_PICKUP" ? <Store className="size-3.5" aria-hidden /> : <Truck className="size-3.5" aria-hidden />}
          {order.deliveryMethod === "STORE_PICKUP" ? t("pickup") : t("delivery")}
          {" · "}
          {t("summary", { items, total: formatTaka(order.total, locale) })}
        </p>
      </div>

      <div className="flex flex-col gap-2 md:w-48 md:shrink-0">
        {payPending && (
          <Link href={detailHref} className="type-body-medium flex h-11 items-center justify-center rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover">
            {t("payPending")}
          </Link>
        )}
        <Link
          href={detailHref}
          className="type-body-medium flex h-11 items-center justify-center gap-1 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          {t("view")}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}