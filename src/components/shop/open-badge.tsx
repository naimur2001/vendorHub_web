"use client";

import { useNow, useTranslations } from "next-intl";
import { Suspense } from "react";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/utils";

export type OpeningDay = components["schemas"]["OpeningDay"];
export type ShopHours = { hours?: OpeningDay[] | null; weeklyHoliday?: number | null };

// Dhaka is UTC+6 all year (no daylight saving), so the shop's local time is a fixed shift.
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const TIME = /^([01]\d|2[0-4]):([0-5]\d)$/;

function toMinutes(value: string | null): number | null {
  const m = value ? TIME.exec(value) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

type DayRange = { open: number; close: number }; // close > 1440 when it runs past midnight

function rangeFor(shop: ShopHours, day: number): DayRange | null {
  if (shop.weeklyHoliday === day) return null;
  const entry = shop.hours?.find((d) => d.day === day);
  if (!entry || entry.closed) return null;
  const open = toMinutes(entry.open);
  const close = toMinutes(entry.close);
  if (open === null || close === null || open === close) return null;
  return { open, close: close < open ? close + 1440 : close };
}

const hhmm = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export type OpenState = { open: true; until: string } | { open: false; opensAt: string | null } | null;

/** Open right now in Dhaka? null when the shop has not set its hours. */
export function openState(shop: ShopHours, now: Date): OpenState {
  if (!shop.hours || shop.hours.length === 0) return null;
  const local = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const day = local.getUTCDay();
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();

  const yesterday = rangeFor(shop, (day + 6) % 7);
  if (yesterday && yesterday.close > 1440 && minute < yesterday.close - 1440) return { open: true, until: hhmm(yesterday.close) };
  const today = rangeFor(shop, day);
  if (today && minute >= today.open && minute < today.close) return { open: true, until: hhmm(today.close) };
  if (today && minute < today.open) return { open: false, opensAt: hhmm(today.open) };
  return { open: false, opensAt: null };
}

function Badge({ shop, detailed, className }: { shop: ShopHours; detailed: boolean; className?: string }) {
  const t = useTranslations("ShopHours");
  const now = useNow({ updateInterval: 60_000 });
  const state = openState(shop, now);
  if (!state) return null;

  const text = state.open
    ? detailed
      ? t("openUntil", { time: state.until })
      : t("open")
    : detailed && state.opensAt
      ? t("closedOpensAt", { time: state.opensAt })
      : t("closed");

  return (
    <span
      className={cn(
        "type-caption inline-flex items-center gap-1.5 rounded-full px-2 py-0.5",
        state.open ? "bg-success-soft text-success-ink" : "bg-subtle text-ink-secondary",
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", state.open ? "bg-success-ink" : "bg-ink-muted")} />
      {text}
    </span>
  );
}

/** "Open now" / "Closed" pill. Reads the time, so it waits inside its own Suspense. */
export function OpenBadge(props: { shop: ShopHours; detailed?: boolean; className?: string }) {
  return (
    <Suspense fallback={null}>
      <Badge shop={props.shop} detailed={props.detailed ?? false} className={props.className} />
    </Suspense>
  );
}

const DAY_ORDER = [6, 0, 1, 2, 3, 4, 5]; // Saturday first, as the Bangladeshi week starts

/** The week's opening hours, today highlighted (storefront). */
export function HoursList({ shop }: { shop: ShopHours }) {
  const t = useTranslations("ShopHours");
  if (!shop.hours || shop.hours.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      {DAY_ORDER.map((day) => {
        const r = rangeFor(shop, day);
        return (
          <div key={day} className="contents">
            <dt className="type-caption text-ink-secondary">{t(`days.${day}`)}</dt>
            <dd className="type-caption text-ink">
              {shop.weeklyHoliday === day ? t("holiday") : r ? `${hhmm(r.open)} – ${hhmm(r.close)}` : t("closed")}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
