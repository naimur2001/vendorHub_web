"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, ExternalLink, LoaderCircle, MapPin, Phone, SearchX, Store, Truck } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { useSession } from "@/components/app-providers";
import { VerificationSeal } from "@/components/brand/verification-seal";
import { Link } from "@/i18n/routing";
import {
  cancelOrder,
  checkoutKeys,
  getCheckout,
  payMockOrder,
  type CheckoutResult,
  type Order,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/api/checkout";
import { ApiError } from "@/lib/api/core";
import { callHref, shopPlace } from "@/lib/api/storefront";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ReviewForm } from "@/components/reviews/review-form";
import { RequestReturn } from "@/components/returns/return-detail";
import { ReservationNote } from "@/components/orders/reservation-note";


const STATUS_STYLE: Record<OrderStatus, string> = {
  PLACED: "bg-info-soft text-verified",
  CONFIRMED: "bg-info-soft text-verified",
  READY_FOR_PICKUP: "bg-highlight-soft text-highlight",
  OUT_FOR_DELIVERY: "bg-highlight-soft text-highlight",
  COMPLETED: "bg-success-soft text-success-ink",
  CANCELLED: "bg-error-soft text-error",
};

const PAYMENT_STYLE: Record<PaymentStatus, string> = {
  PENDING: "bg-highlight-soft text-highlight",
  PAID: "bg-success-soft text-success-ink",
  FAILED: "bg-error-soft text-error",
  REFUNDED: "bg-subtle text-ink-secondary",
};

/** Order and payment status as small coloured pills (shared with "My orders"). */
export function OrderBadges({ order }: { order: Order }) {
  const t = useTranslations("Order");
  return (
    <div className="flex flex-wrap gap-2">
      <span className={cn("type-caption rounded-full px-2.5 py-0.5", STATUS_STYLE[order.status])}>{t(`status.${order.status}`)}</span>
      <span className={cn("type-caption rounded-full px-2.5 py-0.5", PAYMENT_STYLE[order.paymentStatus])}>
        {t(`paymentStatus.${order.paymentStatus}`)}
      </span>
      <ReservationNote order={order} audience="customer" />
    </div>
  );
}

const panel = "flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center";
const primaryButton =
  "type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none";
const secondaryButton =
  "type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm border border-brand px-6 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none";

