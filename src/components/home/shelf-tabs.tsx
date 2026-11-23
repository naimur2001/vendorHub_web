"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tab = { key: string; label: string; panel: ReactNode };

/**
 * Tabs over panels that the server already rendered (no loading when switching).
 * Keyboard: arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern).
 */
export function ShelfTabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const id = useId();
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight" ? (active === last ? 0 : active + 1)
      : e.key === "ArrowLeft" ? (active === 0 ? last : active - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${id}-tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={active === i}
            aria-controls={`${id}-panel-${tab.key}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            className={cn(
              "type-body-medium h-11 shrink-0 rounded-full border px-5 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none",
              active === i ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.key}
          id={`${id}-panel-${tab.key}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${tab.key}`}
          hidden={active !== i}
          tabIndex={0}
          className="rounded-md focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
