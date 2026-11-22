"use client";

import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { getImageProps } from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Link } from "@/i18n/routing";
import type { HomeBanner } from "@/lib/api/catalog-cache";
import { safeMediaUrl } from "@/lib/api/storefront";
import { cn } from "@/lib/utils";

const AUTOPLAY_MS = 6000;
const SWIPE_PX = 50;

// Slim billboard: wide and low. Phones get a little more height so text still fits.
export const BANNER_FRAME = "aspect-5/2 sm:aspect-4/1";

const navButton =
  "flex size-11 items-center justify-center rounded-full border border-gold/70 bg-brand/80 text-primary-foreground backdrop-blur-sm hover:bg-brand focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-brand focus-visible:outline-none motion-safe:transition motion-safe:duration-200 motion-safe:hover:scale-105";

const ctaClass =
  "group/cta type-body-medium inline-flex h-11 items-center gap-2 rounded-sm bg-gold px-5 text-brand shadow-card hover:bg-card focus-visible:ring-2 focus-visible:ring-card focus-visible:ring-offset-2 focus-visible:ring-offset-brand focus-visible:outline-none";

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

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

const pad = (n: number) => String(n).padStart(2, "0");

function Slide({ banner, active, first }: { banner: HomeBanner; active: boolean; first: boolean }) {
  const t = useTranslations("Banners");
  const bn = useLocale() === "bn";
  const title = (bn && banner.titleBn) || banner.titleEn;
  const subtitle = (bn && banner.subtitleBn) || banner.subtitleEn;
  const cta = (bn && banner.ctaLabelBn) || banner.ctaLabelEn || t("open");
  const link = safeLink(banner.linkUrl);

  const src = safeMediaUrl(banner.media.url);
  const still = safeMediaUrl(banner.media.thumbUrl);
  const mobile = safeMediaUrl(banner.mobileMedia?.url);
  if (!src) return null;

  const { props: img } = getImageProps({ src, alt: title, fill: true, unoptimized: true, priority: first, sizes: "(min-width: 1280px) 1200px, 100vw" });
  const showText = Boolean(subtitle || link);
  // Enter effect for the visible slide: transform + opacity only, 300 ms.
  const enter = cn("motion-safe:transition motion-safe:duration-300 motion-safe:ease-out", active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0");
  const arrow = <ArrowRight className="size-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover/cta:translate-x-1" aria-hidden />;

  return (
    <div className="relative size-full overflow-hidden">
      <picture>
        {/* Animated banners stay still for people who turn motion off */}
        {banner.mediaType === "GIF" && still && <source media="(prefers-reduced-motion: reduce)" srcSet={still} />}
        {mobile && <source media="(max-width: 639px)" srcSet={mobile} />}
        <img
          {...img}
          alt={title}
          className={cn("object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out", active ? "scale-100" : "scale-105")}
        />
      </picture>

      {showText && (
        <>
          <div aria-hidden className="absolute inset-0 bg-linear-to-t from-brand/85 via-brand/35 to-transparent sm:bg-linear-to-r sm:from-brand/90 sm:via-brand/45" />
          <div className="absolute inset-0 flex items-end p-4 pb-12 sm:items-center sm:p-8 md:px-14">
            <div className="flex max-w-lg flex-col items-start gap-1.5 md:gap-2.5">
              {/* Gold keystone line: the brand's arch detail */}
              <span aria-hidden className={cn("flex items-center gap-2", enter)}>
                <span className="h-px w-8 bg-gold" />
                <span className="size-2 rotate-45 bg-gold" />
              </span>
              <p className={cn("type-h2 line-clamp-2 text-primary-foreground drop-shadow-sm", enter, "motion-safe:delay-75")}>{title}</p>
              {subtitle && (
                <p className={cn("type-body hidden max-w-md text-primary-foreground/90 md:line-clamp-2", enter, "motion-safe:delay-100")}>{subtitle}</p>
              )}
              {link && (
                <span className={cn("mt-1", enter, "motion-safe:delay-150")}>
                  {link.external ? (
                    <a href={link.href} target="_blank" rel="noopener noreferrer" className={ctaClass}>
                      {cta}
                      {arrow}
                    </a>
                  ) : (
                    <Link href={link.href} className={ctaClass}>
                      {cta}
                      {arrow}
                    </Link>
                  )}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Home page billboard: sliding admin banners. Pauses on hover, focus, hidden tab and reduced motion. */
export function BannerSlider({ banners }: { banners: HomeBanner[] }) {
  const t = useTranslations("Banners");
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const startX = useRef<number | null>(null);
  const count = banners.length;

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const playing = count > 1 && !reduced && !userPaused && !hovered && !focused && !hidden;
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => go(index + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [playing, index, go]);

  if (count === 0) return null;

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "ArrowLeft") go(index - 1);
    else if (e.key === "ArrowRight") go(index + 1);
    else return;
    e.preventDefault();
  }
  function onPointerDown(e: PointerEvent) {
    startX.current = e.clientX;
  }
  function onPointerUp(e: PointerEvent) {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) > SWIPE_PX) go(index + (dx < 0 ? 1 : -1));
  }

  return (
    <section
      aria-roledescription={t("carousel")}
      aria-label={t("label")}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocused(false)}
      className="group/slider relative rounded-3xl shadow-card"
    >
      <div className="relative overflow-hidden rounded-3xl">
        <div
          className={cn("flex touch-pan-y motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out", BANNER_FRAME)}
          style={{ transform: `translateX(-${index * 100}%)` }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (startX.current = null)}
          aria-live={playing ? "off" : "polite"}
        >
          {banners.map((b, i) => (
            <div
              key={b.id}
              role="group"
              aria-roledescription={t("slide")}
              aria-label={t("slideOf", { n: i + 1, total: count })}
              aria-hidden={i !== index}
              inert={i !== index}
              className="relative h-full w-full shrink-0 bg-subtle"
            >
              <Slide banner={b} active={i === index} first={i === 0} />
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            {/* Desktop arrows: show on hover or keyboard focus */}
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={t("previous")}
              className={cn(navButton, "absolute top-1/2 left-4 hidden -translate-y-1/2 opacity-0 group-hover/slider:opacity-100 focus-visible:opacity-100 sm:flex")}
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label={t("next")}
              className={cn(navButton, "absolute top-1/2 right-4 hidden -translate-y-1/2 opacity-0 group-hover/slider:opacity-100 focus-visible:opacity-100 sm:flex")}
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>

            {/* Counter, segments and pause, bottom right */}
            <div className="absolute right-2 bottom-1 flex items-center md:right-4">
              <span aria-hidden className="mr-1 font-heading text-sm text-primary-foreground tabular-nums">
                <span className="text-gold">{pad(index + 1)}</span>
                <span className="opacity-60"> / {pad(count)}</span>
              </span>
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={t("goTo", { n: i + 1 })}
                  aria-current={i === index ? "true" : undefined}
                  className="flex h-11 w-7 items-center justify-center focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
                >
                  <span aria-hidden className="h-1 w-5 overflow-hidden rounded-full bg-card/40">
                    <span
                      className={cn(
                        "block h-full w-full origin-left rounded-full bg-gold motion-safe:transition-transform motion-safe:duration-300",
                        i === index ? "scale-x-100" : "scale-x-0",
                      )}
                    />
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setUserPaused((p) => !p)}
                aria-label={userPaused ? t("play") : t("pause")}
                className="flex size-11 items-center justify-center text-primary-foreground hover:text-gold focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
              >
                {userPaused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
