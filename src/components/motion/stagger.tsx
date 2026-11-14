"use client";

import { animate, type JSAnimation } from "animejs/animation";
import { useCallback, useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const DURATION_MS = 300;
const STEP_MS = 50;
const MAX_STEPS = 6; // the last child never waits longer than 300 ms

// Brings in the direct children that are still waiting (hidden by .stagger in globals.css).
function playWaiting(container: HTMLElement, running: Set<JSAnimation>) {
  const waiting = Array.from(container.querySelectorAll<HTMLElement>(":scope > :not([data-in])"));
  if (waiting.length === 0) return;

  // Already visible ("reduce motion", or the CSS safety net showed them): leave those alone.
  const hidden = waiting.filter((el) => getComputedStyle(el).opacity === "0");
  for (const el of hidden) el.style.opacity = "0";
  for (const el of waiting) el.dataset.in = "";
  if (hidden.length === 0) return;

  const animation = animate(hidden, {
    opacity: [0, 1],
    y: [12, 0],
    duration: DURATION_MS,
    delay: (_target: unknown, index = 0) => Math.min(index, MAX_STEPS) * STEP_MS,
    ease: "outCubic",
    onComplete: () => {
      running.delete(animation);
      // Hand the elements back to CSS (hover effects use transform too).
      for (const el of hidden) {
        el.style.removeProperty("opacity");
        el.style.removeProperty("transform");
      }
    },
  });
  running.add(animation);
}

type StaggerProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  as?: "div" | "ul" | "ol";
  children: ReactNode;
};

/**
 * A list or grid whose direct children rise 12px and fade in one after another (anime.js),
 * the first time it scrolls into view. Children added later (a filtered list) come in the same
 * way; the ones that stay are not replayed. Only transform and opacity change: no layout shift.
 * With "reduce motion", or without scripts, everything is simply visible.
 */
export function Stagger({ as: Tag = "div", className, children, ...rest }: StaggerProps) {
  const ref = useRef<HTMLElement>(null);
  // One setter for whichever tag is used (a div, ul and ol each want their own ref type).
  const setRef = useCallback((node: HTMLElement | null) => {
    ref.current = node;
  }, []);
  const seen = useRef(false);
  const running = useRef(new Set<JSAnimation>());

  // After every render: once the group has been seen, new children come in straight away.
  useEffect(() => {
    if (seen.current && ref.current) playWaiting(ref.current, running.current);
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const animations = running.current;
    const start = () => {
      seen.current = true;
      playWaiting(el, animations);
    };

    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver === "undefined") {
      start();
    } else {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          observer?.disconnect();
          start();
        },
        { rootMargin: "0px 0px -5% 0px" },
      );
      observer.observe(el);
    }

    return () => {
      observer?.disconnect();
      // Finish at once, so nothing is left half shown.
      for (const animation of [...animations]) animation.complete();
    };
  }, []);

  return (
    <Tag {...rest} ref={setRef} className={cn("stagger", className)}>
      {children}
    </Tag>
  );
}
