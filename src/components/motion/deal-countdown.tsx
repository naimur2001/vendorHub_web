"use client";

import { Timer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

// One shared 1-second clock for every countdown on the page.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function subscribe(onTick: () => void) {
  listeners.add(onTick);
  timer ??= setInterval(() => listeners.forEach((l) => l()), 1000);
  return () => {
    listeners.delete(onTick);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
const nowSeconds = () => Math.floor(Date.now() / 1000);
const onServer = () => null; // no clock while prerendering: the time is shown after load

/**
 * "Ends in 05:12:09" for a flash deal. Hours and minutes flip in when they change
 * (CSS, motion-safe only); seconds just change, so nothing moves every second.
 */
export function DealCountdown({ endsAt, className }: { endsAt: string; className?: string }) {
  const t = useTranslations("Deals");
  const locale = useLocale();
  const now = useSyncExternalStore(subscribe, nowSeconds, onServer);
  const end = Math.floor(new Date(endsAt).getTime() / 1000);

  if (now === null) {
    return <span className={cn("type-caption inline-block h-6 w-24 skeleton rounded-full", className)} aria-hidden />;
  }
  const left = end - now;
  if (left <= 0) {
    return <span className={cn("type-caption rounded-full bg-subtle px-2.5 py-1 text-ink-muted", className)}>{t("ended")}</span>;
  }

  const days = Math.floor(left / 86_400);
  const h = Math.floor((left % 86_400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const two = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 });

  return (
    <span role="timer" className={cn("type-caption inline-flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-1 text-primary-foreground", className)}>
      <Timer className="size-3.5 shrink-0 text-gold" aria-hidden />
      {/* Screen readers get a calm minute-level text; the ticking digits are hidden from them */}
      <span className="sr-only">{t("endsInSr", { days, hours: h, minutes: m })}</span>
      <span aria-hidden className="inline-flex items-center gap-0.5 [font-variant-numeric:tabular-nums]">
        {days > 0 && <span className="mr-1">{t("days", { count: days })}</span>}
        <Flip value={two.format(h)} />:
        <Flip value={two.format(m)} />:
        <span>{two.format(s)}</span>
      </span>
    </span>
  );
}

// Re-keyed on every new value, so the new digits drop in once (200 ms, transform + opacity).
function Flip({ value }: { value: string }) {
  return (
    <span className="inline-block overflow-hidden">
      <span key={value} className="inline-block motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-200">
        {value}
      </span>
    </span>
  );
}
