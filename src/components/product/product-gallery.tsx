"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ArchFrame } from "@/components/brand/arch-frame";
import { cn } from "@/lib/utils";

type Props = {
  images: string[];
  title: string;
  placeholder: React.ReactNode; // shown when the product has no photos
};

/** Main photo in the arch frame, thumbnails to switch (only when there is more than one photo). */
export function ProductGallery({ images, title, placeholder }: Props) {
  const t = useTranslations("Product");
  const [index, setIndex] = useState(0);
  const current = images[index];
  const total = images.length;

  return (
    <div className="flex flex-col gap-3">
      <ArchFrame ratio="portrait" className="w-full bg-highlight-soft lg:max-w-[560px]">
        {current ? (
          <Image
            src={current}
            alt={`${title}: ${t("photoN", { n: index + 1, total })}`}
            fill
            unoptimized
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          placeholder
        )}
      </ArchFrame>

      {total > 1 && (
        <ul aria-label={t("photos")} className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-pressed={i === index}
                aria-label={t("photoN", { n: i + 1, total })}
                className={cn(
                  "relative block size-16 overflow-hidden rounded-t-full rounded-b-sm border-2 bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
                  i === index ? "border-brand" : "border-transparent hover:border-line-strong",
                )}
              >
                <Image src={src} alt="" fill unoptimized sizes="64px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}