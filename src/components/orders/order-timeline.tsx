"use client";

import { Check, X } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import type { DeliveryMethod, OrderStatus, OrderStatusEvent } from "@/lib/api/checkout";
import { cn } from "@/lib/utils";

// What the timeline needs; customer and shop orders both have it.
export type TimelineOrder = {
  status: OrderStatus;
  deliveryMethod: DeliveryMethod;
  createdAt: string;
  statusEvents?: OrderStatusEvent[];
};

type Step = { status: OrderStatus; at: string | null; note: string | null; state: "done" | "current" | "todo" | "cancelled" };

// The path depends on how the order reaches the customer; times come from the saved events.
function buildSteps(order: TimelineOrder): Step[] {
  const path: OrderStatus[] = [
    "PLACED",
    "CONFIRMED",
    order.deliveryMethod === "STORE_PICKUP" ? "READY_FOR_PICKUP" : "OUT_FOR_DELIVERY",
    "COMPLETED",
  ];
  const latest = new Map<OrderStatus, { at: string; note: string | null }>();
  for (const e of order.statusEvents ?? []) latest.set(e.status, { at: e.createdAt, note: e.note });
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

// Must render inside <Suspense> (reads the current time).
export function OrderTimeline({ order }: { order: TimelineOrder }) {
  const t = useTranslations("OrderTracking");
  const tOrder = useTranslations("Order");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const steps = buildSteps(order);

  return (
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
              {/* Customer/shop text: plain text, React escapes it */}
              {step.note && <p className="type-caption break-words text-ink-secondary">{t("reason", { reason: step.note })}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
