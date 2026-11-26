"use client";

import type { ReactNode } from "react";
import { useSession } from "@/components/app-providers";

/**
 * Marks the home page with who is looking: data-team="true" for admins, shop owners and shop staff.
 * The page's side panels (your corner, side advert, shop-to-let card) only show for them, using
 * `group-data-[team=true]/home:` classes. Customers and guests get the slider without side panels.
 * (Who is logged in is only known in the browser, so this is decided here, not on the server.)
 */
export function HomeRoleScope({ children }: { children: ReactNode }) {
  const { status, user } = useSession();
  const team = status === "authenticated" && (user?.role === "ADMIN" || user?.role === "SHOP_OWNER" || user?.role === "SHOP_STAFF");
  return (
    <div data-team={team ? "true" : "false"} className="group/home">
      {children}
    </div>
  );
}
