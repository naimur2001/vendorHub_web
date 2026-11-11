"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Eye,
  Handshake,
  Inbox,
  LoaderCircle,
  LogOut,
  MapPin,
  Package,
  RotateCcw,
  ShieldCheck,
  Store,
  UserRound,
  LayoutDashboard,
  
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/app-providers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/i18n/routing";
import { logout } from "@/lib/api/auth";
import type { SessionUser } from "@/lib/api/core";
import { getMyShops, shopKeys } from "@/lib/api/shops";

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

type LinkKey = "adminPortal" | "ownerArea" | "storefront" | "ownerOffers" | "orders" | "bargains" | "returns" | "profile" | "addresses" | "account";
type AccountLink = { href: string; key: LinkKey; icon: LucideIcon };
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The first shop the user owns or works at, for "View my storefront".
function useStorefrontSlug(user: SessionUser | null | undefined): string | undefined {
  const isTeam = user?.role === "SHOP_OWNER" || user?.role === "SHOP_STAFF";
  const { data } = useQuery({ queryKey: shopKeys.mine, queryFn: getMyShops, enabled: isTeam, staleTime: 5 * 60_000 });
  const slug = isTeam ? data?.[0]?.slug : undefined;
  return slug && SLUG.test(slug) ? slug : undefined;
}

// The same entries in the desktop menu and on the /account page.
function linksFor(user: SessionUser, storefrontSlug?: string): AccountLink[] {
   const links: AccountLink[] = [{ href: "/account", key: "account", icon: LayoutDashboard }];
  if (user.role === "ADMIN") links.push({ href: "/admin", key: "adminPortal", icon: ShieldCheck });
  if (user.role === "SHOP_OWNER") links.push({ href: "/owner", key: "ownerArea", icon: Store });
  if (storefrontSlug) links.push({ href: `/shops/${storefrontSlug}`, key: "storefront", icon: Eye });
    if (user.role === "SHOP_OWNER" || user.role === "SHOP_STAFF") links.push({ href: "/owner/bargains", key: "ownerOffers", icon: Inbox });
  if (user.role === "SHOP_OWNER" || user.role === "SHOP_STAFF") links.push({ href: "/owner/bargains", key: "ownerOffers", icon: Inbox });
  links.push(
    { href: "/account/orders", key: "orders", icon: Package },
    { href: "/bargains", key: "bargains", icon: Handshake },
    { href: "/account/returns", key: "returns", icon: RotateCcw },
    { href: "/account/profile", key: "profile", icon: UserRound },
    { href: "/account/addresses", key: "addresses", icon: MapPin },
  );
  return links;
}

// Log out: server clears the cookie, memory token and cached data are dropped, then home.
function useLogout() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run() {
    if (pending) return;
    setPending(true);
    try {
      await logout();
    } finally {
      setPending(false);
      router.replace("/");
    }
  }

  return { run, pending };
}

function Avatar({ name, size }: { name: string; size: "sm" | "lg" }) {
  return (
    <span
      className={
        size === "sm"
          ? "type-caption flex size-9 items-center justify-center rounded-full bg-brand text-primary-foreground"
          : "flex size-14 items-center justify-center rounded-full bg-brand font-heading text-[1.3125rem] text-primary-foreground"
      }
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Desktop: the initials in the top bar open this menu. */
export function AccountMenu({ user }: { user: SessionUser }) {
  const storefrontSlug = useStorefrontSlug(user);
  const t = useTranslations("Account");
  const tNav = useTranslations("Nav");
  const { run: logOut, pending } = useLogout();

  return (
    <DropdownMenu  modal={false}>
      <DropdownMenuTrigger
        aria-label={tNav("yourAccount", { name: user.name })}
        className="flex size-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        <Avatar name={user.name} size="sm" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="z-[70] w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
          <span className="type-body-medium truncate text-ink">{user.name}</span>
          <span className="type-caption truncate font-normal text-ink-muted">{user.email}</span>
          <span className="type-caption font-normal text-highlight">{t(`roles.${user.role}`)}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {linksFor(user, storefrontSlug).map(({ href, key, icon: Icon }) => (
          <DropdownMenuItem key={key} asChild className="type-body min-h-10 cursor-pointer gap-3">
            <Link href={href}>
              <Icon className="size-4 text-ink-muted" aria-hidden />
              {t(key)}
            </Link>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onSelect={() => void logOut()} className="type-body min-h-10 cursor-pointer gap-3 text-brand">
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
          {pending ? t("loggingOut") : t("logOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Phones (Account tab) and anyone opening /account: the same entries as a page. */
export function AccountPanel() {
  const t = useTranslations("Account");
  const { status, user } = useSession();
  const storefrontSlug = useStorefrontSlug(user);
  const { run: logOut, pending } = useLogout();

  if (status === "loading") {
    return (
      <p role="status" className="type-body flex items-center justify-center gap-2 py-12 text-ink-secondary">
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
      </p>
    );
  }

  if (status === "guest" || !user) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-md border border-line bg-card p-6 text-center">
        <h2 className="type-h3 text-ink">{t("guestTitle")}</h2>
        <p className="type-body text-ink-secondary">{t("guestText")}</p>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={`/auth/login?next=${encodeURIComponent("/account")}`}
            className="type-body-medium flex h-12 items-center justify-center rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover"
          >
            {t("logIn")}
          </Link>
          <Link href="/auth/register" className="type-body-medium flex h-12 items-center justify-center rounded-sm border border-brand px-6 text-brand hover:bg-subtle">
            {t("createAccount")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 rounded-md border border-line bg-card p-4">
        <Avatar name={user.name} size="lg" />
        <div className="min-w-0">
          <p className="type-h3 truncate text-ink">{user.name}</p>
          <p className="type-body truncate text-ink-secondary">{user.email}</p>
          <p className="type-caption text-highlight">{t(`roles.${user.role}`)}</p>
        </div>
      </div>

      <nav aria-label={t("menuLabel")}>
        <ul className="flex flex-col border-t border-line">
          {linksFor(user, storefrontSlug).map(({ href, key, icon: Icon }) => (
            <li key={key} className="border-b border-line">
              <Link href={href} className="type-body-medium flex min-h-14 items-center gap-3 px-1 text-ink hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none">
                <Icon className="size-5 text-ink-muted" aria-hidden />
                <span className="flex-1">{t(key)}</span>
                <ChevronRight className="size-5 text-ink-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <button
        type="button"
        onClick={() => void logOut()}
        disabled={pending}
        aria-busy={pending}
        className="type-body-medium flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-brand text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-70"
      >
        {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <LogOut className="size-5" aria-hidden />}
        {pending ? t("loggingOut") : t("logOut")}
      </button>
    </div>
  );
}