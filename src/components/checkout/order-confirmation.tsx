"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, LoaderCircle, MapPin, PackageCheck, SearchX, Store, Truck } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/app-providers";
import { VerificationSeal } from "@/components/brand/verification-seal";
import { Link } from "@/i18n/routing";
import {
  checkoutKeys,
  getCheckout,
  payMockOrder,
  type CheckoutResult,
  type Order,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/api/checkout";
import { ApiError } from "@/lib/api/core";
import { shopPlace } from "@/lib/api/storefront";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-8 text-center">
        <PackageCheck className="size-12 text-success-ink" strokeWidth={1.5} aria-hidden />
        <h1 className="type-h2 text-ink">{t("placedTitle", { count: result.orders.length })}</h1>
        <p className="type-body max-w-lg text-ink-secondary">{t("placedText")}</p>
        <p className="type-body-medium text-ink">
          {t("checkoutTotal")}: <span className="type-price">{formatTaka(result.totalAmount, locale)}</span>
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
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

function OrderCard({ order, checkoutId }: { order: Order; checkoutId: string }) {
  const t = useTranslations("Order");
  const locale = useLocale();
  const format = useFormatter();
  const queryClient = useQueryClient();
  const [payError, setPayError] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);

  const canPay = order.paymentMethod === "ONLINE" && order.paymentStatus === "PENDING" && order.status !== "CANCELLED";
  const pickupPlace = [shopPlace(order.shop.levelFloor, order.shop.shopNumber), order.shop.addressLine].filter(Boolean).join(", ");

  const pay = useMutation({
    // Only the order id is sent; the amount is the server's.
    mutationFn: () => payMockOrder(order.id),
    onMutate: () => setPayError(null),
    onSuccess: (updated) => {
      queryClient.setQueryData<CheckoutResult>(checkoutKeys.checkout(checkoutId), (old) =>
        old ? { ...old, orders: old.orders.map((o) => (o.id === updated.id ? updated : o)) } : old,
      );
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
        <OrderBadges order={order} />
      </header>

      <div className="type-body flex flex-col gap-1.5 text-ink-secondary">
        <p className="flex items-start gap-2">
          {order.deliveryMethod === "STORE_PICKUP" ? (
            <Store className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
          ) : (
            <Truck className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
          )}
          {order.deliveryMethod === "STORE_PICKUP"
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
        <div className="type-body flex justify-between text-ink-secondary">
          <dt>{t("deliveryFee")}</dt>
          <dd className="type-price">{order.deliveryFee > 0 ? formatTaka(order.deliveryFee, locale) : t("free")}</dd>
        </div>
        <div className="type-body-medium flex justify-between text-ink">
          <dt>{t("total")}</dt>
          <dd className="type-price">{formatTaka(order.total, locale)}</dd>
        </div>
      </dl>

      {canPay && (
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
    </article>
  );
}