"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, MapPin, Package, Store, Truck, XCircle } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Fragment } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useSession } from "@/components/app-providers";
import { VerificationSeal } from "@/components/brand/verification-seal";
import { OrderBadges } from "@/components/checkout/order-confirmation";
import { UnreadBadge } from "@/components/orders/unread-badge";
import { Link, useRouter } from "@/i18n/routing";
import { checkoutKeys, listOrders, type Order, type OrderStatus } from "@/lib/api/checkout";
import { safeMediaUrl } from "@/lib/api/storefront";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;
// The order's journey, in order. CANCELLED sits apart from it.
const JOURNEY: OrderStatus[] = ["PLACED", "CONFIRMED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "COMPLETED"];
const ALL_STATUSES: OrderStatus[] = [...JOURNEY, "CANCELLED"];

// URL values are checked; anything unexpected falls back to the default.
function readStatus(value: string | null): OrderStatus | undefined {
  return value && (ALL_STATUSES as string[]).includes(value) ? (value as OrderStatus) : undefined;
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
  "type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none";
const secondaryButton =
  "type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm border border-brand px-6 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none";
const stepClass = (active: boolean) =>
  cn(
    "type-body-medium flex h-11 items-center gap-2 rounded-full border pr-4 pl-1.5 whitespace-nowrap transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none",
    active ? "border-brand bg-brand text-primary-foreground shadow-card" : "border-line-strong bg-card text-ink hover:border-brand",
  );
const dotClass = (active: boolean) =>
  cn("type-caption flex size-8 items-center justify-center rounded-full font-medium", active ? "bg-gold text-ink" : "bg-highlight-soft text-highlight");

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

  const loading = session === "loading" || (session === "authenticated" && orders.isPending);
  const list = orders.data?.data ?? [];
  const total = orders.data?.meta?.pagination?.total ?? list.length;
  const totalPages = orders.data?.meta?.pagination?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-6">
      {/* The journey: each status is a step on one gold line; "All" opens it, "Cancelled" stands apart */}
      <nav aria-label={t("filterLabel")} className="scroll-row -mx-4 px-4 md:mx-0 md:px-0">
        <ul className="flex w-max items-center pb-1">
          <li>
            <button type="button" onClick={() => go(undefined, 1)} aria-pressed={!status} className={cn(stepClass(!status), "pl-4")}>
              {t("all")}
            </button>
          </li>
          <li aria-hidden className="mx-2 h-6 w-px bg-line-strong" />
          {JOURNEY.map((s, i) => (
            <Fragment key={s}>
              {i > 0 && <li aria-hidden className="h-px w-4 bg-gold md:w-6" />}
              <li>
                <button type="button" onClick={() => go(s, 1)} aria-pressed={status === s} className={stepClass(status === s)}>
                  <span className={dotClass(status === s)} aria-hidden>
                    {i + 1}
                  </span>
                  {tOrder(`status.${s}`)}
                </button>
              </li>
            </Fragment>
          ))}
          <li aria-hidden className="mx-2 h-6 w-px bg-line-strong" />
          <li>
            <button type="button" onClick={() => go("CANCELLED", 1)} aria-pressed={status === "CANCELLED"} className={stepClass(status === "CANCELLED")}>
              <span className={cn(dotClass(status === "CANCELLED"), status !== "CANCELLED" && "bg-error-soft text-error")} aria-hidden>
                <XCircle className="size-4" />
              </span>
              {tOrder("status.CANCELLED")}
            </button>
          </li>
        </ul>
      </nav>

      {loading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("loading")}</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="relative h-48 skeleton overflow-hidden rounded-md" aria-hidden />
          ))}
        </div>
      ) : orders.isError || !orders.data ? (
        <div role="alert" className={panel}>
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => orders.refetch()} className={secondaryButton}>
            {t("retry")}
          </button>
        </div>
      ) : list.length === 0 ? (
        <EmptyState filtered={Boolean(status)} onShowAll={() => go(undefined, 1)} />
      ) : (
        <>
          <p className="type-body text-ink-secondary" aria-live="polite">
            {t("count", { count: total })}
          </p>
          <ul key={`${status ?? "all"}-${page}`} className={cn("rise-stagger flex flex-col gap-4 transition-opacity", orders.isPlaceholderData && "opacity-60")}>
            {list.map((order) => (
              <li key={order.id}>
                <OrderTicket order={order} />
              </li>
            ))}
          </ul>
        </>
      )}

      {totalPages > 1 && !loading && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3 border-t border-gold pt-5">
          <button
            type="button"
            onClick={() => go(status, page - 1)}
            disabled={page <= 1}
            className="type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:invisible"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {t("previous")}
          </button>
          <span className="type-body text-ink-secondary">{t("pageOf", { page, total: totalPages })}</span>
          <button
            type="button"
            onClick={() => go(status, page + 1)}
            disabled={page >= totalPages}
            className="type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:invisible"
          >
            {t("next")}
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      )}
    </div>
  );
}

