"use client";

import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { HomeBanner } from "@/lib/api/catalog-cache";
import { safeMediaUrl } from "@/lib/api/storefront";
import { cn } from "@/lib/utils";

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

const CARD =
  "group relative isolate flex h-full min-h-0 flex-col justify-end overflow-hidden rounded-3xl bg-brand shadow-card focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none";

/** Tall admin advertisement beside the banner (wide screens). The whole card is the link when it has one. */
export function SideAd({ ad }: { ad: HomeBanner }) {
  const t = useTranslations("SideAd");
  const bn = useLocale() === "bn";
  const title = (bn && ad.titleBn) || ad.titleEn;
  const subtitle = (bn && ad.subtitleBn) || ad.subtitleEn;
  const cta = (bn && ad.ctaLabelBn) || ad.ctaLabelEn;
  const link = safeLink(ad.linkUrl);
  const src = safeMediaUrl(ad.media.url);
  const still = safeMediaUrl(ad.media.thumbUrl);
  if (!src) return null;
  const contain = ad.fit === "CONTAIN";

  const body = (
    <>
      {contain && (
        // eslint-disable-next-line @next/next/no-img-element -- decorative backdrop of the same media file
        <img src={still ?? src} alt="" aria-hidden className="absolute inset-0 -z-10 size-full scale-110 object-cover opacity-70 blur-2xl" />
      )}
      <picture>
        {/* Animated adverts stay still for people who turn motion off */}
        {ad.mediaType === "GIF" && still && <source media="(prefers-reduced-motion: reduce)" srcSet={still} />}
        <img
          src={src}
          alt={title}
          loading="lazy"
          className={cn(
            "absolute inset-0 -z-10 size-full motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105",
            contain ? "object-contain" : "object-cover",
          )}
        />
      </picture>
      <span className="type-caption absolute top-3 left-3 rounded-full bg-card/90 px-2 py-0.5 text-ink-secondary backdrop-blur-sm">{t("label")}</span>
      {(subtitle || cta) && (
        <span className="flex flex-col gap-1 bg-linear-to-t from-brand/90 via-brand/60 to-transparent p-4 pt-10">
          <span className="type-h3 line-clamp-2 text-primary-foreground">{title}</span>
          {subtitle && <span className="type-caption line-clamp-2 text-primary-foreground/85">{subtitle}</span>}
          {link && (
            <span className="type-body-medium mt-1 inline-flex items-center gap-1.5 text-gold">
              {cta || t("open")}
              <ArrowRight className="size-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-1" aria-hidden />
            </span>
          )}
        </span>
      )}
    </>
  );

  if (!link) return <aside aria-label={t("label")} className={CARD}>{body}</aside>;
  return link.external ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer sponsored" aria-label={`${t("label")}: ${title}`} className={CARD}>
      {body}
    </a>
  ) : (
    <Link href={link.href} aria-label={`${t("label")}: ${title}`} className={CARD}>
      {body}
    </Link>
  );
}
