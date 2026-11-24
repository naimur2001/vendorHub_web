"use client";

import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/app-providers";
import { AccountBack } from "@/components/layout/account-menu";
import { OrderBadges } from "@/components/checkout/order-confirmation";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { Link } from "@/i18n/routing";
import { getOrder, orderKeys, type OrderDetail, type OrderStatus } from "@/lib/api/checkout";
import { ApiError } from "@/lib/api/core";
import { cn } from "@/lib/utils";
import { OrderChat } from "@/components/orders/order-chat";
import { CourierStatus } from "@/components/orders/courier-status";

const DONE: OrderStatus[] = ["COMPLETED", "CANCELLED"];
const REFRESH_MS = 30_000;

const buttonClass =
  "type-body-medium inline-flex h-11 items-center justify-center rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none";

export function OrderTracker({ orderId }: { orderId: string }) {
  const t = useTranslations("OrderTracking");
  const tOrder = useTranslations("Order");
  const { status: session } = useSession();

  const order = useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: () => getOrder(orderId),
    enabled: session === "authenticated",
    // Keeps checking while the shop is still working on the order.
    refetchInterval: (q) => (q.state.data && DONE.includes(q.state.data.status) ? false : REFRESH_MS),
    retry: (count, err) => !(err instanceof ApiError && (err.status === 404 || err.status === 403)) && count < 2,
  });

  if (session === "loading" || (session === "authenticated" && order.isPending)) {
    return (
      <p role="status" className="type-body flex items-center justify-center gap-2 py-12 text-ink-secondary">
        <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden />
        {t("loading")}
      </p>
    );
  }

  if (session !== "authenticated") {
    const next = `/account/orders/${orderId}`;
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="type-h3 text-ink">{t("guestTitle")}</p>
        <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className={buttonClass}>
          {tOrder("logIn")}
        </Link>
      </div>
    );
  }

  if (order.isError || !order.data) {
    const missing = order.error instanceof ApiError && (order.error.status === 404 || order.error.status === 403);
    return (
      <div role="alert" className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="type-h3 text-ink">{missing ? t("notFoundTitle") : t("loadError")}</p>
        {missing ? (
          <Link href="/account/orders" className={buttonClass}>
            {t("backToOrders")}
          </Link>
        ) : (
          <button type="button" onClick={() => order.refetch()} className={buttonClass}>
            {tOrder("retry")}
          </button>
        )}
      </div>
    );
  }

  return <TrackerView order={order.data} refreshing={order.isFetching} />;
}

function TrackerView({ order, refreshing }: { order: OrderDetail; refreshing: boolean }) {
  const t = useTranslations("OrderTracking");
  const tOrder = useTranslations("Order");
  const live = !DONE.includes(order.status);

  return (
    <>
      <AccountBack />
      <header className="flex flex-col gap-2">
        <h1 className="type-display text-ink">{t("title")}</h1>
        <p className="type-body text-ink-secondary">
          {tOrder("orderNumber", { number: order.orderNumber })} · {order.shop.name}
        </p>
        <OrderBadges order={order} />
      </header>

      <section aria-labelledby="tracking-heading" className="rounded-md border border-line bg-card p-4 shadow-card md:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id="tracking-heading" className="type-h3 text-ink">
            {t("timeline")}
          </h2>
          {live && (
            <span className="type-caption flex items-center gap-1.5 text-ink-muted" aria-live="polite">
              {refreshing && <LoaderCircle className="size-3.5 motion-safe:animate-spin" aria-hidden />}
              {t("autoRefresh")}
            </span>
          )}
        </div>

        <OrderTimeline order={order} />
      </section>

      {order.shipment && <CourierStatus shipment={order.shipment} />}

      <OrderChat scope={{ kind: "customer", orderId: order.id }} />

      <Link href={`/checkout/${order.checkoutId}`} className={cn(buttonClass, "self-start")}>
        {t("viewDetails")}
      </Link>
    </>
  );
}
