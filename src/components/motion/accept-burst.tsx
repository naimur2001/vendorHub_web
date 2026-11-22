"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

// 16 pieces in the brand colours, spread evenly around the circle with a little variety.
const PIECES = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2;
  const distance = 56 + (i % 3) * 18;
  return {
    x: Math.round(Math.cos(angle) * distance),
    y: Math.round(Math.sin(angle) * distance),
    r: (i * 47) % 360,
    color: ["bg-brand", "bg-gold", "bg-highlight", "bg-success-ink"][i % 4],
    round: i % 2 === 0,
  };
});

/**
 * A one-time confetti burst when `active` turns true while the page is open
 * (not when the page loads already accepted). CSS only; nothing shows with reduced motion.
 */
export function AcceptBurst({ active }: { active: boolean }) {
  const wasActive = useRef(active);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (active && !wasActive.current) setBurst((n) => n + 1);
    wasActive.current = active;
  }, [active]);

  if (burst === 0) return null;
  return (
    <span key={burst} aria-hidden className="pointer-events-none absolute top-0 left-8 z-10 size-0">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className={`confetti-piece absolute block size-2 opacity-0 ${p.color} ${p.round ? "rounded-full" : "rounded-[1px]"}`}
          style={{ "--x": `${p.x}px`, "--y": `${p.y}px`, "--r": `${p.r}deg` } as CSSProperties}
        />
      ))}
    </span>
  );
}
