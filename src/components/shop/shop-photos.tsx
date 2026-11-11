"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ImagePlus, LoaderCircle, Star, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { ApiError } from "@/lib/api/core";
import { addShopPhoto, deleteShopPhoto, listShopPhotos, makeCover, photoKeys, PHOTO_KINDS, verifyShopPhoto, type ShopPhoto, type ShopPhotoKind } from "@/lib/api/shop-photos";
import { safeMediaUrl } from "@/lib/api/storefront";
import { cn } from "@/lib/utils";

function PhotoTile({ p, children }: { p: ShopPhoto; children: React.ReactNode }) {
  const t = useTranslations("ShopPhotos");
  const src = safeMediaUrl(p.url);
  return (
    <li className="flex flex-col gap-2 rounded-md border border-line bg-card p-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-subtle">
        {src && <Image src={src} alt={p.caption ?? t(`kind.${p.kind}`)} fill unoptimized sizes="16rem" className="object-cover" />}
        {p.isCover && <span className="type-caption absolute top-1 left-1 rounded-full bg-brand px-2 py-0.5 text-primary-foreground">{t("cover")}</span>}
      </div>
      <p className="type-caption text-ink">{t(`kind.${p.kind}`)}{p.caption ? ` · ${p.caption}` : ""}</p>
      <p className={cn("type-caption flex items-center gap-1", p.verified ? "text-verified" : "text-ink-muted")}>
        {p.verified && <BadgeCheck className="size-3.5" aria-hidden />}
        {p.verified ? t("verified") : t("unverified")}
      </p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </li>
  );
}

/** Owner: add, choose cover, delete. */
export function OwnerShopPhotos({ shopId, slug }: { shopId: string; slug: string }) {
  const t = useTranslations("ShopPhotos");
  const queryClient = useQueryClient();
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<ShopPhotoKind>("EXTERIOR");
  const [caption, setCaption] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const photos = useQuery({ queryKey: photoKeys.list(slug), queryFn: () => listShopPhotos(slug) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: photoKeys.list(slug) });
  const fail = (err: unknown) =>
    setError(t(err instanceof ApiError ? (err.status === 409 ? "errors.duplicate" : err.status === 413 ? "errors.size" : err.status === 400 ? "errors.rejected" : "errors.generic") : "errors.generic"));

  const add = useMutation({ mutationFn: () => addShopPhoto(shopId, file as File, kind, caption.trim()), onSuccess: () => { setFile(null); setCaption(""); setError(null); refresh(); }, onError: fail });
  const cover = useMutation({ mutationFn: (id: string) => makeCover(shopId, id), onSuccess: refresh, onError: fail });
  const remove = useMutation({ mutationFn: (id: string) => deleteShopPhoto(shopId, id), onSuccess: () => { setConfirmId(null); refresh(); }, onError: fail });

  function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setError(t("errors.type"));
    if (f.size > 5 * 1024 * 1024) return setError(t("errors.size"));
    setFile(f);
  }

  const list = photos.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <p className="type-caption text-ink-muted">{t("text")}</p>
      {list.length >= 12 ? (
        <p className="type-body text-ink-secondary">{t("full")}</p>
      ) : (
        <div className="flex flex-col gap-2 rounded-md bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={inputId} className="type-body-medium flex h-10 cursor-pointer items-center gap-2 rounded-sm border border-brand px-3 text-brand hover:bg-subtle has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand">
              <ImagePlus className="size-4" aria-hidden />
              {file ? file.name.slice(0, 30) : t("choose")}
              <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <select aria-label={t("kindLabel")} value={kind} onChange={(e) => setKind(e.target.value as ShopPhotoKind)} className="type-body h-10 rounded-md border border-input bg-card px-2 text-ink">
              {PHOTO_KINDS.map((k) => <option key={k} value={k}>{t(`kind.${k}`)}</option>)}
            </select>
          </div>
          <input aria-label={t("caption")} placeholder={t("caption")} maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} className="type-body h-10 rounded-md border border-input bg-card px-3 text-ink" />
          <p className="type-caption text-ink-muted">{t("rules")}</p>
          <button type="button" onClick={() => add.mutate()} disabled={!file || add.isPending} className="type-body-medium flex h-10 items-center gap-2 self-start rounded-sm bg-action px-4 text-primary-foreground disabled:opacity-50">
            {add.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {add.isPending ? t("adding") : t("add")}
          </button>
        </div>
      )}
      {error && <p role="alert" className="type-body text-error">{error}</p>}
      {list.length === 0 ? (
        <p className="type-body text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {list.map((p) => (
            <PhotoTile key={p.id} p={p}>
              {!p.isCover && (
                <button type="button" onClick={() => cover.mutate(p.id)} className="type-caption flex h-8 items-center gap-1 rounded-sm px-2 text-brand hover:bg-subtle">
                  <Star className="size-3.5" aria-hidden />{t("makeCover")}
                </button>
              )}
              <button
                type="button"
                onClick={() => (confirmId === p.id ? remove.mutate(p.id) : setConfirmId(p.id))}
                onBlur={() => setConfirmId(null)}
                className={cn("type-caption flex h-8 items-center gap-1 rounded-sm px-2", confirmId === p.id ? "bg-error text-primary-foreground" : "text-error hover:bg-error-soft")}
              >
                <Trash2 className="size-3.5" aria-hidden />{confirmId === p.id ? t("confirmDelete") : t("delete")}
              </button>
            </PhotoTile>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Admin: verify photos against the real shop. */
export function AdminShopPhotos({ shopId, slug }: { shopId: string; slug: string }) {
  const t = useTranslations("ShopPhotos");
  const queryClient = useQueryClient();
  const photos = useQuery({ queryKey: photoKeys.list(slug), queryFn: () => listShopPhotos(slug) });
  const verify = useMutation({
    mutationFn: ({ id, v }: { id: string; v: boolean }) => verifyShopPhoto(shopId, id, v),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: photoKeys.list(slug) }),
  });

  if (photos.isPending) return <LoaderCircle className="size-5 animate-spin text-ink-muted" aria-hidden />;
  const list = photos.data ?? [];
  if (list.length === 0) return <p className="type-caption text-ink-muted">{t("empty")}</p>;
  return (
    <ul className="grid grid-cols-2 gap-2">
      {list.map((p) => (
        <PhotoTile key={p.id} p={p}>
          <button type="button" disabled={verify.isPending} onClick={() => verify.mutate({ id: p.id, v: !p.verified })} className={cn("type-caption h-8 rounded-sm px-2", p.verified ? "text-ink-secondary hover:bg-subtle" : "bg-action text-primary-foreground")}>
            {p.verified ? t("unverify") : t("verify")}
          </button>
        </PhotoTile>
      ))}
    </ul>
  );
}



