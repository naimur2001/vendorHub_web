"use client";

import { useMutation } from "@tanstack/react-query";
import { Camera, Images, LoaderCircle, Search, ImageOff } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Stagger } from "@/components/motion/stagger";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/routing";
import { ApiError } from "@/lib/api/core";
import { searchByPhoto, type PhotoSearchResult } from "@/lib/api/image-search";
import { safeMediaUrl } from "@/lib/api/storefront";
import { formatTaka } from "@/lib/format";

/**
 * 📷 in the search bar: photo → "Similar products" dialog (+ a link to all results when words were
 * recognised). On a phone the button offers the camera or the gallery; with a mouse it opens the
 * file chooser directly.
 */
export function PhotoSearchButton() {
  const t = useTranslations("PhotoSearch");
    const tCatalog = useTranslations("Catalog");
  const locale = useLocale();
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PhotoSearchResult | null>(null);

  const search = useMutation({
    mutationFn: searchByPhoto,
    onSuccess: (r) => setResult(r),
    onError: (err) => {
      // Not an API error: the browser could not read the file as a picture.
      if (!(err instanceof ApiError)) return setError(t("errors.type"));
      const s = err.status;
      setError(t(s === 422 ? "errors.notFound" : s === 429 ? "errors.limit" : s >= 502 ? "errors.unavailable" : s === 400 || s === 413 ? "errors.type" : "errors.generic"));
    },
  });

  function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    // Any picture the browser can open: it is re-drawn as a small JPEG before it is sent.
    if (!f.type.startsWith("image/")) return setError(t("errors.type"));
    search.mutate(f);
  }

  const allResults = result?.query
    ? `/search?${new URLSearchParams({ q: result.query, ...(result.categorySlug ? { category: result.categorySlug } : {}) }).toString()}`
    : null;

  return (
    <>
      <DropdownMenu
        modal={false}
        open={menuOpen}
        onOpenChange={(open) => {
          // A mouse or trackpad has no camera to offer: go straight to the file chooser.
          if (open && !window.matchMedia("(pointer: coarse)").matches) return galleryInput.current?.click();
          setMenuOpen(open);
        }}
      >
        <DropdownMenuTrigger
          title={t("button")}
          aria-label={t("button")}
          disabled={search.isPending}
          className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-ink-muted hover:bg-subtle hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          {search.isPending ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="z-70 w-56">
          <DropdownMenuItem onSelect={() => cameraInput.current?.click()} className="type-body min-h-11 cursor-pointer gap-3">
            <Camera className="size-4 text-ink-muted" aria-hidden />
            {t("takePhoto")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => galleryInput.current?.click()} className="type-body min-h-11 cursor-pointer gap-3">
            <Images className="size-4 text-ink-muted" aria-hidden />
            {t("choosePhoto")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Two hidden choosers: "capture" opens the camera, the other one the gallery or files. */}
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={galleryInput} type="file" accept="image/*" tabIndex={-1} aria-hidden className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />

      {(search.isPending || error) && (
        <p role={error ? "alert" : "status"} className="type-caption absolute top-full right-0 left-0 z-10 mt-1 rounded-md border border-line bg-card px-3 py-2 text-ink-secondary shadow-card">
          {error ?? t("looking")}
        </p>
      )}

      <Dialog open={result !== null} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto bg-card sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="type-h3 text-ink">{t("similarTitle")}</DialogTitle>
            <DialogDescription className="type-caption text-ink-muted">
              {result?.label ? t("recognised", { label: result.label }) : " "}
            </DialogDescription>
          </DialogHeader>

          {result && result.products.length === 0 ? (
            <p className="type-body text-ink-secondary">{t("none")}</p>
          ) : (
            <Stagger as="ul" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {result?.products.map((p) => {
                const src = safeMediaUrl(p.image);
                return (
                  <li key={p.slug}>
                    <Link href={`/products/${p.slug}`} onClick={() => setResult(null)} className="group flex h-full flex-col gap-1.5 rounded-md border border-line bg-card p-2 hover:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                      <div className="relative aspect-square overflow-hidden rounded-t-full rounded-b-sm bg-subtle">
                        {src ? (
                          <Image src={src} alt="" fill unoptimized sizes="12rem" className="object-cover motion-safe:transition-transform group-hover:scale-105" />
                        ) : (
                          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-highlight">
                            <ImageOff className="size-8" strokeWidth={1.25} aria-hidden />
                            <span className="type-caption text-ink-muted">{tCatalog("noPhoto")}</span>
                          </span>
                        )}
                        <span className="type-caption absolute bottom-1 left-1 rounded-full bg-ink/70 px-2 py-0.5 text-primary-foreground">{t("match", { percent: p.matchPercent })}</span>
                      </div>
                      <span className="type-body-medium line-clamp-2 text-ink">{p.title}</span>
                      <span className="type-caption mt-auto text-ink-secondary">
                        {p.lowestPrice !== null && <span className="type-price text-ink">{t("fromPrice", { price: formatTaka(p.lowestPrice, locale) })}</span>}
                        {p.shopCount > 0 && ` · ${t("shops", { count: p.shopCount })}`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </Stagger>
          )}

          {allResults && (
            <Link href={allResults} onClick={() => setResult(null)} className="type-body-medium flex h-11 items-center justify-center gap-2 self-start rounded-sm border border-brand px-4 text-brand hover:bg-subtle">
              <Search className="size-4" aria-hidden />
              {t("seeAll", { query: result?.query ?? "" })}
            </Link>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}