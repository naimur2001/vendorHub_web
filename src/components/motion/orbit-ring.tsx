"use client";

import { Pause, Play } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore, type FocusEvent, type ReactNode } from "react";
import { Link } from "@/i18n/routing";

export type OrbitItem = { id: string; slug: string; title: string; image: string; price: string };

const SPEED = 12; // degrees per second: one full turn every 30 s
const REDUCE = "(prefers-reduced-motion: reduce)";

function subscribeReduce(onChange: () => void) {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Product cards circling a centre piece in 3D (user-approved exception to "no looping animation",
 * like the banner slider). Only `transform` changes. It pauses on hover, while a card has focus,
 * while off-screen and with the pause button; with "reduce motion" it stays still.
 * Tabbing to a card turns the ring so that card faces the front.
 */
export function OrbitRing({ items, centre }: { items: OrbitItem[]; centre: ReactNode }) {
  const t = useTranslations("Home");
  const sceneRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLUListElement>(null);
  const angle = useRef(0);
  const holds = useRef({ hover: false, focus: false, offscreen: false });
  const [userPaused, setUserPaused] = useState(false);
  const reduced = useSyncExternalStore(subscribeReduce, () => window.matchMedia(REDUCE).matches, () => false);
  const step = 360 / items.length;

  const apply = () => {
    if (ringRef.current) ringRef.current.style.transform = `rotateY(${angle.current}deg)`;
  };

  // Off-screen: stop turning (saves battery, and nobody is watching).
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      holds.current.offscreen = !entry.isIntersecting;
    });
    observer.observe(scene);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (userPaused || reduced) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100); // a background tab never makes it jump
      last = now;
      const h = holds.current;
      if (!h.hover && !h.focus && !h.offscreen) {
        angle.current = (angle.current - (SPEED * dt) / 1000) % 360;
        apply();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [userPaused, reduced]);

  const onFocus = (e: FocusEvent<HTMLUListElement>) => {
    const index = Number((e.target as HTMLElement).dataset.i);
    holds.current.focus = true;
    if (!Number.isFinite(index) || !ringRef.current) return;
    // Shortest way round to bring this card to the front.
    const delta = ((((-index * step - angle.current) % 360) + 540) % 360) - 180;
    angle.current += delta;
    ringRef.current.style.transition = reduced ? "" : "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)";
    apply();
  };

  const onBlur = () => {
    holds.current.focus = false;
    if (ringRef.current) ringRef.current.style.transition = "";
  };

  return (
    <div className="relative">
      <div
        ref={sceneRef}
        className="relative h-72 [--r:7.5rem] [perspective:1000px] md:h-104 md:[--r:17rem]"
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") holds.current.hover = true;
        }}
        onPointerLeave={() => {
          holds.current.hover = false;
        }}
      >
        <div className="absolute inset-0 [transform:rotateX(-10deg)] [transform-style:preserve-3d]">
          {/* The orbit: a thin gold ring lying flat around the centre */}
          <span
            aria-hidden
            className="absolute top-1/2 left-1/2 size-[calc(var(--r)*2)] rounded-full border border-gold/50 [transform:translate(-50%,-50%)_rotateX(90deg)]"
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">{centre}</div>
          <ul
            ref={ringRef}
            aria-label={t("orbitLabel")}
            onFocus={onFocus}
            onBlur={onBlur}
            className="absolute top-1/2 left-1/2 size-0 [transform-style:preserve-3d]"
          >
            {items.map((item, i) => (
              <li
                key={item.id}
                className="absolute top-0 left-0 backface-hidden"
                style={{ transform: `translate(-50%, -50%) rotateY(${i * step}deg) translateZ(var(--r))` }}
              >
                <Link
                  href={`/products/${item.slug}`}
                  data-i={i}
                  className="flex w-28 flex-col gap-1 rounded-md border border-line bg-card p-1.5 pb-2 shadow-card hover:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none md:w-36"
                >
                  <span className="relative block aspect-square overflow-hidden rounded-t-full rounded-b-sm bg-highlight-soft">
                    <Image src={item.image} alt="" fill unoptimized sizes="9rem" className="object-cover" />
                  </span>
                  <span className="type-caption line-clamp-1 px-1 text-ink">{item.title}</span>
                  <span className="type-body-medium px-1 text-brand">{item.price}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {!reduced && (
        <button
          type="button"
          onClick={() => setUserPaused((p) => !p)}
          aria-label={userPaused ? t("orbitPlay") : t("orbitPause")}
          className="absolute right-4 bottom-2 flex size-11 items-center justify-center rounded-full border border-line bg-card text-ink shadow-card hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none md:right-0"
        >
          {userPaused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
        </button>
      )}
    </div>
  );
}
