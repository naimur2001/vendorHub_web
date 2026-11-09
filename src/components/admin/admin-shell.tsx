"use client";

import { ArrowLeft, LoaderCircle, ShieldCheck, Store,LayoutDashboard, Package,ScrollText,Tags,Scale, Users, Building2, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, type ReactNode } from "react";
import { useSession } from "@/components/app-providers";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const NAV: { href: string; key: "queue" | "markets" | "products" | "audit" | "catalog" | "disputes" | "users" | "shops" | "overview"; icon: LucideIcon }[] = [
  { href: "/admin", key: "queue", icon: ShieldCheck },
    { href: "/admin/overview", key: "overview", icon: LayoutDashboard },
  { href: "/admin/markets", key: "markets", icon: Store },
  { href: "/admin/products", key: "products", icon: Package },
  { href: "/admin/audit", key: "audit", icon: ScrollText },
  { href: "/admin/catalog", key: "catalog", icon: Tags },
    { href: "/admin/disputes", key: "disputes", icon: Scale },
  { href: "/admin/users", key: "users", icon: Users },
  { href: "/admin/shops", key: "shops", icon: Building2 },
];


function NavLinks({ pathname }: { pathname: string | null }) {
  const t = useTranslations("Admin");
  return (
    <ul className="flex gap-1 md:flex-col">
      {NAV.map(({ href, key, icon: Icon }) => {
        const active = pathname === href || (href !== "/admin" && pathname?.startsWith(`${href}/`));
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "type-body-medium flex h-11 items-center gap-3 rounded-sm px-3 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
                active ? "bg-surface/15 text-surface" : "text-surface/75 hover:bg-surface/10 hover:text-surface",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {t(`nav.${key}`)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActiveNavLinks() {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} />;
}

const panel = "mx-auto mt-16 flex max-w-md flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center";

/** The admin frame: dark sidebar on desktop, top bar on phones. Admins only. */
export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations("Admin");
  const { status, user } = useSession();

  if (status === "loading") {
    return (
      <p role="status" className="type-body flex min-h-dvh items-center justify-center gap-2 text-ink-secondary">
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
        {t("loading")}
      </p>
    );
  }

  if (status === "guest") {
    return (
      <div className={panel}>
        <h1 className="type-h3 text-ink">{t("guestTitle")}</h1>
        <Link
          href={`/auth/login?next=${encodeURIComponent("/admin")}`}
          className="type-body-medium flex h-12 items-center rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover"
        >
          {t("logIn")}
        </Link>
      </div>
    );
  }

  // The backend refuses non-admins anyway; this only explains it.
  if (user?.role !== "ADMIN") {
    return (
      <div className={panel}>
        <h1 className="type-h3 text-ink">{t("deniedTitle")}</h1>
        <p className="type-body text-ink-secondary">{t("deniedText")}</p>
        <Link href="/" className="type-body-medium text-brand underline-offset-4 hover:underline">
          {t("home")}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4 bg-ink px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-surface md:sticky md:top-0 md:h-dvh md:gap-8 md:px-5 md:py-6">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-[1.25rem] text-surface">Vendors Hub</span>
          <span className="type-caption rounded-sm bg-gold/20 px-1.5 text-gold">{t("portal")}</span>
        </div>
        <nav aria-label={t("navLabel")} className="scroll-row -mx-1 px-1 md:mx-0 md:flex-1 md:px-0">
          <Suspense fallback={<NavLinks pathname={null} />}>
            <ActiveNavLinks />
          </Suspense>
        </nav>
        <Link
          href="/"
          className="type-body-medium hidden items-center gap-2 text-surface/75 hover:text-surface focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none md:flex"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("nav.back")}
        </Link>
      </aside>
      <main id="main" className="min-w-0 bg-background px-4 py-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}