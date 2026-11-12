"use client";

import { LogIn, Search, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useState, type FormEvent } from "react";
import { useSession } from "@/components/app-providers";
import { CartCountBadge, useCartCount } from "@/components/cart/cart-badge";
import { AccountMenu } from "@/components/layout/account-menu";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { NotificationBell } from "@/components/layout/notification-bell";
import { LanguageSwitch } from "@/components/layout/language-switch";








const SEARCH_MAX_LENGTH = 100;

// Brand mark: an arch with a gold keystone (same drawing as the app icon) + wordmark.
export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 512 512" className="size-8" aria-hidden="true">
        <rect width="512" height="512" rx="72" className="fill-brand" />
        <path
          d="M176 400 V256 A80 80 0 0 1 336 256 V400"
          fill="none"
          strokeWidth="28"
          className="stroke-surface"
        />
        <path d="M240 160 H272 L266 192 H246 Z" className="fill-gold" />
        <rect x="152" y="400" width="208" height="16" className="fill-gold" />
      </svg>
      <span className="font-heading text-[1.3125rem] leading-none font-semibold text-brand">Vendors Hub</span>
    </span>
  );
}

function SearchBar() {
  const t = useTranslations("Nav");
  const router = useRouter();
  const [query, setQuery] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim().slice(0, SEARCH_MAX_LENGTH);
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  }

  return (
    <form role="search" onSubmit={onSubmit} className="relative w-full max-w-[480px]">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input
        type="search"
        name="q"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        maxLength={SEARCH_MAX_LENGTH}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchLabel")}
        autoComplete="off"
        className="type-body h-11 w-full rounded-md border border-input bg-surface pr-3 pl-10 text-ink placeholder:text-ink-muted hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
      />
    </form>
  );
}

// Same size as the avatar: shown while the session or the address is not known yet (no layout jump).
const accountPlaceholder = <span className="size-9 animate-pulse rounded-full bg-subtle" aria-hidden />;

function AccountArea() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const { status, user } = useSession();

  if (status === "loading") return accountPlaceholder;

  if (status === "authenticated" && user) {
    return <AccountMenu user={user} />;
  }

  // Guest: come back to this page after login (validated by safeRedirectPath on the login screen).
  const next = pathname.startsWith("/auth") ? "" : `?next=${encodeURIComponent(pathname)}`;
  return (
    <Link
      href={`/auth/login${next}`}
      className="type-body-medium flex h-10 items-center gap-2 rounded-md border border-brand px-3 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    >
      <LogIn className="size-4" aria-hidden />
      {t("login")}
    </Link>
  );
}

// Desktop cart icon with the item count.
function CartLink() {
  const t = useTranslations("Nav");
  const tCart = useTranslations("Cart");
  const count = useCartCount();

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? tCart("badgeLabel", { count }) : t("cart")}
      className="relative hidden size-11 items-center justify-center rounded-full text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none md:flex"
    >
      <ShoppingCart className="size-5" aria-hidden />
      <CartCountBadge count={count} className="top-0.5 right-0" />
    </Link>
  );
}

export function TopNav() {
  const t = useTranslations("Nav");

  return (
    <header className="sticky top-0 z-40 border-b bg-card pt-[env(safe-area-inset-top)]">
      <a
        href="#main"
        className="type-body-medium sr-only rounded-md bg-brand px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        {t("skipToContent")}
      </a>

      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:h-[72px] md:gap-6 md:px-10">
        <Link
          href="/"
          aria-label={t("homeLink")}
          className="shrink-0 rounded-sm focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          <Logo />
        </Link>

        {/* Desktop search (phones use the Search tab in the bottom bar) */}
        <div className="hidden flex-1 justify-center md:flex">
          <SearchBar />
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <CartLink />
        
        
        
          <Suspense>
            <LanguageSwitch />
          </Suspense>
          
          
                      {/* The bell reads the current time ("2 min ago"), so it renders after the page shell */}
          <Suspense fallback={<span className="size-11" aria-hidden />}>
            <NotificationBell />
          </Suspense>
          {/* Reads the current address: on pages whose address is only known at request time
              (e.g. /products/[slug]) it must wait inside Suspense. */}
          <Suspense fallback={accountPlaceholder}>
            <AccountArea />
          </Suspense>
        </div>
      </div>
    </header>
  );
}