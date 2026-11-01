import { useTranslations } from "next-intl";
import type { Availability } from "@/lib/api/catalog";
import { cn } from "@/lib/utils";

// Availability is always a word, never a stock number (spec + backend rule).
const STYLES: Record<Availability, string> = {
  IN_STOCK: "bg-success-soft text-success-ink",
  LIMITED: "bg-highlight-soft text-highlight",
  AVAILABLE: "bg-subtle text-ink-secondary",
  OUT_OF_STOCK: "bg-error-soft text-error",
};

export function AvailabilityBadge({ value, className }: { value: Availability; className?: string }) {
  const t = useTranslations("Catalog");
  return (
    <span className={cn("type-caption inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5", STYLES[value], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {t(`availability.${value}`)}
    </span>
  );
}