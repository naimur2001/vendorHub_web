"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, MapPin, PackageSearch, ShoppingCart, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { useSession } from "@/components/app-providers";
import { useCartCount } from "@/components/cart/cart-badge";
import { Link } from "@/i18n/routing";
import type { Category } from "@/lib/api/catalog";
import { listOrders } from "@/lib/api/checkout";
import type { Market } from "@/lib/api/shops";
import { cn } from "@/lib/utils";

// Same height as the banner: a card that fills its grid cell.
const PANEL = "flex h-full min-h-0 flex-col gap-2 overflow-hidden rounded-3xl border border-line bg-card p-4 shadow-card";
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

/** Left of the banner: the visitor's latest order (logged in) or popular categories (guests). */
export function BannerLeft({ categories }: { categories: Category[] }) {
  const t = useTranslations("BannerSides");
  const tOrder = useTranslations("Order");
  const { status, user } = useSession();
  const mounted = useMounted();
  const loggedIn = mounted && status === "authenticated" && !!user;

  const latest = useQuery({
    queryKey: ["orders", "latest"],
    queryFn: () => listOrders({ page: 1, limit: 1 }),
    enabled: loggedIn,
    select: (r) => r.data[0] ?? null,
  });

  if (loggedIn) {
    const first = user.name.trim().split(/\s+/)[0];
    const order = latest.data;
    return (
      <aside aria-label={t("yourCorner")} className={PANEL}>
        <p className="type-h3 truncate text-ink">{t("hello", { name: first })}</p>
        <Heading>{t("latestOrder")}</Heading>
        {latest.isPending ? (
          <div className="h-20 skeleton rounded-xl" aria-hidden />
        ) : order ? (
          <div className="flex flex-col gap-2 rounded-2xl bg-subtle p-3">
            <p className="type-body-medium truncate text-ink">{tOrder("orderNumber", { number: order.orderNumber })}</p>
            <p className="type-caption truncate text-ink-secondary">{order.shop.name}</p>
            <span className="type-caption self-start rounded-full bg-card px-2 py-0.5 text-brand">{tOrder(`status.${order.status}`)}</span>
            <Link
              href={`/account/orders/${order.id}`}
              className="type-body-medium mt-auto inline-flex h-11 items-center justify-center gap-1.5 rounded-sm bg-action px-3 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <MapPin className="size-4" aria-hidden />
              {t("track")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-start justify-center gap-2">
            <PackageSearch className="size-6 text-ink-muted" aria-hidden />
            <p className="type-caption text-ink-secondary">{t("noOrders")}</p>
            <Link href="/search" className={cn(ROW, "type-body-medium -mx-2 text-brand")}>
              {t("startShopping")}
              {arrow}
            </Link>
          </div>
        )}
      </aside>
    );
  }

  return (
    <nav aria-label={t("categories")} className={PANEL}>
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
      <Link href="/search" className="type-caption mt-auto px-2 text-brand underline-offset-4 hover:underline">
        {t("allProducts")}
      </Link>
    </nav>
  );
}

/** Right of the banner: the cart (logged in, when not empty) and the busiest markets. */
export function BannerRight({ markets }: { markets: Market[] }) {
  const t = useTranslations("BannerSides");
  const mounted = useMounted();
  const count = useCartCount();
  const cartCount = mounted ? count : 0;
  const shown = cartCount > 0 ? markets.slice(0, 2) : markets;

  return (
    <aside aria-label={t("markets")} className={PANEL}>
      {cartCount > 0 && (
        <Link
          href="/cart"
          className="group flex min-h-11 items-center gap-3 rounded-2xl bg-highlight-soft p-3 text-ink hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          <ShoppingCart className="size-5 shrink-0 text-highlight" aria-hidden />
          <span className="type-body-medium flex-1">{t("cart", { count: cartCount })}</span>
          {arrow}
        </Link>
      )}
      <Heading>{t("markets")}</Heading>
      <ul className="flex flex-col">
        {shown.map((m) => (
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
      <Link href="/markets" className="type-caption mt-auto px-2 text-brand underline-offset-4 hover:underline">
        {t("allMarkets")}
      </Link>
    </aside>
  );
}