/** Storefront: the shop's photos for customers (nothing shown when there are none). */
export function ShopGallery({ slug }: { slug: string }) {
  const t = useTranslations("ShopPhotos");
  const photos = useQuery({ queryKey: photoKeys.list(slug), queryFn: () => listShopPhotos(slug), staleTime: 5 * 60_000 });
  const list = photos.data ?? [];
  if (list.length === 0) return null;
  return (
    <section aria-labelledby="gallery-heading" className="flex flex-col gap-3">
      <h2 id="gallery-heading" className="type-h3 text-ink">{t("galleryTitle")}</h2>
      <div className="scroll-row -mx-4 px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-3 pb-1">
          {list.map((p) => {
            const src = safeMediaUrl(p.url);
            const wide = p.kind === "PANORAMA_360";
            return (
              <li key={p.id} className={cn("flex flex-col gap-1", wide ? "w-96" : "w-56")}>
                <div className={cn("relative overflow-hidden rounded-md border border-line bg-subtle", wide ? "aspect-[2/1]" : "aspect-[4/3]")}>
                  {src && <Image src={src} alt={p.caption ?? t(`kind.${p.kind}`)} fill unoptimized sizes={wide ? "24rem" : "14rem"} className="object-cover" />}
                  {wide && <span className="type-caption absolute bottom-1 left-1 rounded-full bg-ink/70 px-2 py-0.5 text-primary-foreground">{t("panorama")}</span>}
                </div>
                <p className="type-caption text-ink-secondary">{p.caption ?? t(`kind.${p.kind}`)}</p>
                {p.verified && (
                  <p className="type-caption flex items-center gap-1 text-verified">
                    <BadgeCheck className="size-3.5" aria-hidden />{t("verified")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}