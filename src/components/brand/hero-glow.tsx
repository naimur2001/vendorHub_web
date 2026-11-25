import { cn } from "@/lib/utils";

// Four-point sparkle (24×24).
const SPARKLE =
  "M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z";

// Where the sparkles sit around the arch, their size and when they appear (once, no loop).
const SPARKLES = [
  {
    pos: "left-[4%] top-[34%]",
    size: "size-4",
    delay: "motion-safe:[animation-delay:900ms]",
  },
  {
    pos: "right-[6%] top-[22%]",
    size: "size-5",
    delay: "motion-safe:[animation-delay:1050ms]",
  },
  {
    pos: "left-[16%] top-[4%]",
    size: "size-3",
    delay: "motion-safe:[animation-delay:1200ms]",
  },
  {
    pos: "right-[18%] top-[2%]",
    size: "size-3",
    delay: "motion-safe:[animation-delay:1350ms]",
  },
  {
    pos: "right-[2%] top-[58%]",
    size: "size-3",
    delay: "motion-safe:[animation-delay:1500ms]",
  },
];

/**
 * Decoration behind the hero title: a soft gold glow, a large gold arch that draws itself once
 * (with a fainter inner arch), and a few sparkles that fade in. Purely decorative and hidden
 * from screen readers. With "reduce motion" everything is simply there.
 */
export function HeroGlow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto max-w-3xl",
        className,
      )}
    >
      {/* Glow: static blur, only its opacity animates */}
      <div className="absolute top-[18%] left-1/2 size-[min(80vw,26rem)] -translate-x-1/2 rounded-full bg-gold/15 blur-3xl motion-safe:animate-soft-in" />

      {/* The arch's legs fade out downwards, so it frames the title without a hard edge */}
      <svg
        viewBox="0 0 600 380"
        fill="none"
        className="relative w-full text-gold mask-[linear-gradient(to_bottom,black_55%,transparent)]"
      >
        <path
          d="M20 380V300A280 280 0 0 1 580 300V380"
          stroke="currentColor"
          strokeWidth="1.5"
          pathLength={1}
          strokeDasharray="1"
          className="motion-safe:animate-arch-draw"
        />
        <path
          d="M44 380V300A256 256 0 0 1 556 300V380"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="1"
          pathLength={1}
          strokeDasharray="1"
          className="motion-safe:animate-arch-draw motion-safe:[animation-delay:200ms]"
        />
        {/* Keystone at the top of the arch */}
        <path
          d="M292 12H308L304 30H296Z"
          fill="currentColor"
          className="motion-safe:animate-soft-in motion-safe:[animation-delay:800ms]"
        />
      </svg>

      {SPARKLES.map(({ pos, size, delay }) => (
        <svg
          key={pos}
          viewBox="0 0 24 24"
          className={cn(
            "absolute text-gold motion-safe:animate-soft-in",
            pos,
            size,
            delay,
          )}
        >
          <path d={SPARKLE} fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}
