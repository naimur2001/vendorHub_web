"use client";

import { useQuery } from "@tanstack/react-query";
import { Boxes, Inbox, LayoutDashboard, PackageCheck, ShieldCheck, type LucideIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/app-providers";
import { Link, usePathname } from "@/i18n/routing";
import { getShopDashboard, ownerKeys, type ShopDashboard } from "@/lib/api/owner";
import { getMyShops, shopKeys } from "@/lib/api/shops";
import { cn } from "@/lib/utils";

type TabKey = "dashboard" | "orders" | "offers" | "listings" | "verification";

type Tab = {
  key: TabKey;
  href: string;
  icon: LucideIcon;
  exact?: boolean; // the dashboard is only active on /owner itself
  ownerOnly?: boolean; // shop setup and verification: owners only
  count?: (d: ShopDashboard) => number;
  keepShop?: boolean; // carries ?shop= along when several shops exist
};

const TABS: Tab[] = [
  { key: "dashboard", href: "/owner", icon: LayoutDashboard, exact: true, keepShop: true },
  { key: "orders", href: "/owner/orders", icon: PackageCheck, keepShop: true, count: (d) => d.actions.ordersToConfirm },
  { key: "offers", href: "/owner/bargains", icon: Inbox, keepShop: true, count: (d) => d.actions.bargainsWaiting },
  { key: "listings", href: "/owner/listings", icon: Boxes, keepShop: true, count: (d) => d.actions.lowStockCount },
  { key: "verification", href: "/owner/setup", icon: ShieldCheck, ownerOnly: true },
];

/** Tabs above every owner page (owners and staff only). Counts come from the shared dashboard data. */
export function OwnerNav() {
  const t = useTranslations("OwnerNav");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status, user } = useSession();

  const isTeam = user?.role === "SHOP_OWNER" || user?.role === "SHOP_STAFF";
  const isOwner = user?.role === "SHOP_OWNER";

  // Only the user's own shops; a shop id typed into the URL is ignored otherwise.
  const shops = useQuery({ queryKey: shopKeys.mine, queryFn: getMyShops, enabled: status === "authenticated" && isTeam });
  const shopList = shops.data ?? [];
  const shop = shopList.find((s) => s.id === searchParams.get("shop")) ?? shopList[0];

  // Same cache entry as the dashboard and the home strip: no extra request.
  const dashboard = useQuery({
    queryKey: ownerKeys.dashboard(shop?.id ?? ""),
    queryFn: () => getShopDashboard(shop?.id ?? ""),
    enabled: Boolean(shop),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  if (!isTeam) return null;

  const keep = shopList.length > 1 && shop ? `?shop=${shop.id}` : "";
  const tabs = TABS.filter((tab) => !tab.ownerOnly || isOwner);

  return (
    <nav
      aria-label={t("label")}
      className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 -mx-4 overflow-x-auto border-b border-line bg-background px-4 md:top-[calc(4.5rem+env(safe-area-inset-top))] md:mx-0 md:px-0"
    >
      <ul className="flex w-max gap-6">
        {tabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const count = tab.count && dashboard.data ? tab.count(dashboard.data) : 0;
          const label = t(tab.key);
          const Icon = tab.icon;
          return (
            <li key={tab.key}>
              <Link
                href={`${tab.href}${tab.keepShop ? keep : ""}`}
                aria-current={active ? "page" : undefined}
                aria-label={count > 0 ? t("waiting", { label, count }) : undefined}
                className={cn(
                  "type-body-medium flex h-12 items-center gap-2 border-b-[3px] whitespace-nowrap focus-visible:bg-subtle focus-visible:outline-none",
                  active ? "border-brand text-ink" : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
                {count > 0 && (
                  <span aria-hidden className="type-caption rounded-full bg-highlight-soft px-2 text-highlight">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}