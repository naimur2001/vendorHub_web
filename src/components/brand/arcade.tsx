import { cn } from "@/lib/utils";

const SIDE_ARCH_X = [45, 235, 615, 805];
const CENTRE_X = 425;

function archPath(x: number, closed = false): string {
  return `M${x} 230 V128 A75 75 0 0 1 ${x + 150} 128 V230${closed ? " Z" : ""}`;
}

/**
 * The shopping arcade: five arches under a cornice. The red centre arch is the shop you walk into.
 * Static by default. With `animated` (home hero only) the arches grow up from the ground one after
 * another, the centre arch last with one soft gold glow, and the ground line draws across
 * (CSS: .arcade-live in globals.css; off with "reduce motion").
 */
export function Arcade({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 1000 232" className={cn("w-full", animated && "arcade-live", className)} aria-hidden="true">
      {/* Cornice */}
      <line x1="0" y1="14" x2="1000" y2="14" strokeWidth="2" className="stroke-gold" />
      <line x1="0" y1="24" x2="1000" y2="24" strokeWidth="1" className="stroke-gold" />

      {/* Side arches (their own group, so CSS can stagger them by position) */}
      <g>
        {SIDE_ARCH_X.map((x) => (
          <path key={x} d={archPath(x)} fill="none" strokeWidth="2" className="arcade-arch stroke-gold" />
        ))}
      </g>

      {/* One-time glow around the centre arch (invisible unless animated) */}
      {animated && (
        <path d={archPath(CENTRE_X)} fill="none" strokeWidth="10" strokeLinejoin="round" className="arcade-glow stroke-gold opacity-0" />
      )}

      {/* Centre shop: red arch, keystone and doorway rise together */}
      <g className="arcade-centre">
        <path d={archPath(CENTRE_X, true)} className="fill-brand" />
        <path d="M492 46 H508 L505 62 H495 Z" className="fill-gold" />
        <path d="M470 230 V182 A30 30 0 0 1 530 182 V230 Z" className="fill-surface" />
      </g>

      {/* Ground line */}
      <line x1="0" y1="231" x2="1000" y2="231" strokeWidth="2" className="arcade-ground stroke-gold" />
    </svg>
  );
}
