"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, LoaderCircle, X } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useSession } from "@/components/app-providers";
import { AccountBack } from "@/components/layout/account-menu";
import { OrderBadges } from "@/components/checkout/order-confirmation";
import { Link } from "@/i18n/routing";
import { getOrder, orderKeys, type OrderDetail, type OrderStatus } from "@/lib/api/checkout";
import { ApiError } from "@/lib/api/core";
import { cn } from "@/lib/utils";

const DONE: OrderStatus[] = ["COMPLETED", "CANCELLED"];
const REFRESH_MS = 30_000;

const buttonClass =
  "type-body-medium inline-flex h-11 items-center justify-center rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none";

type Step = { status: OrderStatus; at: string | null; note: string | null; state: "done" | "current" | "todo" | "cancelled" };

// The path depends on how the order reaches the customer; times come from the saved events.
function buildSteps(order: OrderDetail): Step[] {
  const path: OrderStatus[] = [
    "PLACED",
    "CONFIRMED",
    order.deliveryMethod === "STORE_PICKUP" ? "READY_FOR_PICKUP" : "OUT_FOR_DELIVERY",
    "COMPLETED",
  ];
  const latest = new Map<OrderStatus, { at: string; note: string | null }>();
  for (const e of order.statusEvents) latest.set(e.status, { at: e.createdAt, note: e.note });
  // Older orders may have no PLACED event; the order's own date stands in.
  if (!latest.has("PLACED")) latest.set("PLACED", { at: order.createdAt, note: null });

  if (order.status === "CANCELLED") {
    const reached: Step[] = path
      .filter((s) => latest.has(s))
      .map((s) => ({ status: s, at: latest.get(s)!.at, note: null, state: "done" }));
    const c = latest.get("CANCELLED");
    return [...reached, { status: "CANCELLED", at: c?.at ?? null, note: c?.note ?? null, state: "cancelled" }];
  }

  const currentIndex = Math.max(0, path.indexOf(order.status));
  return path.map((s, i) => ({
    status: s,
    at: i <= currentIndex ? (latest.get(s)?.at ?? null) : null,
    note: null,
    state: i < currentIndex || order.status === "COMPLETED" ? "done" : i === currentIndex ? "current" : "todo",
  }));
}

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
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const steps = buildSteps(order);
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

        <ol className="flex flex-col">
          {steps.map((step, i) => {
            const last = i === steps.length - 1;
            return (
              <li
                key={step.status}
                aria-current={step.state === "current" ? "step" : undefined}
                className="relative flex gap-4 pb-6 last:pb-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
              >
                {!last && (
                  <span
                    aria-hidden
                    className={cn("absolute top-8 left-[15px] h-[calc(100%-2rem)] w-0.5", step.state === "done" ? "bg-brand" : "bg-line")}
                  />
                )}
                <span
                  aria-hidden
                  className={cn(
                    "relative flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                    step.state === "done" && "border-brand bg-brand text-primary-foreground",
                    step.state === "current" && "border-brand bg-card text-brand",
                    step.state === "todo" && "border-line bg-card text-ink-disabled",
                    step.state === "cancelled" && "border-error bg-error-soft text-error",
                  )}
                >
                  {step.state === "done" && <Check className="size-4" />}
                  {step.state === "cancelled" && <X className="size-4" />}
                  {step.state === "current" && <span className="size-2.5 rounded-full bg-brand" />}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5 pt-1">
                  <p className={cn("type-body-medium", step.state === "todo" ? "text-ink-muted" : "text-ink")}>
                    {tOrder(`status.${step.status}`)}
                    <span className="sr-only"> ({t(`state.${step.state}`)})</span>
                  </p>
                  {step.at ? (
                    <p className="type-caption text-ink-muted">
                      <time dateTime={step.at} title={format.dateTime(new Date(step.at), { dateStyle: "medium", timeStyle: "short" })}>
                        {format.relativeTime(new Date(step.at), now)}
                      </time>
                    </p>
                  ) : step.state === "todo" ? (
                    <p className="type-caption text-ink-muted">{t("waiting")}</p>
                  ) : null}
                  {step.note && <p className="type-caption break-words text-ink-secondary">{t("reason", { reason: step.note })}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <Link href={`/checkout/${order.checkoutId}`} className={cn(buttonClass, "self-start")}>
        {t("viewDetails")}
      </Link>
    </>
  );
}
