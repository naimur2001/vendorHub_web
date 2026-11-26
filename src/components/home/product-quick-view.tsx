"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Store, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type MouseEvent, type ReactNode } from "react";
import { AvailabilityBadge } from "@/components/catalog/availability-badge";
import { PriceTicket } from "@/components/brand/price-ticket";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Link } from "@/i18n/routing";
import { getProduct } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/core";
import { safeMediaUrl } from "@/lib/api/storefront";
import { cn } from "@/lib/utils";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const primary =
  "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none";
const ghost =
  "type-body-medium inline-flex h-11 items-center justify-center rounded-sm px-4 text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none";

/**
 * A gallery picture that opens a product preview in a modal.
 * It is a real link to the product page, so a middle click, Ctrl/Cmd-click or "open in new tab"
 * still goes to the page; a plain click or tap opens the modal instead.
 */
export function ProductQuickView({ slug, className, children }: { slug: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!SLUG.test(slug) || slug.length > 200) return <div className={className}>{children}</div>;

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setOpen(true);
  }

  return (
    <>
      <Link href={`/products/${slug}`} onClick={onClick} aria-haspopup="dialog" className={className}>
        {children}
      </Link>
      <Dialog open={open} onOpenChange={setOpen}>
        {open && <QuickViewContent slug={slug} onClose={() => setOpen(false)} />}
      </Dialog>
    </>
  );
}

function QuickViewContent({ slug, onClose }: { slug: string; onClose: () => void }) {
  const t = useTranslations("QuickView");
  const [photo, setPhoto] = useState(0);
  // Prices always come fresh from the server (a short reuse only while the modal is reopened).
  const query = useQuery({ queryKey: ["product-quick-view", slug], queryFn: () => getProduct(slug), staleTime: 30_000 });

  const close = (
    <button
      type="button"
      onClick={onClose}
      aria-label={t("close")}
      className="absolute top-2 right-2 z-10 flex size-11 items-center justify-center rounded-full bg-card/90 text-ink shadow-card backdrop-blur-sm hover:bg-card focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    >
      <X className="size-5" aria-hidden />
    </button>
  );
  const shell =
    "max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-2xl bg-card p-0 shadow-modal ring-1 ring-gold/40 sm:max-w-3xl motion-reduce:animate-none";

  if (query.isPending) {
    return (
      <DialogContent showCloseButton={false} className={shell} aria-busy>
        {close}
        <DialogTitle className="sr-only">{t("loading")}</DialogTitle>
        <DialogDescription className="sr-only">{t("loading")}</DialogDescription>
        <div className="grid gap-4 p-4 md:grid-cols-2 md:p-6" aria-hidden>
          <div className="aspect-square skeleton rounded-xl" />
          <div className="flex flex-col gap-3">
            <div className="h-4 w-24 skeleton rounded-sm" />
            <div className="h-8 w-3/4 skeleton rounded-sm" />
            <div className="h-10 w-32 skeleton rounded-sm" />
            <div className="h-20 skeleton rounded-sm" />
          </div>
        </div>
      </DialogContent>
    );
  }

  if (query.isError) {
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <DialogContent showCloseButton={false} className={cn(shell, "sm:max-w-md")}>
        {close}
        <div role="alert" className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <DialogTitle className="type-h3 text-ink">{t(gone ? "goneTitle" : "errorTitle")}</DialogTitle>
          <DialogDescription className="type-body text-ink-secondary">{t(gone ? "goneText" : "errorText")}</DialogDescription>
          {!gone && (
            <button type="button" onClick={() => query.refetch()} className={primary}>
              {t("retry")}
            </button>
          )}
        </div>
      </DialogContent>
    );
  }

  const { product, selectedListing: listing, otherShopsCount } = query.data;
  const images = product.images.map((src) => safeMediaUrl(src)).filter((src): src is string => Boolean(src));
  const shown = images[Math.min(photo, images.length - 1)];
  const specs = Object.entries(product.specs ?? {}).slice(0, 3);
  const href = listing ? `/products/${product.slug}?listing=${listing.id}` : `/products/${product.slug}`;

  return (
    <DialogContent showCloseButton={false} className={shell}>
      {close}
      <div className="grid md:grid-cols-2">
        {/* Photos */}
        <div className="flex flex-col gap-3 bg-subtle p-4 md:p-6">
          <div className="relative aspect-square overflow-hidden rounded-xl bg-card">
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element -- processed image from the media server
              <img src={shown} alt={product.title} className="size-full object-contain" />
            ) : (
              <span className="type-caption absolute inset-0 flex items-center justify-center text-ink-muted">{t("noPhoto")}</span>
            )}
          </div>
          {images.length > 1 && (
            <div className="scroll-row -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {images.slice(0, 8).map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setPhoto(i)}
                  aria-label={t("photo", { n: i + 1, total: images.length })}
                  aria-pressed={i === photo}
                  className={cn(
                    "size-14 shrink-0 overflow-hidden rounded-md border-2 bg-card focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
                    i === photo ? "border-brand" : "border-transparent",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail of the same image */}
                  <img src={src} alt="" className="size-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details (shop text is plain text) */}
        <div className="flex flex-col gap-4 p-4 md:p-6 md:pt-14">
          <div className="flex flex-col gap-1">
            {product.brand && <p className="type-body-medium text-ink-secondary">{product.brand.name}</p>}
            <DialogTitle className="type-h2 text-ink">{product.title}</DialogTitle>
            <p className="type-caption text-ink-muted">{product.category.name}</p>
          </div>

          {listing ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <PriceTicket amount={listing.price} msrp={product.msrp} />
                <AvailabilityBadge value={listing.availability} />
              </div>
              <p className="type-body flex items-start gap-2 text-ink-secondary">
                <Store className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
                <span>
                  {t("soldBy", { shop: listing.shop.name })}
                  {listing.shop.market && <span className="text-ink-muted"> · {listing.shop.market.name}</span>}
                  {otherShopsCount > 0 && <span className="block text-ink-muted">{t("moreShops", { count: otherShopsCount })}</span>}
                </span>
              </p>
            </div>
          ) : (
            <p className="type-body rounded-md border border-line p-3 text-ink-secondary">{t("noListings")}</p>
          )}

          {specs.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {specs.map(([key, value]) => (
                <li key={key} className="type-caption rounded-full border border-line-strong px-3 py-1 text-ink-secondary">
                  {String(value)}
                </li>
              ))}
            </ul>
          )}

          {product.description ? (
            <DialogDescription className="type-body line-clamp-4 whitespace-pre-line text-ink-secondary">{product.description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{product.title}</DialogDescription>
          )}

          <div className="mt-auto flex flex-col gap-2 border-t border-gold pt-4 sm:flex-row">
            <Link href={href} onClick={onClose} className={primary}>
              {t("viewProduct")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <button type="button" onClick={onClose} className={ghost}>
              {t("keepBrowsing")}
            </button>
          </div>
        </div>
      </div>
    </DialogContent>
  );
}
