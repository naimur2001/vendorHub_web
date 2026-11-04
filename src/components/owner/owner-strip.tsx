"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/app-providers";
import { Link } from "@/i18n/routing";
import { getShopDashboard, ownerKeys } from "@/lib/api/owner";
import { getMyShops, shopKeys } from "@/lib/api/shops";

/** Home page, owners and staff only: their shop's to-dos at a glance. Customers never see it. */
export function OwnerStrip() {
  const t = useTranslations("OwnerDashboard.strip");
  const { status, user } = useSession();
  const isTeam = user?.role === "SHOP_OWNER" || user?.role === "SHOP_STAFF";

  const shops = useQuery({ queryKey: shopKeys.mine, queryFn: getMyShops, enabled: status === "authenticated" && isTeam });
  const shop = shops.data?.[0];
  // Same cache entry as the dashboard, so opening it afterwards is instant.
  const dashboard = useQuery({
    queryKey: ownerKeys.dashboard(shop?.id ?? ""),
    queryFn: () => getShopDashboard(shop?.id ?? ""),
    enabled: Boolean(shop),
    staleTime: 60_000,
  });

  if (!isTeam || !shop) return null;
  const actions = dashboard.data?.actions;

  return (
    <Link
      href="/owner"
      className="flex flex-col gap-1 rounded-md bg-brand px-4 py-3 text-primary-foreground shadow-card hover:bg-brand-alt focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none sm:flex-row sm:items-center sm:gap-4"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Store className="size-5 shrink-0 text-gold" aria-hidden />
        <span className="truncate font-heading text-[1.125rem]">{shop.name}</span>
      </span>
      {actions && (
        <span className="type-body text-primary-foreground/85">
          {t("offers", { count: actions.bargainsWaiting })} · {t("orders", { count: actions.ordersToConfirm })}
        </span>
      )}
      <span className="type-body-medium flex items-center gap-1 sm:ml-auto">
        {t("open")}
        <ChevronRight className="size-4" aria-hidden />
      </span>
    </Link>
  );
}