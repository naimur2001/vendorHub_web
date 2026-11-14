"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const STAGGER_MS = 60;
const MAX_STAGGER_STEPS = 6; // never waits longer than 360 ms

// One shared observer for every <Reveal>: elements that come into view together
// are shown one after another; each element is revealed once, then forgotten.
let revealObserver: IntersectionObserver | null = null;

function getRevealObserver(): IntersectionObserver {
  revealObserver ??= new IntersectionObserver(
    (entries, observer) => {
      let step = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        const fixed = el.dataset.revealDelay;
        const delay = fixed !== undefined ? Number(fixed) : Math.min(step++, MAX_STAGGER_STEPS) * STAGGER_MS;
        if (delay > 0) el.style.transitionDelay = `${delay}ms`;
        el.dataset.shown = "";
        observer.unobserve(el);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
  );
  return revealObserver;
}

type RevealProps = {
  children: React.ReactNode;
  /** Fixed delay in ms (at most 700). Without it, neighbours stagger by themselves. */
  delay?: number;
  className?: string;
};

/**
 * Rises 14px and fades in the first time it scrolls into view (CSS: .reveal in globals.css).
 * With "reduce motion", or without scripts, the content is simply visible.
 */
export function Reveal({ children, delay, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.shown = "";
      return;
    }
    const observer = getRevealObserver();
    observer.observe(el);
    return () => observer.unobserve(el);
  }, []);

  return (
    <div
      ref={ref}
      data-reveal-delay={delay === undefined ? undefined : Math.min(Math.max(delay, 0), 700)}
      className={cn("reveal", className)}
    >
      {children}
    </div>
  );
}

/**
 * Touch screens have no hover: this marks its box with data-active while it sits in the
 * middle of the screen, so CSS can play the hover effect there (see .door in globals.css).
 * Does nothing on devices with a mouse.
 */
export function CenterStage({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (!window.matchMedia("(hover: none)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.dataset.active = "";
        else delete el.dataset.active;
      },
      // Only the middle band of the screen counts (also sideways, for swipe rows).
      { rootMargin: "-35% -25% -35% -25%" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
