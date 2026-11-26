"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, LoaderCircle, MapPin, PackageSearch, Phone, Store, Truck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { useSession } from "@/components/app-providers";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { FormModal } from "@/components/ui/form-modal";
import { Link, useRouter } from "@/i18n/routing";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/api/checkout";
import { ApiError } from "@/lib/api/core";
import {
  changeOrderStatus,
  getShopOrder,
  listShopOrders,
  ownerKeys,
  type NextStatus,
  type OrderFilter,
  type ShopOrder,
} from "@/lib/api/owner";
import { getMyShops, shopKeys } from "@/lib/api/shops";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
import { ReservationNote } from "@/components/orders/reservation-note";
import { OrderChat } from "@/components/orders/order-chat";
import { UnreadBadge } from "@/components/orders/unread-badge";
import { CourierStatus } from "@/components/orders/courier-status";
import { errorCode, shipOrder } from "@/lib/api/delivery";
const PAGE_SIZE = 20;
const FILTERS: OrderFilter[] = ["ALL", ...ORDER_STATUSES];

const STATUS_STYLE: Record<OrderStatus, string> = {
  PLACED: "bg-highlight-soft text-highlight",
  CONFIRMED: "bg-info-soft text-verified",
  READY_FOR_PICKUP: "bg-info-soft text-verified",
  OUT_FOR_DELIVERY: "bg-info-soft text-verified",
  COMPLETED: "bg-success-soft text-success-ink",
  CANCELLED: "bg-error-soft text-error",
};

