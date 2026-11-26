"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { Link } from "@/i18n/routing";
import type { HomeBanner } from "@/lib/api/catalog-cache";
import { safeMediaUrl } from "@/lib/api/storefront";
import { cn } from "@/lib/utils";

// Owner's choice: a step along the curve every 7 s, gliding for 700 ms (slower than the usual 300 ms rule).
const AUTOPLAY_MS = 7000;
const GLIDE = "motion-safe:transition-[transform,opacity] motion-safe:duration-700 motion-safe:ease-in-out";
const SWIPE_PX = 50;
const cardLink = "absolute inset-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset focus-visible:outline-none";
// At least this many cards on the curve (banners repeat to fill it), so a card that wraps
// from one end to the other always does it out of sight.
const MIN_SLOTS = 11;

/**
 * Where a card sits on the curve, by its distance from the centre card (|d|), per screen size.
 * x = sideways shift (% of the slider width), s = size, r = turn towards the centre (deg), o = opacity.
 * The middle card is the big, highlighted one; its neighbours are smaller, faded and turned towards it.
 */
type Spot = { x: number; s: number; r: number; o: number };
const CURVE: Record<"phone" | "tablet" | "desktop", Spot[]> = {
  // a big middle card, with slivers of its neighbours at the edges
  phone: [
    { x: 0, s: 1, r: 0, o: 1 },
    { x: 72, s: 0.8, r: 24, o: 0.6 },
    { x: 120, s: 0.7, r: 30, o: 0 },
  ],
  // a big middle card and half of each neighbour
  tablet: [
    { x: 0, s: 1, r: 0, o: 1 },
    { x: 58, s: 0.8, r: 22, o: 0.65 },
    { x: 95, s: 0.7, r: 30, o: 0 },
  ],
  // a big middle card and half of each neighbour (fits the middle column between the side panels)
  desktop: [
    { x: 0, s: 1, r: 0, o: 1 },
    { x: 50, s: 0.8, r: 20, o: 0.7 },
    { x: 82, s: 0.65, r: 30, o: 0 },
  ],
};

function spot(table: Spot[], d: number): string {
  const p = table[Math.min(Math.abs(d), table.length - 1)];
  const side = Math.sign(d);
  // Left cards turn right and right cards turn left, so every card faces the middle.
  return `translateX(${side * p.x}cqw) perspective(100cqw) rotateY(${-side * p.r}deg) scale(${p.s})`;
}
function opacity(table: Spot[], d: number): number {
  return table[Math.min(Math.abs(d), table.length - 1)].o;
}

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

/** One card's picture (the whole image with a soft blurred fill when the admin chose "show whole image"). */
function CardImage({ banner, title, eager }: { banner: HomeBanner; title: string; eager: boolean }) {
  const src = safeMediaUrl(banner.media.url);
  const still = safeMediaUrl(banner.media.thumbUrl);
  if (!src) return null;
  const contain = banner.fit === "CONTAIN";
  return (
    <>
      {contain && (
        // eslint-disable-next-line @next/next/no-img-element -- decorative backdrop of the same media file
        <img src={still ?? src} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-70 blur-2xl" />
      )}
      <picture>
        {/* Animated banners stay still for people who turn motion off */}
        {banner.mediaType === "GIF" && still && <source media="(prefers-reduced-motion: reduce)" srcSet={still} />}
        <img
          src={src}
          alt={title}
          draggable={false}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          className={cn("absolute inset-0 size-full", contain ? "object-contain" : "object-cover")}
        />
      </picture>
    </>
  );
}

/**
 * Home page billboard: admin banners on a curved strip (cards grow and turn towards the edges).
 * Steps one card every 7 s; pauses on hover, keyboard focus, a hidden tab and reduced motion.
 * Swipe, a tap on a side card, or ←/→ on the focused slider moves it; the centre card opens its link.
 */