/** An arch doorway with a parcel rising inside it: the shop is open, nothing ordered yet. */
function EmptyState({ filtered, onShowAll }: { filtered: boolean; onShowAll: () => void }) {
  const t = useTranslations("MyOrders");
  return (
    <div className="relative isolate flex flex-col items-center gap-4 overflow-hidden rounded-md border border-line bg-card px-6 pt-12 pb-10 text-center shadow-card">
      <span aria-hidden className="absolute bottom-0 -left-8 -z-10 h-3/4 w-28 origin-bottom rounded-t-full border border-b-0 border-gold/40 motion-safe:animate-[vh-grow-up_300ms_cubic-bezier(0.22,1,0.36,1)_150ms_backwards] md:left-8" />
      <span aria-hidden className="absolute -right-8 bottom-0 -z-10 h-3/4 w-28 origin-bottom rounded-t-full border border-b-0 border-gold/40 motion-safe:animate-[vh-grow-up_300ms_cubic-bezier(0.22,1,0.36,1)_150ms_backwards] md:right-8" />

      <div aria-hidden className="relative flex h-32 w-24 origin-bottom items-end justify-center rounded-t-full border-2 border-b-0 border-gold bg-highlight-soft pb-5 motion-safe:animate-[vh-grow-up_300ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
        <span className="absolute -top-2 left-1/2 size-3 -translate-x-1/2 rotate-45 bg-gold" />
        <Package className="size-10 text-brand motion-safe:animate-[vh-rise-in_300ms_cubic-bezier(0.22,1,0.36,1)_250ms_backwards]" strokeWidth={1.5} />
      </div>

      {filtered ? (
        <>
          <h2 className="type-h3 text-ink">{t("emptyFiltered")}</h2>
          <button type="button" onClick={onShowAll} className={secondaryButton}>
            {t("showAll")}
          </button>
        </>
      ) : (
        <>
          <h2 className="type-h2 text-ink">{t("emptyTitle")}</h2>
          <p className="type-body max-w-sm text-ink-secondary">{t("emptyText")}</p>
          <div className="mt-1 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/search" className={primaryButton}>
              {t("startShopping")}
            </Link>
            <Link href="/markets" className={secondaryButton}>
              {t("browseMarkets")}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/** One order as a receipt: shop and items on top, its own progress track, then the actions below a torn edge. */
function OrderTicket({ order }: { order: Order }) {
  const t = useTranslations("MyOrders");
  const tOrder = useTranslations("Order");
  const locale = useLocale();
  const format = useFormatter();
  const items = order.items.reduce((n, i) => n + i.quantity, 0);
  const payPending = order.paymentMethod === "ONLINE" && order.paymentStatus === "PENDING" && order.status !== "CANCELLED";
  const detailHref = `/checkout/${order.checkoutId}`;
  const delivery = order.deliveryMethod === "VENDOR_DELIVERY";
  const logo = safeMediaUrl(order.shop.logoUrl);
  const shown = order.items.slice(0, 2).map((i) => i.title);
  const more = order.items.length - shown.length;

  return (
    <article className="group relative flex flex-col rounded-md border border-line bg-card shadow-card transition-[border-color] duration-200 hover:border-line-strong">
      <div className="flex gap-4 p-4 md:p-5">
        {/* Shop logo in an arch frame */}
        <span className="relative flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-t-full rounded-b-sm border border-gold/60 bg-highlight-soft text-highlight">
          {logo ? <Image src={logo} alt="" fill unoptimized sizes="64px" className="object-cover" /> : <Store className="size-7" strokeWidth={1.25} aria-hidden />}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="type-body-medium text-ink">{tOrder("orderNumber", { number: order.orderNumber })}</h2>
            <span className="type-price text-brand">{formatTaka(order.total, locale)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="type-body truncate text-ink-secondary">{order.shop.name}</span>
            {order.shop.verificationLevel !== "UNVERIFIED" && <VerificationSeal level={order.shop.verificationLevel} size="sm" />}
          </div>
          <p className="type-caption line-clamp-1 text-ink-muted">
            {shown.join(" · ")}
            {more > 0 && ` ${t("more", { count: more })}`}
          </p>
          <p className="type-caption flex flex-wrap items-center gap-x-1.5 text-ink-muted">
            {delivery ? <Truck className="size-3.5" aria-hidden /> : <Store className="size-3.5" aria-hidden />}
            {delivery ? t("delivery") : t("pickup")}
            <span aria-hidden>·</span>
            {t("itemCount", { count: items })}
            <span aria-hidden>·</span>
            {format.dateTime(new Date(order.createdAt), { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4 md:px-5">
        <ProgressTrack order={order} />
        <div className="flex flex-wrap items-center gap-2">
          <OrderBadges order={order} />
          <UnreadBadge count={order.unreadCount} />
        </div>
      </div>

      {/* Torn receipt edge: a dashed line with a notch cut into each side */}
      <div aria-hidden className="relative h-px">
        <span className="absolute inset-x-5 top-0 border-t border-dashed border-line-strong" />
        <span className="absolute top-1/2 -left-2.5 size-5 -translate-y-1/2 rounded-full border-r border-line bg-surface" />
        <span className="absolute top-1/2 -right-2.5 size-5 -translate-y-1/2 rounded-full border-l border-line bg-surface" />
      </div>

      <div className="flex flex-col gap-2 p-4 sm:flex-row sm:justify-end md:px-5">
        {payPending && (
          <Link href={detailHref} className="type-body-medium flex h-11 items-center justify-center rounded-sm bg-highlight px-4 text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none">
            {t("payPending")}
          </Link>
        )}
        <Link
          href={detailHref}
          className="type-body-medium flex h-11 items-center justify-center gap-1 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          {t("view")}
        </Link>
        <Link
          href={`/account/orders/${order.id}`}
          aria-label={t("trackLabel", { number: order.orderNumber })}
          className="type-body-medium flex h-11 items-center justify-center gap-1.5 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <MapPin className="size-4" aria-hidden />
          {t("track")}
          <ChevronRight className="size-4 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

/** Four stops: placed, confirmed, ready (pickup) or on the way (delivery), done. The gold line draws to the current stop. */
function ProgressTrack({ order }: { order: Order }) {
  const t = useTranslations("MyOrders");
  if (order.status === "CANCELLED") {
    return (
      <p className="type-body-medium flex items-center gap-2 rounded-sm bg-error-soft px-3 py-2 text-error">
        <XCircle className="size-4" aria-hidden />
        {t("cancelledNote")}
      </p>
    );
  }
  const delivery = order.deliveryMethod === "VENDOR_DELIVERY";
  const stops = [t("stops.placed"), t("stops.confirmed"), delivery ? t("stops.onTheWay") : t("stops.ready"), t("stops.done")];
  const at = { PLACED: 0, CONFIRMED: 1, READY_FOR_PICKUP: 2, OUT_FOR_DELIVERY: 2, COMPLETED: 3 }[order.status];

  return (
    <div role="img" aria-label={t("progressLabel", { step: at + 1, total: stops.length, stop: stops[at] })} className="relative px-3 pt-1">
      <div className="relative h-0.5 rounded-full bg-line">
        <span
          className="absolute inset-0 origin-left rounded-full bg-gold motion-safe:animate-[vh-draw-x_300ms_cubic-bezier(0.65,0,0.35,1)_150ms_backwards]"
          style={{ transform: `scaleX(${at / (stops.length - 1)})` }}
        />
        {stops.map((_, i) => (
          <span
            key={i}
            className={cn(
              "absolute top-1/2 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2",
              i < at && "border-gold bg-gold text-ink",
              i === at && "border-brand bg-brand text-primary-foreground ring-4 ring-brand/15",
              i > at && "border-line-strong bg-card",
            )}
            style={{ left: `${(i / (stops.length - 1)) * 100}%` }}
          >
            {i <= at && <Check className="size-3" strokeWidth={3} />}
          </span>
        ))}
      </div>
      {/* Labels sit under their dots: the first and last are pinned to the ends so they never spill out */}
      <div aria-hidden className="relative mt-4 h-5">
        {stops.map((s, i) => (
          <span
            key={s}
            className={cn(
              "type-caption absolute top-0 max-w-[25%] truncate whitespace-nowrap",
              i === 0 ? "-left-3" : i === stops.length - 1 ? "-right-3" : "-translate-x-1/2 text-center",
              i === at ? "font-medium text-brand" : i < at ? "text-ink-secondary" : "text-ink-muted",
            )}
            style={i > 0 && i < stops.length - 1 ? { left: `${(i / (stops.length - 1)) * 100}%` } : undefined}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
