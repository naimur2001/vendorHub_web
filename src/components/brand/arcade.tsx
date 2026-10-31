import { cn } from "@/lib/utils";

const ARCH_X = [45, 235, 425, 615, 805];
const CENTRE_X = 425;

function archPath(x: number, closed = false): string {
  return `M${x} 230 V128 A75 75 0 0 1 ${x + 150} 128 V230${closed ? " Z" : ""}`;
}

// pathLength=1 + dasharray 1 lets one animation "draw" every line, whatever its real length.
const DRAW = "stroke-gold motion-safe:animate-arch-draw";

/**
 * The shopping arcade: five arches under a cornice. The red centre arch is the shop you walk into.
 * On load the lines draw in, the centre arch rises, then keystone and door appear (once per visit).
 */
export function Arcade({ className }: { className?: string }) {
  const sideArches = ARCH_X.filter((x) => x !== CENTRE_X);

  return (
    <svg viewBox="0 0 1000 232" className={cn("w-full", className)} aria-hidden="true">
      {/* Cornice */}
      <line x1="0" y1="14" x2="1000" y2="14" strokeWidth="2" pathLength={1} strokeDasharray="1" className={DRAW} />
      <line
        x1="0"
        y1="24"
        x2="1000"
        y2="24"
        strokeWidth="1"
        pathLength={1}
        strokeDasharray="1"
        className={DRAW}
        style={{ animationDelay: "100ms" }}
      />

      {/* Side arches, drawn left to right */}
      {sideArches.map((x, i) => (
        <path
          key={x}
          d={archPath(x)}
          fill="none"
          strokeWidth="2"
          pathLength={1}
          strokeDasharray="1"
          className={DRAW}
          style={{ animationDelay: `${200 + i * 120}ms` }}
        />
      ))}

      {/* Centre shop: rises from the ground */}
      <path
        d={archPath(CENTRE_X, true)}
        className="origin-bottom fill-brand [transform-box:fill-box] motion-safe:animate-arch-rise"
        style={{ animationDelay: "850ms" }}
      />
      <path
        d="M492 46 H508 L505 62 H495 Z"
        className="fill-gold motion-safe:animate-soft-in"
        style={{ animationDelay: "1400ms" }}
      />
      <path
        d="M470 230 V182 A30 30 0 0 1 530 182 V230 Z"
        className="fill-surface motion-safe:animate-soft-in"
        style={{ animationDelay: "1400ms" }}
      />

      {/* Ground line */}
      <line
        x1="0"
        y1="231"
        x2="1000"
        y2="231"
        strokeWidth="2"
        pathLength={1}
        strokeDasharray="1"
        className={DRAW}
        style={{ animationDelay: "150ms" }}
      />
    </svg>
  );
}