"use client";

import { Handshake, House, Search, ShoppingCart, User, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { CartCountBadge, useCartCount } from "@/components/cart/cart-badge";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type NavKey = "home" | "search" | "cart" | "bargains" | "account";

const ITEMS: { href: string; key: NavKey; icon: LucideIcon }[] = [
  { href: "/", key: "home", icon: House },
  { href: "/search", key: "search", icon: Search },
  { href: "/cart", key: "cart", icon: ShoppingCart },
  { href: "/bargains", key: "bargains", icon: Handshake },
  { href: "/account", key: "account", icon: User },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// The tabs; pathname null = not known yet (no tab highlighted).
function NavItems({ pathname }: { pathname: string | null }) {
  const t = useTranslations("Nav");
  const tCart = useTranslations("Cart");
  const cartCount = useCartCount();

  return (
    <ul className="grid h-16 grid-cols-5">
      {ITEMS.map(({ href, key, icon: Icon }) => {
        const active = isActive(pathname, href);
        const isCart = key === "cart";
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={isCart && cartCount > 0 ? tCart("badgeLabel", { count: cartCount }) : undefined}
              className={cn(
                "type-caption flex h-full flex-col items-center justify-center gap-1 focus-visible:bg-subtle focus-visible:outline-none",
                active ? "text-brand-alt" : "text-ink-muted",
              )}
            >
              <span className="relative">
                <Icon className="size-6" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                {isCart && <CartCountBadge count={cartCount} className="-top-1.5 -right-3" />}
              </span>
              <span>{t(key)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActiveNavItems() {
  const pathname = usePathname();
  return <NavItems pathname={pathname} />;
}

// Phones only (hidden from 768px). Fixed to the bottom, above the iPhone home bar.
export function BottomNav() {
  const t = useTranslations("Nav");

  return (
    <nav
      aria-label={t("mainNav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {/* The tabs show at once; the active one is highlighted as soon as the address is known. */}
      <Suspense fallback={<NavItems pathname={null} />}>
        <ActiveNavItems />
      </Suspense>
    </nav>
  );
}