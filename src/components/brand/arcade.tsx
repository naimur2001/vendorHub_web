import { cn } from "@/lib/utils";

const ARCH_X = [45, 235, 425, 615, 805];
const CENTRE_X = 425;

function archPath(x: number, closed = false): string {
  return `M${x} 230 V128 A75 75 0 0 1 ${x + 150} 128 V230${closed ? " Z" : ""}`;
}

/**
 * The shopping arcade: five arches under a cornice. The red centre arch is the shop you walk into.
 * Static drawing (no animation, by decision).
 */
export function Arcade({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1000 232" className={cn("w-full", className)} aria-hidden="true">
      {/* Cornice */}
      <line x1="0" y1="14" x2="1000" y2="14" strokeWidth="2" className="stroke-gold" />
      <line x1="0" y1="24" x2="1000" y2="24" strokeWidth="1" className="stroke-gold" />

      {ARCH_X.map((x) =>
        x === CENTRE_X ? (
          <path key={x} d={archPath(x, true)} className="fill-brand" />
        ) : (
          <path key={x} d={archPath(x)} fill="none" strokeWidth="2" className="stroke-gold" />
        ),
      )}

      {/* Keystone and doorway of the centre shop */}
      <path d="M492 46 H508 L505 62 H495 Z" className="fill-gold" />
      <path d="M470 230 V182 A30 30 0 0 1 530 182 V230 Z" className="fill-surface" />

      {/* Ground line */}
      <line x1="0" y1="231" x2="1000" y2="231" strokeWidth="2" className="stroke-gold" />
    </svg>
  );
}