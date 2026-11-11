"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, ImagePlus, Images, LoaderCircle } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ApiError } from "@/lib/api/core";
import { uploadShopProductPhoto, type OwnerListing } from "@/lib/api/listings";
import { safeMediaUrl } from "@/lib/api/storefront";

// The answer may carry the product's new image list (strings or { url }); otherwise keep ours.
function imagesFrom(r: unknown): string[] | null {
  const raw = r && typeof r === "object" ? ((r as { images?: unknown }).images ?? (r as { product?: { images?: unknown } }).product?.images) : null;
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((i) => (typeof i === "string" ? [i] : i && typeof i === "object" && typeof (i as { url?: unknown }).url === "string" ? [(i as { url: string }).url] : []));
}

/** Owner listings: a "Photos" button with its own panel (view + add product photos). */
export function ListingPhotosButton({ shopId, listing }: { shopId: string; listing: OwnerListing }) {
  const t = useTranslations("ListingPhotos");
  const queryClient = useQueryClient();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<string[]>(listing.product.images ?? []);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const upload = useMutation({
    mutationFn: (f: File) => uploadShopProductPhoto(shopId, listing.productId, f),
    onSuccess: (r) => {
      setImages((old) => imagesFrom(r) ?? old);
      setFile(null);
      setNote({ kind: "ok", text: t("added") });
      void queryClient.invalidateQueries({ queryKey: ["owner"] });
    },
    onError: (err) => {
      const s = err instanceof ApiError ? err.status : 0;
      const key = s === 403 || s === 423 || (s === 409 && /lock/i.test((err as ApiError).message)) ? "errors.locked" : s === 413 ? "errors.size" : s === 422 ? "errors.small" : s === 429 ? "errors.limit" : s === 400 ? "errors.type" : "errors.generic";
      setNote({ kind: "error", text: t(key) });
    },
  });

  function pick(f: File | undefined) {
    setNote(null);
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setNote({ kind: "error", text: t("errors.type") });
    if (f.size > 5 * 1024 * 1024) return setNote({ kind: "error", text: t("errors.size") });
    setFile(f);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setFile(null); setNote(null); } }}>
      <button type="button" onClick={() => setOpen(true)} className="type-body-medium flex h-10 items-center gap-1.5 rounded-sm px-3 text-ink-secondary hover:bg-subtle">
        <Images className="size-4" aria-hidden />
        {t("button")}
      </button>
      <SheetContent side="right" className="w-full overflow-y-auto bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="type-h3 text-ink">{t("title", { product: listing.product.title })}</SheetTitle>
          <SheetDescription className="type-caption text-ink-muted">{t("text")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          {images.length === 0 ? (
            <p className="type-body text-ink-muted">{t("none")}</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2">
              {images.map((url) => {
                const src = safeMediaUrl(url);
                return (
                  <li key={url} className="relative aspect-square overflow-hidden rounded-sm border border-line bg-subtle">
                    {src && <Image src={src} alt="" fill unoptimized sizes="8rem" className="object-cover" />}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={inputId} className="type-body-medium flex h-10 cursor-pointer items-center gap-2 rounded-sm border border-brand px-3 text-brand hover:bg-subtle has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand">
              <ImagePlus className="size-4" aria-hidden />
              {file ? file.name.slice(0, 28) : t("choose")}
              <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <button type="button" onClick={() => file && upload.mutate(file)} disabled={!file || upload.isPending} className="type-body-medium flex h-10 items-center gap-2 rounded-sm bg-action px-4 text-primary-foreground disabled:opacity-50">
              {upload.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {upload.isPending ? t("uploading") : t("upload")}
            </button>
          </div>
          <p className="type-caption text-ink-muted">{t("rules")}</p>
          {note && (
            <p role={note.kind === "error" ? "alert" : "status"} className={note.kind === "error" ? "type-body text-error" : "type-body flex items-center gap-2 text-success-ink"}>
              {note.kind === "ok" && <CircleCheck className="size-4" aria-hidden />}
              {note.text}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}