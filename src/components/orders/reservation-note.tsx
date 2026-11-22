"use client";

import { Clock } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { DeliveryMethod, OrderStatus } from "@/lib/api/checkout";

type Reservable = {
  deliveryMethod: DeliveryMethod;
  status: OrderStatus;
  reservedUntil?: string | null;
  confirmBy?: string | null;
};

/** Deadlines of an open "reserve for pickup" order. Nothing for other orders or finished ones. */
export function ReservationNote({ order, audience }: { order: Reservable; audience: "customer" | "shop" }) {
  const t = useTranslations("Reservation");
  const format = useFormatter();
  if (order.deliveryMethod !== "RESERVE_PICKUP" || order.status === "COMPLETED" || order.status === "CANCELLED") return null;
  const time = (iso: string) => format.dateTime(new Date(iso), { hour: "numeric", minute: "2-digit" });

  return (
    <>
      {order.reservedUntil && (
        <span className="type-caption inline-flex items-center gap-1 rounded-full bg-highlight-soft px-2.5 py-0.5 text-highlight">
          <Clock className="size-3.5" aria-hidden />
          {t("heldUntil", { time: time(order.reservedUntil) })}
        </span>
      )}
      {order.status === "PLACED" && order.confirmBy && (
        <span className="type-caption inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-ink">
          {t(audience === "shop" ? "confirmBy" : "shopConfirmsBy", { time: time(order.confirmBy) })}
        </span>
      )}
    </>
  );
}