export function BannerSlider({ banners }: { banners: HomeBanner[] }) {
  const t = useTranslations("Banners");
  const bn = useLocale() === "bn";
  const reduced = useReducedMotion();
  const count = banners.length;
  // Banners repeat to fill the curve; slot i shows banner i % count.
  const slots = count === 0 ? 0 : count * Math.ceil(MIN_SLOTS / count);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(false);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);

  const go = useCallback((next: number) => setActive(((next % slots) + slots) % slots), [slots]);

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const playing = count > 1 && !reduced && !focused && !hovered && !hidden;
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => go(active + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [playing, active, go]);

  if (count === 0) return null;

  const current = banners[active % count];
  const title = (bn && current.titleBn) || current.titleEn;
  const link = safeLink(current.linkUrl);

  // Signed distance of a slot from the centre, the short way round.
  const offset = (i: number) => {
    let d = (((i - active) % slots) + slots) % slots;
    if (d > slots / 2) d -= slots;
    return d;
  };
  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "ArrowLeft") go(active - 1);
    else if (e.key === "ArrowRight") go(active + 1);
    else return;
    e.preventDefault();
  }
  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    drag.current = { x: e.clientX, moved: false };
  }
  function onPointerUp(e: PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > SWIPE_PX) {
      drag.current.moved = true; // the click that follows a swipe is ignored
      go(active + (dx < 0 ? 1 : -1));
    }
  }

  return (
    <section
      aria-roledescription={t("carousel")}
      aria-label={t("label")}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // Only keyboard focus pauses; a mouse click on a control must not stop the slideshow.
      onFocus={(e) => setFocused(e.target.matches(":focus-visible"))}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocused(false)}
      className="flex flex-col items-center"
    >
      {/* The curve: reaches into the page margins; the far cards are cut off at the edges and fade out */}
      <div
        className="@container relative -mx-4 aspect-2/1 w-[calc(100%+2rem)] touch-pan-y overflow-hidden select-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)] sm:aspect-5/2 md:-mx-10 md:w-[calc(100%+5rem)] lg:aspect-[25/8] xl:mx-0 xl:w-full"
        tabIndex={0}
        role="group"
        aria-roledescription={t("slide")}
        aria-label={`${t("slideOf", { n: (active % count) + 1, total: count })}: ${title}`}
        aria-live={playing ? "off" : "polite"}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
      >
        {Array.from({ length: slots }, (_, i) => {
          const banner = banners[i % count];
          const d = offset(i);
          const centre = d === 0;
          const name = (bn && banner.titleBn) || banner.titleEn;
          const style = {
            "--t0": spot(CURVE.phone, d),
            "--t1": spot(CURVE.tablet, d),
            "--t2": spot(CURVE.desktop, d),
            "--o0": opacity(CURVE.phone, d),
            "--o1": opacity(CURVE.tablet, d),
            "--o2": opacity(CURVE.desktop, d),
            zIndex: 20 - Math.abs(d),
          } as CSSProperties;
          return (
            <div
              key={i}
              aria-hidden={!centre}
              onClick={() => {
                if (drag.current?.moved) return;
                if (!centre) go(active + d);
              }}
              style={style}
              className={cn(
                // Card size per screen (in % of the slider width), positioned from the middle
                "absolute top-1/2 left-1/2 aspect-2/1 w-[88cqw] -translate-x-1/2 -translate-y-1/2 sm:w-[68cqw] lg:w-[56cqw]",
                "[opacity:var(--o0)] [transform:var(--t0)] sm:[opacity:var(--o1)] sm:[transform:var(--t1)] lg:[opacity:var(--o2)] lg:[transform:var(--t2)]",
                GLIDE,
                !centre && "cursor-pointer",
              )}
            >
              <div
                className={cn(
                  "relative size-full overflow-hidden rounded-2xl bg-subtle shadow-card",
                  centre && "shadow-modal ring-2 ring-gold ring-offset-4 ring-offset-background",
                )}
              >
                <CardImage banner={banner} title={name} eager={i < 3 || i > slots - 3} />
                {/* The centre card is the banner's link */}
                {centre &&
                  link &&
                  (link.external ? (
                    <a href={link.href} target="_blank" rel="noopener noreferrer" aria-label={name} className={cardLink} draggable={false} />
                  ) : (
                    <Link href={link.href} aria-label={name} className={cardLink} draggable={false} />
                  ))}
              </div>
            </div>
          );
        })}
      </div>

    </section>
  );
}
