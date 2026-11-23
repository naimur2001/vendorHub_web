"use client";

import { useMutation } from "@tanstack/react-query";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { ApiError } from "@/lib/api/core";
import type { ReviewPhoto } from "@/lib/api/product-reviews";
import { addReviewPhoto, removeReviewPhoto } from "@/lib/api/reviews";
import { safeMediaUrl } from "@/lib/api/storefront";

const MAX = 3; // backend rule
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** After a review is saved: verified buyers can add up to 3 photos (5 MB each, JPEG/PNG/WebP). */
export function ReviewPhotoUpload({ reviewId }: { reviewId: string }) {
  const t = useTranslations("ReviewPhotos");
  const id = useId();
  const [photos, setPhotos] = useState<ReviewPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (file: File) => addReviewPhoto(reviewId, file),
    onMutate: () => setError(null),
    onSuccess: (p) => setPhotos((old) => [...old, p]),
    onError: (err) => {
      const code = err instanceof ApiError ? (err.details as { code?: string } | undefined)?.code : undefined;
      if (code === "NOT_VERIFIED_BUYER") return setError(t("notBuyer"));
      if (code === "REVIEW_PHOTO_LIMIT") return setError(t("limit"));
      if (err instanceof ApiError && err.status === 413) return setError(t("tooBig"));
      if (err instanceof ApiError && err.status === 429) return setError(t("tooMany"));
      setError(err instanceof ApiError && err.status === 0 ? t("network") : t("uploadError"));
    },
  });
  const remove = useMutation({
    mutationFn: (photoId: string) => removeReviewPhoto(reviewId, photoId),
    onSuccess: (_, photoId) => setPhotos((old) => old.filter((p) => p.id !== photoId)),
    onError: () => setError(t("removeError")),
  });

  function pick(file: File | undefined) {
    if (!file) return;
    if (!TYPES.includes(file.type)) return setError(t("wrongType"));
    if (file.size > MAX_BYTES) return setError(t("tooBig"));
    add.mutate(file);
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2">
      <p className="type-caption text-ink-secondary">{t("addHint", { max: MAX })}</p>
      <ul className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <li key={p.id} className="relative size-20 overflow-hidden rounded-md border border-line bg-subtle">
            {safeMediaUrl(p.thumbUrl) && <Image src={safeMediaUrl(p.thumbUrl)!} alt={t("yourPhoto", { n: i + 1 })} fill unoptimized sizes="80px" className="object-cover" />}
            <button
              type="button"
              onClick={() => remove.mutate(p.id)}
              disabled={remove.isPending}
              aria-label={t("remove", { n: i + 1 })}
              className="absolute top-0 right-0 flex size-11 items-start justify-end p-1 focus-visible:outline-none [&>span]:focus-visible:ring-2 [&>span]:focus-visible:ring-brand"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-ink/70 text-primary-foreground">
                <X className="size-3.5" aria-hidden />
              </span>
            </button>
          </li>
        ))}
        {photos.length < MAX && (
          <li>
            <label
              htmlFor={id}
              className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line-strong text-ink-muted hover:border-brand hover:text-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
            >
              {add.isPending ? <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
              <span className="type-caption">{add.isPending ? t("uploading") : t("add")}</span>
              <input
                id={id}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={add.isPending}
                onChange={(e) => {
                  pick(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </li>
        )}
      </ul>
      {error && <p role="alert" className="type-caption text-error">{error}</p>}
    </div>
  );
}
