"use client";

import { Handshake, House, Search, ShoppingCart, User, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
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

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Phones only (hidden from 768px). Fixed to the bottom, above the iPhone home bar.
export function BottomNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("mainNav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "type-caption flex h-full flex-col items-center justify-center gap-1 focus-visible:bg-subtle focus-visible:outline-none",
                  active ? "text-brand-alt" : "text-ink-muted",
                )}
              >
                <Icon className="size-6" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                <span>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}