// URL values are checked; anything unexpected falls back to the default.
function readFilter(value: string | null): OrderFilter {
  return value && (FILTERS as string[]).includes(value) ? (value as OrderFilter) : "ALL";
}
function readPage(value: string | null): number {
  const n = value && /^\d{1,3}$/.test(value) ? Number(value) : 1;
  return n >= 1 && n <= 500 ? n : 1;
}
function ordersHref(shopId: string | undefined, filter: OrderFilter, page: number): string {
  const params = new URLSearchParams();
  if (shopId) params.set("shop", shopId);
  if (filter !== "ALL") params.set("status", filter);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/owner/orders?${query}` : "/owner/orders";
}

// Only digits and "+" go into the phone link.
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

const panel = "flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center";
const primaryLink =
  "type-body-medium flex h-12 items-center rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none";
const chipClass = (active: boolean) =>
  cn(
    "type-body-medium flex h-10 items-center rounded-full border px-4 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
    active ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand",
  );

function Pills({ order }: { order: ShopOrder }) {
  const tOrder = useTranslations("Order");
  return (
    <div className="flex flex-wrap gap-2">
      <span className={cn("type-caption rounded-full px-2.5 py-0.5", STATUS_STYLE[order.status])}>{tOrder(`status.${order.status}`)}</span>
      <span
        className={cn(
          "type-caption rounded-full px-2.5 py-0.5",
          order.paymentStatus === "PAID" ? "bg-success-soft text-success-ink" : order.paymentStatus === "REFUNDED" ? "bg-subtle text-ink-secondary" : "bg-highlight-soft text-highlight",
        )}
      >
        {tOrder(`paymentStatus.${order.paymentStatus}`)}
      </span>
      <ReservationNote order={order} audience="shop" />
    </div>
  );
}

export function OrderQueue() {
  const t = useTranslations("OwnerOrders");
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectId = useId();
  const { status: session, user } = useSession();
  const [openOrder, setOpenOrder] = useState<ShopOrder | null>(null);

  const isTeam = user?.role === "SHOP_OWNER" || user?.role === "SHOP_STAFF";

  // Only the user's own shops can be chosen; a shop id typed into the URL is ignored otherwise.
  const shops = useQuery({ queryKey: shopKeys.mine, queryFn: getMyShops, enabled: session === "authenticated" && isTeam });
  const shopList = shops.data ?? [];
  const shop = shopList.find((s) => s.id === searchParams.get("shop")) ?? shopList[0];
  const filter = readFilter(searchParams.get("status"));
  const page = readPage(searchParams.get("page"));

  const orders = useQuery({
    queryKey: ownerKeys.orders(shop?.id ?? "", filter, page),
    queryFn: () => listShopOrders(shop?.id ?? "", { status: filter === "ALL" ? undefined : filter, page, limit: PAGE_SIZE }),
    enabled: Boolean(shop),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000, // new orders appear while the page is open
  });

  const go = (shopId: string | undefined, nextFilter: OrderFilter, nextPage: number) =>
    router.replace(ordersHref(shopList.length > 1 ? shopId : undefined, nextFilter, nextPage), { scroll: false });

  const loading = <OwnerSkeleton label={t("loading")} variant="dashboard" />;

  if (session === "loading") return loading;

  if (session === "guest") {
    return (
      <div className={panel}>
        <h2 className="type-h3 text-ink">{t("guestTitle")}</h2>
        <Link href={`/auth/login?next=${encodeURIComponent("/owner/orders")}`} className={primaryLink}>
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
        <p className="type-body text-ink-secondary">{t("noShopText")}</p>
        <Link href="/owner/setup" className={primaryLink}>
          {t("setup")}
        </Link>
      </div>
    );
  }

  const list = orders.data?.data ?? [];
  const total = orders.data?.meta?.pagination?.total ?? list.length;
  const totalPages = orders.data?.meta?.pagination?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-5">
      {shopList.length > 1 && (
        <div className="flex flex-col gap-1.5 sm:max-w-sm">
          <label htmlFor={selectId} className="type-body-medium text-ink">
            {t("shopLabel")}
          </label>
          <select
            id={selectId}
            value={shop.id}
            onChange={(e) => go(e.target.value, filter, 1)}
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

      <nav aria-label={t("filterLabel")} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-2 pb-1">
          {FILTERS.map((f) => (
            <li key={f}>
              <button type="button" onClick={() => go(shop.id, f, 1)} aria-pressed={filter === f} className={chipClass(filter === f)}>
                {t(`filters.${f}`)}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {orders.isPending ? (
        loading
      ) : orders.isError ? (
        <div role="alert" className={panel}>
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => orders.refetch()} className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand">
            {t("retry")}
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className={panel}>
          <PackageSearch className="size-10 text-highlight" strokeWidth={1.5} aria-hidden />
          <p className="type-body max-w-sm text-ink-secondary">{filter === "ALL" ? t("emptyAll") : t("empty")}</p>
        </div>
      ) : (
        <>
          <p className="type-body text-ink-secondary" aria-live="polite">
            {t("count", { count: total })}
          </p>
          <ul className={cn("flex flex-col gap-3 transition-opacity", orders.isPlaceholderData && "opacity-60")}>
            {list.map((order) => (
              <li key={order.id}>
                <OrderRow order={order} onOpen={() => setOpenOrder(order)} />
              </li>
            ))}
          </ul>
        </>
      )}

      {totalPages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3 border-t border-gold pt-5">
          <button
            type="button"
            onClick={() => go(shop.id, filter, page - 1)}
            disabled={page <= 1}
            className="type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand hover:bg-subtle disabled:invisible"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {t("previous")}
          </button>
          <span className="type-body text-ink-secondary">{t("pageOf", { page, total: totalPages })}</span>
          <button
            type="button"
            onClick={() => go(shop.id, filter, page + 1)}
            disabled={page >= totalPages}
            className="type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand hover:bg-subtle disabled:invisible"
          >
            {t("next")}
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      )}

      <FormModal
        open={openOrder !== null}
        onClose={() => setOpenOrder(null)}
        title={t("sheetTitle", { number: openOrder?.orderNumber ?? "" })}
        description={t("subtitle")}
        srOnlyDescription
      >
        {openOrder && <OrderDetail shopId={shop.id} initial={openOrder} />}
      </FormModal>
    </div>
  );
}

function OrderRow({ order, onOpen }: { order: ShopOrder; onOpen: () => void }) {
  const t = useTranslations("OwnerOrders");
  const locale = useLocale();
  const format = useFormatter();
  const items = order.items.reduce((n, i) => n + i.quantity, 0);
  const needsAction = order.nextStatuses.some((s) => s !== "CANCELLED");

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-md border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:gap-5",
        needsAction ? "border-highlight" : "border-line",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="type-body-medium text-ink">{order.orderNumber}</h2>
          <span className="type-caption text-ink-muted">
            {format.dateTime(new Date(order.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </span>
        </div>
        <p className="type-body truncate text-ink-secondary">{order.customer.name}</p>
        <Pills order={order} />
        <UnreadBadge count={order.unreadCount} />
        <p className="type-caption flex items-center gap-1.5 text-ink-muted">
          {order.deliveryMethod !== "VENDOR_DELIVERY" ? <Store className="size-3.5" aria-hidden /> : <Truck className="size-3.5" aria-hidden />}
          {order.deliveryMethod !== "VENDOR_DELIVERY" ? t("pickup") : order.shipment ? t("courier.delivery") : t("delivery")} · {t("items", { count: items })} ·{" "}
          <span className="type-price">{formatTaka(order.total, locale)}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "type-body-medium flex h-11 shrink-0 items-center justify-center gap-1 rounded-sm px-4 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none sm:w-32",
          needsAction ? "bg-action text-primary-foreground hover:bg-action-hover" : "border border-brand text-brand hover:bg-subtle",
        )}
      >
        {t("open")}
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </article>
  );
}

/** One order in the side panel: customer, delivery, items and only the next steps the backend allows. */
function OrderDetail({ shopId, initial }: { shopId: string; initial: ShopOrder }) {
  const t = useTranslations("OwnerOrders");
  const tOrder = useTranslations("Order");
  const tTrack = useTranslations("OrderTracking");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const reasonId = useId();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // Fresh copy of this order (starts with the row's data, so the panel shows at once).
  const order = useQuery({
    queryKey: ownerKeys.order(shopId, initial.id),
    queryFn: () => getShopOrder(shopId, initial.id),
    initialData: initial,
    // The courier moves courier orders on: keep the card fresh while the panel is open.
    refetchInterval: (q) => (q.state.data?.shipment && !["COMPLETED", "CANCELLED"].includes(q.state.data.status) ? 60_000 : false),
  });

  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: ownerKeys.order(shopId, initial.id) });
    void queryClient.invalidateQueries({ queryKey: ["owner", "orders"] });
    void queryClient.invalidateQueries({ queryKey: ["owner", "dashboard"] });
  };

  // Books the courier again for a courier order still waiting (READY_FOR_PICKUP does it the first time).
  const ship = useMutation({
    mutationFn: () => shipOrder(shopId, initial.id),
    onMutate: () => setMessage(null),
    onSuccess: (shipment) => {
      queryClient.setQueryData<ShopOrder>(ownerKeys.order(shopId, initial.id), (prev) => (prev ? { ...prev, shipment } : prev));
      refreshLists();
      setMessage({ kind: "ok", text: t("courier.booked") });
    },
    onError: (err) => {
      const code = err instanceof ApiError ? errorCode(err.details) : null;
      if (code === "BOOKING_FAILED" || (err instanceof ApiError && err.status >= 500)) {
        void order.refetch();
        setMessage({ kind: "error", text: t("courier.bookingFailed") });
        return;
      }
      if (code === "ORDER_NOT_READY" || code === "NOT_COURIER_ORDER") {
        void order.refetch();
        setMessage({ kind: "error", text: t("errors.changed") });
        return;
      }
      setMessage({ kind: "error", text: err instanceof ApiError && err.status === 0 ? t("errors.network") : t("errors.generic") });
    },
  });

  const change = useMutation({
    mutationFn: ({ status, why }: { status: NextStatus; why?: string }) => changeOrderStatus(shopId, initial.id, status, why),
    onMutate: () => setMessage(null),
    onSuccess: (updated) => {
      // Keep the timeline we have until the refetch brings the new event.
      queryClient.setQueryData<ShopOrder>(ownerKeys.order(shopId, initial.id), (prev) => ({
        ...updated,
        statusEvents: updated.statusEvents ?? prev?.statusEvents,
      }));
      refreshLists();
      setCancelling(false);
      setReason("");
      setMessage({ kind: "ok", text: t("updated") });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        void order.refetch(); // someone else changed it first: show the real state
        const code = errorCode(err.details);
        setMessage({ kind: "error", text: code === "SHIPMENT_BOOKED" ? t("courier.cancelBooked") : code === "COURIER_MANAGED" ? t("courier.managed") : t("errors.changed") });
        return;
      }
      setMessage({ kind: "error", text: err instanceof ApiError && err.status === 0 ? t("errors.network") : t("errors.generic") });
    },
  });

  const o = order.data;
  const money = (n: number) => formatTaka(n, locale);
  const forward = o.nextStatuses.filter((s) => s !== "CANCELLED");
  const canCancel = o.nextStatuses.includes("CANCELLED");
  const waitingForPayment = o.status === "PLACED" && o.paymentMethod === "ONLINE" && o.paymentStatus !== "PAID";
  const finished = o.status === "COMPLETED" || o.status === "CANCELLED";
  const courier = o.shipment ?? null;
  // Ready for pickup but the courier is not booked yet (still retrying, or three tries failed).
  const canBookAgain = courier?.status === "PENDING" && o.status === "READY_FOR_PICKUP";
  // Booked: from here the courier moves the order on, and only Vendors Hub can cancel it.
  const courierDriven = Boolean(courier) && !finished && forward.length === 0 && !canBookAgain && o.status !== "PLACED";
  const busy = change.isPending || ship.isPending;

  function onCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const why = reason.trim();
    if (why.length < 3 || why.length > 300) {
      setMessage({ kind: "error", text: t("reasonError") });
      return;
    }
    change.mutate({ status: "CANCELLED", why });
  }

  return (
    <div className="flex flex-col gap-4">
      <Pills order={o} />

      {/* Customer details: name, phone and where it goes, together */}
      <section className="flex flex-col gap-3 rounded-md border border-line bg-subtle/50 p-3">
      <div className="flex flex-col gap-1">
        <h3 className="type-caption text-ink-muted">{t("customer")}</h3>
        <p className="type-body-medium text-ink">{o.customer.name}</p>
        {o.customer.phone ? (
          <a href={telHref(o.customer.phone)} className="type-body-medium flex min-h-11 items-center gap-2 self-start text-brand underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
            <Phone className="size-4" aria-hidden />
            {t("call", { phone: o.customer.phone })}
          </a>
        ) : (
          <p className="type-caption text-ink-muted">{t("customerEmpty")}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="type-caption text-ink-muted">{o.deliveryMethod !== "VENDOR_DELIVERY" ? t("pickup") : courier ? t("courier.deliverTo") : t("deliverTo")}</h3>
        <p className="type-body flex items-start gap-2 text-ink">
          {o.deliveryMethod !== "VENDOR_DELIVERY" ? (
            <Store className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
          ) : (
            <MapPin className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
          )}
          {/* Customer text: plain text, React escapes it */}
          {o.deliveryMethod !== "VENDOR_DELIVERY" ? t("pickupNote") : (o.deliveryAddress ?? "")}
        </p>
      </div>
      </section>

      {courier && <CourierStatus shipment={courier} shop={{ codAmount: courier.codAmount, shopPaid: courier.shopPaid, bookingFailed: courier.bookingFailed }} />}

      <section className="flex flex-col gap-1">
        <h3 className="type-caption text-ink-muted">{t("payment")}</h3>
        <p className="type-body text-ink">{tOrder(`payment.${o.paymentMethod}`)}</p>
      </section>

      <section aria-labelledby={`timeline-${o.id}`} className="flex flex-col gap-3 border-t border-line pt-3">
        <h3 id={`timeline-${o.id}`} className="type-caption text-ink-muted">
          {tTrack("timeline")}
        </h3>
        {o.statusEvents ? (
          <OrderTimeline order={o} />
        ) : (
          <div className="h-40 skeleton rounded-md" aria-hidden />
        )}
      </section>

      <section className="flex flex-col gap-1.5 border-t border-line pt-3">
        <h3 className="type-caption text-ink-muted">{t("itemsTitle")}</h3>
        <ul className="flex flex-col gap-1.5">
          {o.items.map((item) => (
            <li key={item.id} className="type-body flex justify-between gap-3 text-ink-secondary">
              <span className="flex min-w-0 flex-col gap-1">
                <span>
                  {item.quantity} × {item.title}
                  {item.bargained && (
                    <span className="type-caption ml-2 rounded-sm bg-highlight-soft px-1.5 py-0.5 text-highlight">🤝 {t("bargained")}</span>
                  )}
                </span>
                {/* The size / colour to pack (customer's choice, plain text) */}
                {item.options && Object.keys(item.options).length > 0 && (
                  <span className="flex flex-wrap gap-1.5" aria-label={t("options")}>
                    {Object.entries(item.options).map(([name, value]) => (
                      <span key={name} className="type-caption rounded-full border border-gold/60 bg-card px-2.5 py-0.5 text-ink">
                        {name}: <span className="font-medium">{String(value)}</span>
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span className="type-price shrink-0">{money(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
          <div className="type-body flex justify-between text-ink-secondary">
            <dt>{t("subtotal")}</dt>
            <dd className="type-price">{money(o.subtotal)}</dd>
          </div>
          {(o.discount ?? 0) > 0 && (
            <div className="type-body flex justify-between text-success-ink">
              <dt>{t("couponLine", { code: o.couponCode ?? "" })}</dt>
              <dd className="type-price">−{money(o.discount ?? 0)}</dd>
            </div>
          )}
          {(o.creditUsed ?? 0) > 0 && (
            <div className="type-body flex justify-between text-success-ink">
              <dt>{t("creditLine")}</dt>
              <dd className="type-price">−{money(o.creditUsed ?? 0)}</dd>
            </div>
          )}
          <div className="type-body flex justify-between text-ink-secondary">
            <dt>{t("deliveryFee")}</dt>
            <dd className="type-price">{o.deliveryFee > 0 ? money(o.deliveryFee) : t("free")}</dd>
          </div>
          <div className="type-body-medium flex justify-between text-ink">
            <dt>{t("total")}</dt>
            <dd className="type-price">{money(o.total)}</dd>
          </div>
        </dl>
      </section>

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={cn("type-body flex items-start gap-2", message.kind === "error" ? "text-error" : "text-success-ink")}
        >
          {message.kind === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {message.text}
        </p>
      )}

      <OrderChat scope={{ kind: "shop", shopId, orderId: o.id }} />

      {waitingForPayment && <p className="type-body rounded-md bg-highlight-soft p-3 text-highlight">{t("awaitingPayment")}</p>}

      {!cancelling && forward.length > 0 && (
        <div className="flex flex-col gap-2">
          {forward.map((next) => (
            <button
              key={next}
              type="button"
              onClick={() => change.mutate({ status: next })}
              disabled={busy}
              aria-busy={change.isPending}
              className="type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {change.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {courier && next === "READY_FOR_PICKUP" ? t("courier.ready") : t(`actions.${next}`)}
            </button>
          ))}
          {courier && forward.includes("READY_FOR_PICKUP") && <p className="type-caption text-ink-muted">{t("courier.readyNote")}</p>}
          {forward.includes("COMPLETED") && o.paymentMethod !== "ONLINE" && <p className="type-caption text-ink-muted">{t("cashNote")}</p>}
        </div>
      )}

      {!cancelling && canBookAgain && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => ship.mutate()}
            disabled={busy}
            aria-busy={ship.isPending}
            className="type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {ship.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Truck className="size-4" aria-hidden />}
            {t("courier.bookAgain")}
          </button>
          <p className="type-caption text-ink-muted">{t("courier.waiting")}</p>
        </div>
      )}

      {courierDriven && <p className="type-body rounded-md bg-subtle p-3 text-ink-secondary">{t("courier.managed")}</p>}

      {!cancelling && canCancel && (
        <button
          type="button"
          onClick={() => setCancelling(true)}
          disabled={busy}
          className="type-body-medium flex h-12 items-center justify-center rounded-sm border border-error px-4 text-error hover:bg-error-soft focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none disabled:opacity-60"
        >
          {t("actions.CANCELLED")}
        </button>
      )}

      {cancelling && (
        <form onSubmit={onCancel} noValidate className="flex flex-col gap-3 rounded-md border border-error/40 bg-error-soft/40 p-3">
          <p className="type-body-medium text-ink">{t("cancelTitle")}</p>
          <p className="type-caption text-ink-secondary">{t("cancelText")}</p>
          <label htmlFor={reasonId} className="type-body-medium text-ink">
            {t("reason")}
          </label>
          <textarea
            id={reasonId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder={t("reasonPlaceholder")}
            className="type-body w-full rounded-md border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCancelling(false)}
              disabled={change.isPending}
              className="type-body-medium flex h-12 items-center justify-center rounded-sm border border-ink px-4 text-ink hover:bg-subtle"
            >
              {t("keep")}
            </button>
            <button
              type="submit"
              disabled={change.isPending}
              aria-busy={change.isPending}
              className="type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-error px-4 text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {change.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {t("confirmCancel")}
            </button>
          </div>
        </form>
      )}

      {finished && <p className="type-caption text-ink-muted">{t("finalNote")}</p>}
    </div>
  );
}