export function OrderConfirmation({ checkoutId }: { checkoutId: string }) {
  const t = useTranslations("Order");
  const locale = useLocale();
  const { status } = useSession();

  const checkout = useQuery({
    queryKey: checkoutKeys.checkout(checkoutId),
    queryFn: () => getCheckout(checkoutId),
    enabled: status === "authenticated",
  });

  if (status === "loading" || (status === "authenticated" && checkout.isPending)) {
    return (
      <p role="status" className="type-body flex items-center justify-center gap-2 py-12 text-ink-secondary">
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
        {t("loading")}
      </p>
    );
  }

  if (status === "guest") {
    return (
      <div className={panel}>
        <h1 className="type-h3 text-ink">{t("guestTitle")}</h1>
        <Link href={`/auth/login?next=${encodeURIComponent(`/checkout/${checkoutId}`)}`} className={primaryButton}>
          {t("logIn")}
        </Link>
      </div>
    );
  }

  if (checkout.isError) {
    const notFound = checkout.error instanceof ApiError && checkout.error.status === 404;
    return (
      <div role="alert" className={panel}>
        <SearchX className="size-10 text-highlight" strokeWidth={1.5} aria-hidden />
        <h1 className="type-h3 text-ink">{notFound ? t("notFoundTitle") : t("loadError")}</h1>
        {notFound ? (
          <p className="type-body max-w-sm text-ink-secondary">{t("notFoundText")}</p>
        ) : (
          <button type="button" onClick={() => checkout.refetch()} className={secondaryButton}>
            {t("retry")}
          </button>
        )}
      </div>
    );
  }

  const result = checkout.data as CheckoutResult;
  const target = mapTarget(result.orders[0]);

  return (
    <div className="flex flex-col gap-6">
      {/* Confirmation on one side, the address map on the other (stacked on phones) */}
      <div className={cn("grid gap-5", target && "lg:grid-cols-2")}>
      {/* Celebration (once): the circle and tick draw in, a gold ring bursts behind them, then the lines rise one by one */}
      <header className="rise-stagger flex flex-col items-center justify-center gap-3 rounded-md border border-line bg-card px-6 py-8 text-center">
        <span className="ring-burst flex rounded-full">
          <svg viewBox="0 0 52 52" className="check-draw size-14 text-success-ink" fill="none" stroke="currentColor" aria-hidden>
            <circle cx="26" cy="26" r="24" strokeWidth="2" pathLength={1} />
            <path d="M15 27 L23 35 L38 18" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
          </svg>
        </span>
        <h1 className="type-h2 text-ink">{t("placedTitle", { count: result.orders.length })}</h1>
        <p className="type-body max-w-lg text-ink-secondary">{t("placedText")}</p>
        <p className="type-body-medium text-ink">
          {t("checkoutTotal")}: <span className="type-price">{formatTaka(result.totalAmount, locale)}</span>
        </p>
      </header>
      {target && <AddressMap address={target.address} pickup={target.pickup} />}
      </div>

      {/* Order cards rise in one by one */}
      <div className="rise-stagger grid gap-5 lg:grid-cols-2">
        {result.orders.map((order) => (
          <OrderCard key={order.id} order={order} checkoutId={checkoutId} />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/account/orders" className={primaryButton}>
          {t("myOrders")}
        </Link>
        <Link href="/search" className={secondaryButton}>
          {t("continueShopping")}
        </Link>
      </div>
    </div>
  );
}

/** Where the first order goes: the delivery address, or the shop for a store pickup. */
function mapTarget(order: Order | undefined): { address: string; pickup: boolean } | null {
  if (!order) return null;
  if (order.deliveryMethod !== "VENDOR_DELIVERY") {
    const place = [shopPlace(order.shop.levelFloor, order.shop.shopNumber), order.shop.addressLine].filter(Boolean).join(", ");
    return place ? { address: place, pickup: true } : null;
  }
  return order.deliveryAddress ? { address: order.deliveryAddress, pickup: false } : null;
}

/**
 * Google Maps view of the address, shown beside the confirmation and loaded straight away.
 * No coordinates exist, so Google places the pin from the address text. CSP: frame-src https://www.google.com.
 */
function AddressMap({ address, pickup, className }: { address: string; pickup: boolean; className?: string }) {
  const t = useTranslations("Order");
  const title = pickup ? t("map.pickupTitle") : t("map.deliveryTitle");
  const query = encodeURIComponent(`${address}, Bangladesh`);

  return (
    <section aria-label={title} className={cn("map-in flex flex-col overflow-hidden rounded-md border border-line bg-card shadow-card", className)}>
      <div className="relative min-h-60 flex-1 bg-subtle">
        <LoaderCircle className="absolute top-1/2 left-1/2 size-6 -translate-1/2 animate-spin text-ink-muted" aria-hidden />
        <iframe
          title={title}
          src={`https://www.google.com/maps?q=${query}&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full border-0"
        />
        {/* Label over the map, like a shipping tag */}
        <div className="pop-in pointer-events-none absolute top-3 left-1/2 max-w-[85%] -translate-x-1/2 rounded-sm border border-gold bg-card px-3 py-1.5 text-center shadow-card">
          <p className="type-caption text-ink-muted">{title}</p>
          <p className="type-body-medium truncate text-ink">{address}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2">
        <p className="type-caption flex items-center gap-1.5 text-ink-muted">
          <MapPin className="size-4 shrink-0 text-highlight" aria-hidden />
          {t("map.note")}
        </p>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${query}`}
          target="_blank"
          rel="noopener noreferrer"
          className="type-body-medium flex h-11 items-center gap-2 rounded-sm px-2 text-brand underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          {t("map.openInMaps")}
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </div>
    </section>
  );
}

function OrderCard({ order, checkoutId }: { order: Order; checkoutId: string }) {
  const t = useTranslations("Order");
  const locale = useLocale();
  const format = useFormatter();
  const queryClient = useQueryClient();
  const reasonId = useId();
  const tReviews = useTranslations("Reviews");
  const [payError, setPayError] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [justCancelled, setJustCancelled] = useState(false);

  const canPay = order.paymentMethod === "ONLINE" && order.paymentStatus === "PENDING" && order.status !== "CANCELLED";
  const canCancel = order.status === "PLACED";
  const pickupPlace = [shopPlace(order.shop.levelFloor, order.shop.shopNumber), order.shop.addressLine].filter(Boolean).join(", ");
  const shopCall = callHref(order.shop.phone); // null for a shop without a phone: no call button

  // Put the server's updated order into this checkout's cached data.
  function replaceOrder(updated: Order) {
    queryClient.setQueryData<CheckoutResult>(checkoutKeys.checkout(checkoutId), (old) =>
      old ? { ...old, orders: old.orders.map((o) => (o.id === updated.id ? updated : o)) } : old,
    );
    void queryClient.invalidateQueries({ queryKey: ["orders"] }); // My orders
  }

  const pay = useMutation({
    // Only the order id is sent; the amount is the server's.
    mutationFn: () => payMockOrder(order.id),
    onMutate: () => setPayError(null),
    onSuccess: (updated) => {
      replaceOrder(updated);
      setJustPaid(true);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        // Already paid or cancelled (e.g. in another tab): show the real state.
        void queryClient.invalidateQueries({ queryKey: checkoutKeys.checkout(checkoutId) });
        return;
      }
      setPayError(err instanceof ApiError && err.status === 0 ? t("payErrors.network") : t("payErrors.generic"));
    },
  });

  const cancel = useMutation({
    // Only the order id and the optional reason are sent; the backend checks it's yours and still PLACED.
    mutationFn: (why: string | undefined) => cancelOrder(order.id, why),
    onMutate: () => setCancelError(null),
    onSuccess: (updated) => {
      replaceOrder(updated);
      setCancelOpen(false);
      setReason("");
      setJustCancelled(true);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        // The shop confirmed in the meantime: show the real state.
        void queryClient.invalidateQueries({ queryKey: checkoutKeys.checkout(checkoutId) });
        setCancelError(t("cancel.tooLate"));
        return;
      }
      setCancelError(t("cancel.error"));
    },
  });

  function onCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const why = reason.trim();
    if (why.length > 0 && why.length < 3) {
      setCancelError(t("cancel.reasonError"));
      return;
    }
    cancel.mutate(why || undefined);
  }

  return (
    <article aria-labelledby={`order-${order.id}`} className="flex flex-col gap-4 rounded-md border border-line bg-card p-5 shadow-card">
      <header className="flex flex-col gap-2 border-b border-line pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={`order-${order.id}`} className="type-h3 text-ink">
            {t("orderNumber", { number: order.orderNumber })}
          </h2>
          <span className="type-caption text-ink-muted">
            {t("placedOn", {
              date: format.dateTime(new Date(order.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
            })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={`/shops/${order.shop.slug}`} className="type-body-medium text-ink hover:text-brand">
            {order.shop.name}
          </Link>
          {order.shop.verificationLevel !== "UNVERIFIED" && <VerificationSeal level={order.shop.verificationLevel} size="sm" />}
        </div>
        {shopCall && (
          <a
            href={shopCall}
            className="type-body-medium flex h-11 items-center gap-2 self-start rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Phone className="size-4 shrink-0" aria-hidden />
            {t("callShop", { phone: order.shop.phone ?? "" })}
          </a>
        )}
        <OrderBadges order={order} />
      </header>

      <div className="type-body flex flex-col gap-1.5 text-ink-secondary">
        <p className="flex items-start gap-2">
          {order.deliveryMethod !== "VENDOR_DELIVERY" ? (
            <Store className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
          ) : (
            <Truck className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
          )}
          {order.deliveryMethod !== "VENDOR_DELIVERY"
            ? t("pickupAt", { place: pickupPlace })
            : t("deliverTo", { address: order.deliveryAddress ?? "" })}
        </p>
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
          {t(`payment.${order.paymentMethod}`)}
        </p>
      </div>

      <ul className="flex flex-col gap-1.5 border-t border-line pt-3">
        {order.items.map((item) => (
          <li key={item.id} className="type-body flex justify-between gap-3 text-ink-secondary">
            <span className="min-w-0">
              {item.quantity} × {item.title}
              {item.bargained && (
                <span className="type-caption ml-2 rounded-sm bg-highlight-soft px-1.5 py-0.5 text-highlight">🤝 {t("bargained")}</span>
              )}
            </span>
            <span className="type-price shrink-0">{formatTaka(item.lineTotal, locale)}</span>
          </li>
        ))}
      </ul>

      <dl className="flex flex-col gap-1 border-t border-line pt-3">
        <div className="type-body flex justify-between text-ink-secondary">
          <dt>{t("subtotal")}</dt>
          <dd className="type-price">{formatTaka(order.subtotal, locale)}</dd>
        </div>
        {(order.discount ?? 0) > 0 && (
          <div className="type-body flex justify-between text-success-ink">
            <dt>{t("couponLine", { code: order.couponCode ?? "" })}</dt>
            <dd className="type-price">−{formatTaka(order.discount ?? 0, locale)}</dd>
          </div>
        )}
        {(order.creditUsed ?? 0) > 0 && (
          <div className="type-body flex justify-between text-success-ink">
            <dt>{t("creditLine")}</dt>
            <dd className="type-price">−{formatTaka(order.creditUsed ?? 0, locale)}</dd>
          </div>
        )}
        <div className="type-body flex justify-between text-ink-secondary">
          <dt>{t("deliveryFee")}</dt>
          <dd className="type-price">{order.deliveryFee > 0 ? formatTaka(order.deliveryFee, locale) : t("free")}</dd>
        </div>
        <div className="type-body-medium flex justify-between text-ink">
          <dt>{t("total")}</dt>
          <dd className="type-price">{formatTaka(order.total, locale)}</dd>
        </div>
      </dl>

      {canPay && !cancelOpen && (
        <div className="flex flex-col gap-2 border-t border-gold pt-3">
          <button
            type="button"
            onClick={() => pay.mutate()}
            disabled={pay.isPending}
            aria-busy={pay.isPending}
            className={cn(primaryButton, "w-full disabled:cursor-not-allowed disabled:opacity-80")}
          >
            {pay.isPending && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
            {pay.isPending ? t("paying") : t("payNow", { amount: formatTaka(order.total, locale) })}
          </button>
          <p className="type-caption text-ink-muted">{t("testPayment")}</p>
        </div>
      )}

      {justPaid && order.paymentStatus === "PAID" && (
        <p role="status" className="type-body flex items-center gap-2 text-success-ink">
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          {t("paid")}
        </p>
      )}
      {payError && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {payError}
        </p>
      )}

      {/* Cancelling: only while the shop hasn't confirmed the order yet */}
      {canCancel && !cancelOpen && (
        <button
          type="button"
          onClick={() => setCancelOpen(true)}
          className="type-body-medium flex h-11 items-center self-start rounded-sm px-2 text-ink-secondary underline-offset-4 hover:text-error hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          {t("cancel.button")}
        </button>
      )}

      {canCancel && cancelOpen && (
        <form onSubmit={onCancel} noValidate className="flex flex-col gap-3 rounded-md border border-error/40 bg-error-soft/40 p-3">
          <p className="type-body-medium text-ink">{t("cancel.title")}</p>
          <p className="type-caption text-ink-secondary">{t("cancel.text")}</p>
          <label htmlFor={reasonId} className="type-body-medium text-ink">
            {t("cancel.reason")}
          </label>
          <textarea
            id={reasonId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder={t("cancel.reasonPlaceholder")}
            className="type-body w-full rounded-md border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setCancelOpen(false);
                setCancelError(null);
              }}
              disabled={cancel.isPending}
              className="type-body-medium flex h-12 items-center justify-center rounded-sm border border-ink px-4 text-ink hover:bg-subtle"
            >
              {t("cancel.keep")}
            </button>
            <button
              type="submit"
              disabled={cancel.isPending}
              aria-busy={cancel.isPending}
              className="type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-error px-4 text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {cancel.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {cancel.isPending ? t("cancel.cancelling") : t("cancel.confirm")}
            </button>
          </div>
        </form>
      )}

      {cancelError && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {cancelError}
        </p>
      )}
      {justCancelled && order.status === "CANCELLED" && (
        <p role="status" className="type-body flex items-center gap-2 text-ink-secondary">
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          {t("cancel.done")}
        </p>
      )}

      {order.status === "COMPLETED" && (
        <section className="flex flex-col gap-3 border-t border-gold pt-4">
          <div>
            <h3 className="type-h3 text-ink">{tReviews("rateTitle")}</h3>
            <p className="type-caption text-ink-muted">{tReviews("rateText")}</p>
          </div>
          <ReviewForm orderId={order.id} type="SHOP_TRUST" title={tReviews("shopTitle", { shop: order.shop.name })} />
          {order.items
            .filter((item) => item.productId)
            .map((item) => (
              <ReviewForm key={item.id} orderId={order.id} type="PRODUCT" productId={item.productId} title={tReviews("productTitle", { product: item.title })} />
            ))}


                  <RequestReturn orderId={order.id} />
        </section>
      )}


    </article>
  );
}