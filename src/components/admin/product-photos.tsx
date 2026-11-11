"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Lock, LockOpen, LoaderCircle, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { isProductLocked, productImages, removeProductImage, setProductLock, uploadProductImage, type AdminProduct } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/core";
import { safeMediaUrl } from "@/lib/api/storefront";

/** Admin: upload/remove product photos and lock the product for shops. */
export function ProductPhotos({ product, onChanged }: { product: AdminProduct; onChanged: () => void }) {
  const t = useTranslations("ProductPhotos");
  const queryClient = useQueryClient();
  const inputId = useId();
  const [images, setImages] = useState(productImages(product));
  const [locked, setLocked] = useState(isProductLocked(product));
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The response is the updated product when the backend sends it; otherwise reload the list.
  function apply(r: unknown) {
    if (r && typeof r === "object" && "images" in r) setImages(productImages(r as AdminProduct));
    if (r && typeof r === "object" && ("locked" in r || "lockedByAdmin" in r || "isLocked" in r)) setLocked(isProductLocked(r as AdminProduct));
    void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    onChanged();
  }
  const fail = (err: unknown) =>
    setError(t(err instanceof ApiError ? (err.status === 413 ? "errors.size" : err.status === 422 ? "errors.small" : err.status === 400 ? "errors.type" : "errors.generic") : "errors.generic"));

  const upload = useMutation({ mutationFn: (f: File) => uploadProductImage(product.id, f), onSuccess: (r) => { setFile(null); setLocked(true); apply(r); }, onError: fail });
  const remove = useMutation({ mutationFn: (imageId: string) => removeProductImage(product.id, imageId), onSuccess: (r, imageId) => { setImages((x) => x.filter((i) => i.id !== imageId)); apply(r); }, onError: fail });
  const lock = useMutation({ mutationFn: (v: boolean) => setProductLock(product.id, v), onSuccess: (r, v) => { setLocked(v); apply(r); }, onError: fail });

  function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setError(t("errors.type"));
    if (f.size > 5 * 1024 * 1024) return setError(t("errors.size"));
    setFile(f);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="type-caption text-ink-muted">{t("text")}</p>
      {images.length === 0 ? (
        <p className="type-body text-ink-muted">{t("none")}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {images.map((img) => {
            const src = safeMediaUrl(img.url);
            return (
              <li key={img.id ?? img.url} className="flex flex-col gap-1">
                <div className="relative aspect-square overflow-hidden rounded-sm border border-line bg-subtle">
                  {src && <Image src={src} alt="" fill unoptimized sizes="8rem" className="object-cover" />}
                </div>
                {img.id && (
                  <button type="button" onClick={() => remove.mutate(img.id as string)} disabled={remove.isPending} className="type-caption flex h-8 items-center justify-center gap-1 rounded-sm text-error hover:bg-error-soft">
                    <Trash2 className="size-3.5" aria-hidden />{t("remove")}
                  </button>
                )}
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

      <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface p-3">
        <span className="type-body flex items-center gap-2 text-ink">
          {locked ? <Lock className="size-4" aria-hidden /> : <LockOpen className="size-4" aria-hidden />}
          {locked ? t("locked") : t("unlocked")}
        </span>
        <button type="button" onClick={() => lock.mutate(!locked)} disabled={lock.isPending} className="type-body-medium h-9 rounded-sm border border-brand px-3 text-brand hover:bg-subtle">
          {locked ? t("unlock") : t("lock")}
        </button>
      </div>
      {error && <p role="alert" className="type-body text-error">{error}</p>}
    </div>
  );
}