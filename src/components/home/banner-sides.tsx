"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, MapPin, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { useSession } from "@/components/app-providers";
import { Link } from "@/i18n/routing";
import type { Category } from "@/lib/api/catalog";
import { listOrders } from "@/lib/api/checkout";
import type { Market } from "@/lib/api/shops";
import { cn } from "@/lib/utils";

// Same height as the banner: a card that fills its grid cell.
const PANEL = "flex h-full min-h-0 flex-col gap-3 overflow-hidden rounded-3xl border border-line bg-card p-4 shadow-card";
const ROW =
  "group flex min-h-11 items-center justify-between gap-2 rounded-xl px-2 text-ink-secondary hover:bg-subtle hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none";
const arrow = <ChevronRight className="size-4 shrink-0 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-0.5" aria-hidden />;

// False on the server and during hydration, true afterwards. The server can't know who is
// logged in, so the first browser render must match the guest version; then we switch.
const noop = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="type-caption flex items-center gap-2 tracking-wide text-ink-muted uppercase">
      <span aria-hidden className="size-1.5 rotate-45 bg-gold" />
      {children}
    </h2>
  );
}

function Markets({ markets }: { markets: Market[] }) {
  const t = useTranslations("BannerSides");
  if (markets.length === 0) return null;
  return (
    <nav aria-label={t("markets")} className="mt-auto flex flex-col gap-1 border-t border-line pt-3">
      <Heading>{t("markets")}</Heading>
      <ul className="flex flex-col">
        {markets.map((m) => (
          <li key={m.id}>
            <Link href={`/markets/${encodeURIComponent(m.slug)}`} className={cn(ROW, "type-body")}>
              <span className="flex min-w-0 items-center gap-2">
                <Store className="size-4 shrink-0 text-highlight" aria-hidden />
                <span className="truncate">{m.name}</span>
              </span>
              <span className="type-caption shrink-0 text-ink-muted">{t("shops", { count: m.shopCount })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Personal({ name }: { name: string }) {
  const t = useTranslations("BannerSides");
  const tOrder = useTranslations("Order");
  const latest = useQuery({
    queryKey: ["orders", "latest"],
    queryFn: () => listOrders({ page: 1, limit: 1 }),
    select: (r) => r.data[0] ?? null,
  });
  const order = latest.data;

  return (
    <section aria-label={t("yourCorner")} className="flex flex-col gap-2">
      <p className="type-h3 truncate text-ink">{t("hello", { name })}</p>
      {latest.isPending ? (
        <div className="h-14 skeleton rounded-xl" aria-hidden />
      ) : order ? (
        <Link
          href={`/account/orders/${order.id}`}
          className="group flex min-h-11 flex-col gap-1 rounded-2xl bg-subtle p-3 hover:bg-highlight-soft focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          <span className="type-caption text-ink-muted">{t("latestOrder")}</span>
          <span className="type-body-medium truncate text-ink">{tOrder("orderNumber", { number: order.orderNumber })}</span>
          <span className="flex items-center justify-between gap-2">
            <span className="type-caption truncate text-brand">{tOrder(`status.${order.status}`)}</span>
            <span className="type-caption inline-flex shrink-0 items-center gap-1 text-brand">
              <MapPin className="size-3.5" aria-hidden />
              {t("track")}
            </span>
          </span>
        </Link>
      ) : (
        <Link href="/search" className={cn(ROW, "type-body-medium -mx-2 text-brand")}>
          {t("startShopping")}
          {arrow}
        </Link>
      )}
    </section>
  );
}

/**
 * Left of the banner. Top: the visitor's latest order (logged in) or popular categories (guests).
 * Bottom: the busiest markets.
 */
export function BannerLeft({ categories, markets }: { categories: Category[]; markets: Market[] }) {
  const t = useTranslations("BannerSides");
  const { status, user } = useSession();
  const mounted = useMounted();
  const loggedIn = mounted && status === "authenticated" && !!user;

  return (
    <div className={PANEL}>
      {loggedIn ? (
        <Personal name={user.name.trim().split(/\s+/)[0]} />
      ) : (
        <nav aria-label={t("categories")} className="flex flex-col gap-1">
          <Heading>{t("categories")}</Heading>
          <ul className="flex flex-col">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/search?category=${encodeURIComponent(c.slug)}`} className={cn(ROW, "type-body")}>
                  <span className="truncate">{c.name}</span>
                  {arrow}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <Markets markets={markets} />
    </div>
  );
}
