"use client";

import { Search, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/layout/top-nav";
import { Link } from "@/i18n/routing";

/** The not-found page: an empty arch doorway with "404", and three ways back into the market. */
export function NotFoundView() {
  const t = useTranslations("NotFound");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-line bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 md:h-[72px] md:px-10">
          <Link href="/" aria-label={t("homeLink")} className="rounded-sm focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
            <Logo />
          </Link>
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="flex max-w-lg flex-col items-center gap-6 text-center">
          {/* An empty doorway: dashed bordeaux arch, gold keystone, 404 inside */}
          <svg viewBox="0 0 200 240" className="h-56 w-auto md:h-64" role="img" aria-label={t("code")}>
            <path d="M24 236 V104 A76 76 0 0 1 176 104 V236" fill="none" strokeWidth="3" strokeDasharray="10 8" className="stroke-brand" />
            <path d="M92 18 H108 L105 38 H95 Z" className="fill-gold" />
            <line x1="8" y1="236" x2="192" y2="236" strokeWidth="3" className="stroke-gold" />
            <text x="100" y="160" textAnchor="middle" className="fill-gold font-heading" style={{ fontSize: 56 }}>
              {t("code")}
            </text>
          </svg>

          <div className="flex flex-col gap-2">
            <h1 className="type-display text-ink">{t("title")}</h1>
            <p className="type-body text-ink-secondary">{t("text")}</p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/"
              className="type-body-medium flex h-12 items-center justify-center rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {t("home")}
            </Link>
            <Link
              href="/search"
              className="type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm border border-brand px-6 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <Search className="size-4" aria-hidden />
              {t("search")}
            </Link>
          </div>
          <Link href="/markets" className="type-body-medium flex items-center gap-2 text-brand underline-offset-4 hover:underline">
            <Store className="size-4" aria-hidden />
            {t("markets")}
          </Link>
        </div>
      </main>
    </div>
  );
}