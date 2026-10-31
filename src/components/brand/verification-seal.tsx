import { useTranslations } from "next-intl";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/utils";

// Exact union from the backend's OpenAPI file: UNVERIFIED ... TRUSTED_VENDOR
export type VerificationLevel = components["schemas"]["VerificationLevel"];

type SealLevel = Exclude<VerificationLevel, "UNVERIFIED">;

// Each level has its own wax color; the gold ring and the check carry the "certified" feel.
const STYLES: Record<SealLevel, { body: string; ring: string; mark: string }> = {
  DOCUMENTS_VERIFIED: { body: "fill-ink-disabled", ring: "stroke-surface", mark: "stroke-surface" },
  BUSINESS_VERIFIED: { body: "fill-verified", ring: "stroke-gold", mark: "stroke-surface" },
  PHYSICAL_SHOP_VERIFIED: { body: "fill-brand", ring: "stroke-gold", mark: "stroke-surface" },
  TRUSTED_VENDOR: { body: "fill-gold stroke-highlight", ring: "stroke-brand", mark: "stroke-brand" },
};

const SIZES = { sm: 20, md: 32, lg: 46 } as const;

// Scalloped wax-seal outline: 32 points alternating between two radii around the centre (23, 23).
const SEAL_PATH = (() => {
  const points: string[] = [];
  const count = 32;
  for (let i = 0; i < count; i++) {
    const radius = i % 2 === 0 ? 22 : 19.5;
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    points.push(`${(23 + radius * Math.cos(angle)).toFixed(2)} ${(23 + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join(" L")} Z`;
})();

type Props = {
  level: VerificationLevel;
  size?: keyof typeof SIZES;
  withLabel?: boolean; // show the level name next to the seal
  className?: string;
};

/** Wax seal for a shop's verification level. Unverified shops get no seal. */
export function VerificationSeal({ level, size = "md", withLabel = false, className }: Props) {
  const t = useTranslations("Verification");
  if (level === "UNVERIFIED") return null;

  const style = STYLES[level];
  const px = SIZES[size];
  const label = t(level);

  const seal = (
    <svg
      viewBox="0 0 46 46"
      width={px}
      height={px}
      role="img"
      aria-label={label}
      className={cn("shrink-0", !withLabel && className)}
    >
      <title>{label}</title>
      <path d={SEAL_PATH} strokeWidth="0.75" className={style.body} />
      <circle cx="23" cy="23" r="13" fill="none" strokeWidth="1.5" className={style.ring} />
      <path
        d="M17 23.5 l4 4 8-8.5"
        fill="none"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={style.mark}
      />
    </svg>
  );

  if (!withLabel) return seal;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {seal}
      <span className="type-caption text-ink-secondary" aria-hidden>
        {label}
      </span>
    </span>
  );
}