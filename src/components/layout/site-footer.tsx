"use client";

import { useTranslations } from "next-intl";
import { useSession } from "@/components/app-providers";
import { Link } from "@/i18n/routing";

type FooterLink = { href: string; key: string };

const linkClass =
  "type-body inline-flex min-h-11 items-center rounded-sm text-primary-foreground/85 hover:text-gold focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-brand focus-visible:outline-none";

function Column({ id, title, links }: { id: string; title: string; links: { href: string; label: string }[] }) {
  return (
    <nav aria-labelledby={id} className="flex flex-col gap-1">
      <h2 id={id} className="type-h3 mb-1 text-gold">
        {title}
      </h2>
      <ul className="flex flex-col">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className={linkClass}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Shared bottom of every shopping page. Links change with who is logged in.
export function SiteFooter() {
  const t = useTranslations("Footer");
  const { status, user } = useSession();
  const loggedIn = status === "authenticated" && !!user;
  const isTeam = user?.role === "SHOP_OWNER" || user?.role === "SHOP_STAFF";

  const shop: FooterLink[] = [
    { href: "/search", key: "search" },
    { href: "/markets", key: "markets" },
    { href: "/cart", key: "cart" },
  ];
  const account: FooterLink[] = loggedIn
    ? [
        { href: "/account/orders", key: "myOrders" },
        { href: "/account", key: "account" },
      ]
    : [
        { href: "/auth/login", key: "logIn" },
        { href: "/auth/register", key: "register" },
      ];
  const forShops: FooterLink[] = isTeam ? [{ href: "/owner", key: "ownerArea" }] : [{ href: "/auth/register/shop", key: "openShop" }];
  const label = (links: FooterLink[]) => links.map((l) => ({ href: l.href, label: t(`links.${l.key}`) }));

  return (
    <footer className="relative isolate overflow-hidden bg-brand pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
      <span
        aria-hidden
        className="arch-up absolute -right-10 bottom-0 -z-10 h-[80%] w-40 rounded-t-full border border-b-0 border-gold/30 md:right-16 md:w-56"
      />
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 md:grid-cols-4 md:px-10 md:py-14">
        <div className="flex flex-col gap-3">
          <p className="font-heading text-[1.5rem] leading-none font-semibold text-primary-foreground">Vendors Hub</p>
          <p className="type-body max-w-xs text-primary-foreground/80">{t("tagline")}</p>
        </div>
        <Column id="footer-shop" title={t("shopTitle")} links={label(shop)} />
        <Column id="footer-account" title={t("accountTitle")} links={label(account)} />
        <Column id="footer-shops" title={t("forShopsTitle")} links={label(forShops)} />
      </div>
      <div className="border-t border-gold/30">
        <p className="type-caption mx-auto w-full max-w-7xl px-4 py-4 text-primary-foreground/70 md:px-10">{t("rights")}</p>
      </div>
    </footer>
  );
}
