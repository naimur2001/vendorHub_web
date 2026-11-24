"use client";

import { Check, Copy, PackageCheck, Truck, TriangleAlert, Undo2 } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { ShipmentStatus } from "@/lib/api/delivery";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

type Shipment = {
  status: ShipmentStatus;
  timeline: { status: ShipmentStatus; at: string }[];
  courier: { name?: string } | null;
  trackingCode: string | null;
};
type ShopExtras = { codAmount: number; shopPaid: boolean; bookingFailed: boolean };

const AFTER_PICKUP: ShipmentStatus[] = ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RETURNING", "RETURNED"];
const PROBLEM: ShipmentStatus[] = ["FAILED", "RETURNING", "RETURNED", "CANCELLED"];
// The four stops shown to people: handed to the courier, on the way, out for delivery, delivered.
const STOPS: { key: string; reached: ShipmentStatus[] }[] = [
  { key: "pickedUp", reached: ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"] },
  { key: "inTransit", reached: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"] },
  { key: "outForDelivery", reached: ["OUT_FOR_DELIVERY", "DELIVERED"] },
  { key: "delivered", reached: ["DELIVERED"] },
];

/**
 * The parcel's journey with the courier. Customers get the courier name and tracking code only once
 * the parcel is picked up (the server sends null before that). The shop also sees cash on delivery and payout.
 */
export function CourierStatus({ shipment, shop }: { shipment: Shipment; shop?: ShopExtras }) {
  const t = useTranslations("CourierStatus");
  const format = useFormatter();
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const picked = AFTER_PICKUP.includes(shipment.status);
  const problem = PROBLEM.includes(shipment.status);
  const name = shipment.courier?.name;
  const when = (iso: string) => format.dateTime(new Date(iso), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const reachedAt = (s: ShipmentStatus[]) => shipment.timeline.find((e) => s.includes(e.status))?.at;

  async function copy() {
    if (!shipment.trackingCode) return;
    try {
      await navigator.clipboard.writeText(shipment.trackingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the code is still on screen to copy by hand
    }
  }

  return (
    <section aria-labelledby="courier-title" className="flex flex-col gap-4 rounded-md border border-gold bg-card p-4 shadow-card md:p-6">
      <div className="flex items-start gap-3">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", problem ? "bg-error-soft text-error" : "bg-highlight-soft text-highlight")}>
          {problem ? <TriangleAlert className="size-5" aria-hidden /> : shipment.status === "DELIVERED" ? <PackageCheck className="size-5" aria-hidden /> : <Truck className="size-5" aria-hidden />}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="courier-title" className="type-h3 text-ink">{t(`title.${shipment.status}`)}</h2>
          <p className="type-body text-ink-secondary" aria-live="polite">
            {picked && name ? t("byCourier", { name }) : shop && name ? t("courierShop", { name }) : t("notPickedYet")}
          </p>
        </div>
      </div>

      {shipment.trackingCode && (
        <div className="flex flex-wrap items-center gap-2 rounded-sm bg-subtle px-3 py-2">
          <span className="type-caption text-ink-secondary">{t("tracking")}</span>
          <span className="type-body-medium font-mono text-ink">{shipment.trackingCode}</span>
          <button type="button" onClick={copy} aria-label={t("copy")} className="ml-auto flex size-11 items-center justify-center rounded-full text-brand hover:bg-card focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          </button>
          <span role="status" className="sr-only">{copied ? t("copied") : ""}</span>
        </div>
      )}

      {!problem ? (
        <ol className="flex flex-col">
          {STOPS.map((s, i) => {
            const at = reachedAt(s.reached);
            const done = s.reached.includes(shipment.status);
            const current = done && (i === STOPS.length - 1 || !STOPS[i + 1].reached.includes(shipment.status));
            return (
              <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
                {i < STOPS.length - 1 && (
                  <span aria-hidden className="absolute top-6 left-[11px] h-[calc(100%-1.5rem)] w-0.5 bg-line">
                    {STOPS[i + 1].reached.includes(shipment.status) && <span className="absolute inset-0 origin-top bg-gold motion-safe:animate-[vh-grow-up_300ms_cubic-bezier(0.22,1,0.36,1)_backwards]" />}
                  </span>
                )}
                <span className={cn("relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2", done ? (current ? "border-brand bg-brand text-primary-foreground ring-4 ring-brand/15" : "border-gold bg-gold text-ink") : "border-line-strong bg-card")}>
                  {done && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                </span>
                <span className="flex flex-col">
                  <span className={cn("type-body-medium", done ? "text-ink" : "text-ink-muted")}>{t(`stops.${s.key}`)}</span>
                  {at && <span className="type-caption text-ink-muted">{when(at)}</span>}
                  <span className="sr-only">{done ? t("done") : t("notYet")}</span>
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="type-body flex items-start gap-2 rounded-sm bg-error-soft p-3 text-ink">
          <Undo2 className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
          {t(`problem.${shipment.status}`)}
        </p>
      )}

      {shop && (
        <div className="flex flex-col gap-1 border-t border-line pt-3">
          {shop.bookingFailed && <p role="alert" className="type-body text-error">{t("bookingFailed")}</p>}
          {shop.codAmount > 0 && <p className="type-body text-ink-secondary">{t("cod", { amount: formatTaka(shop.codAmount, locale) })}</p>}
          <p className={cn("type-body-medium", shop.shopPaid ? "text-success-ink" : "text-ink-secondary")}>{shop.shopPaid ? t("paid") : t("notPaid")}</p>
        </div>
      )}
    </section>
  );
}
