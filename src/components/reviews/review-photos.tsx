"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ReportButton } from "@/components/moderation/report-button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ReviewPhoto } from "@/lib/api/product-reviews";
import { safeMediaUrl } from "@/lib/api/storefront";

/** Up to 3 customer photos under a review; tap one to see it large (with a Report button). */
export function ReviewPhotos({ photos }: { photos: ReviewPhoto[] }) {
  const t = useTranslations("ReviewPhotos");
  const [open, setOpen] = useState<ReviewPhoto | null>(null);
  const shown = photos.filter((p) => safeMediaUrl(p.thumbUrl));
  if (shown.length === 0) return null;
  const big = open ? safeMediaUrl(open.url) : null;

  return (
    <>
      <ul className="flex gap-2">
        {shown.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setOpen(p)}
              aria-label={t("open", { n: i + 1, total: shown.length })}
              className="relative block size-20 overflow-hidden rounded-md border border-line bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <Image src={safeMediaUrl(p.thumbUrl)!} alt="" fill unoptimized sizes="80px" className="object-cover transition-transform duration-200 motion-safe:hover:scale-105" />
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl bg-card p-3">
          <DialogTitle className="sr-only">{t("dialog")}</DialogTitle>
          {big && open && (
            <div className="flex flex-col gap-2">
              <span className="relative block aspect-square w-full overflow-hidden rounded-md bg-subtle">
                <Image src={big} alt={t("dialog")} fill unoptimized sizes="(min-width: 672px) 640px, 90vw" className="object-contain" />
              </span>
              <div className="flex justify-end">
                <ReportButton targetType="REVIEW_PHOTO" targetId={open.id} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
