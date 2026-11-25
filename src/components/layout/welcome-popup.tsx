"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useSession } from "@/components/app-providers";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Link, usePathname } from "@/i18n/routing";
import { getActivePopup, popupKeys, sendPopupEvent, type PublicPopup } from "@/lib/api/popups";
import { safeMediaUrl } from "@/lib/api/storefront";

// Pages where a popup would get in the way (forms, payments, the shop's own tools): never shown there.
const QUIET = ["/checkout", "/cart", "/auth", "/account", "/owner", "/me", "/to-let/new", "/to-let/manage"];

/** The page key the server matches (HOME_ONLY popups come back only for "home"); null = no popup here. */
function pageKey(pathname: string): string | null {
  if (QUIET.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  if (pathname === "/") return "home";
  const first = pathname.split("/")[1] ?? "";
  const keys: Record<string, string> = { products: "product", shops: "shop", markets: "market", search: "search", "to-let": "to-let", bargains: "bargains" };
  return keys[first] ?? "other";
}

// Internal paths and https links only (the backend checks too).
function safeLink(value: string | null): { href: string; external: boolean } | null {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return { href: value, external: false };
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return { href: url.toString(), external: true };
  } catch {
    // not a URL
  }
  return null;
}

const DAY = 24 * 60 * 60 * 1000;
// One popup per page load at most, also across client-side navigation.
let shownThisLoad = false;

/**
 * "Seen" is remembered per popup id + version (a changed popup shows again), never in cookies:
 * ONCE_PER_VISITOR and ONCE_PER_DAY in localStorage, EVERY_VISIT once per browser session.
 */
function alreadySeen(p: PublicPopup): boolean {
  const key = `vh-popup:${p.id}:${p.version}`;
  try {
    // eslint-disable-next-line no-restricted-globals -- harmless UI marker: which popup version was seen (no personal data, no token)
    if (p.frequency === "EVERY_VISIT") return sessionStorage.getItem(key) !== null;
    // eslint-disable-next-line no-restricted-globals -- harmless UI marker: which popup version was seen (no personal data, no token)
    const at = Number(localStorage.getItem(key));
    if (!at) return false;
    return p.frequency === "ONCE_PER_VISITOR" || Date.now() - at < DAY;
  } catch {
    return false; // storage blocked: show it, the visitor can still close it
  }
}
function markSeen(p: PublicPopup): void {
  const key = `vh-popup:${p.id}:${p.version}`;
  try {
    // eslint-disable-next-line no-restricted-globals -- harmless UI marker: which popup version was seen (no personal data, no token)
    if (p.frequency === "EVERY_VISIT") sessionStorage.setItem(key, "1");
    // eslint-disable-next-line no-restricted-globals -- harmless UI marker: which popup version was seen (no personal data, no token)
    else localStorage.setItem(key, String(Date.now()));
  } catch {
    // storage blocked: nothing to remember
  }
}

/** The admin's welcome poster. One at a time, after its delay, easy to close (button, Escape, outside click). */
export function WelcomePopup() {
  const t = useTranslations("WelcomePopup");
  const locale = useLocale();
  const pathname = usePathname();
  const { status } = useSession();
  const page = pageKey(pathname);
  const [open, setOpen] = useState(false);

  const popup = useQuery({
    queryKey: popupKeys.active(page ?? "", locale, status === "authenticated"),
    queryFn: () => getActivePopup(page ?? "home", locale),
    enabled: page !== null && status !== "loading" && !shownThisLoad, // wait for the login, it decides the audience
    staleTime: 60_000,
    retry: false,
  });
  const p = popup.data ?? null;

  useEffect(() => {
    if (!p || shownThisLoad || alreadySeen(p)) return;
    const timer = setTimeout(() => {
      if (shownThisLoad) return;
      shownThisLoad = true;
      markSeen(p);
      setOpen(true);
      sendPopupEvent(p.id, "VIEW");
    }, Math.min(Math.max(p.delaySeconds, 0), 30) * 1000);
    return () => clearTimeout(timer);
  }, [p]);

  if (!p) return null;
  const src = safeMediaUrl(p.imageUrl);
  const mobile = safeMediaUrl(p.mobileImageUrl);
  if (!src) return null;
  const link = safeLink(p.linkUrl);

  function close() {
    setOpen(false);
    if (p) sendPopupEvent(p.id, "CLOSE");
  }
  function clicked() {
    setOpen(false);
    if (p) sendPopupEvent(p.id, "CLICK");
  }

  const image = (
    <picture>
      {mobile && <source media="(max-width: 639px)" srcSet={mobile} />}
      {/* Admin poster: the title is the alt text. Plain <img>: the size comes from the poster itself. */}
      <img src={src} alt={p.title} className="block max-h-[65dvh] w-full bg-subtle object-contain" />
    </picture>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-2xl bg-card p-0 shadow-modal ring-1 ring-gold/40 sm:max-w-md motion-reduce:animate-none"
      >
        <button
          type="button"
          onClick={close}
          aria-label={t("close")}
          className="absolute top-2 right-2 z-10 flex size-11 items-center justify-center rounded-full bg-card/90 text-ink shadow-card backdrop-blur-sm hover:bg-card focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          <X className="size-5" aria-hidden />
        </button>

        {link ? (
          link.external ? (
            <a href={link.href} target="_blank" rel="noopener noreferrer sponsored" onClick={clicked} className="block focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none focus-visible:ring-inset">
              {image}
            </a>
          ) : (
            <Link href={link.href} onClick={clicked} className="block focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none focus-visible:ring-inset">
              {image}
            </Link>
          )
        ) : (
          image
        )}

        <div className="flex flex-col gap-2 p-4">
          <span className="type-caption self-start rounded-full bg-highlight-soft px-2 py-0.5 text-highlight">{t("label")}</span>
          {/* Admin text: plain text */}
          <DialogTitle className="type-h3 text-ink">{p.title}</DialogTitle>
          {p.body ? <DialogDescription className="type-body text-ink-secondary">{p.body}</DialogDescription> : <DialogDescription className="sr-only">{t("label")}</DialogDescription>}
          <div className="mt-1 flex flex-wrap gap-2">
            {link &&
              (link.external ? (
                <a href={link.href} target="_blank" rel="noopener noreferrer sponsored" onClick={clicked} className="type-body-medium inline-flex h-11 items-center gap-1.5 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none">
                  {p.ctaLabel || t("open")}
                  <ArrowRight className="size-4" aria-hidden />
                </a>
              ) : (
                <Link href={link.href} onClick={clicked} className="type-body-medium inline-flex h-11 items-center gap-1.5 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none">
                  {p.ctaLabel || t("open")}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              ))}
            <button type="button" onClick={close} className="type-body-medium h-11 rounded-sm px-4 text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
              {t("notNow")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
