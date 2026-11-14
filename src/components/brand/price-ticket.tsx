import { useLocale, useTranslations } from "next-intl";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  amount: number; // whole taka
  msrp?: number | null; // regular price; shown struck through only when higher than amount
  size?: "sm" | "lg"; // sm: cards and lists, lg: product page
  on?: "page" | "card"; // surface under the ticket, so the notch matches it
  className?: string;
};

/** Price on a notched paper ticket, like the price tags in old European shops. */
export function PriceTicket({ amount, msrp, size = "sm", on = "card", className }: Props) {
  const t = useTranslations("Price");
  const locale = useLocale();
  const regular = typeof msrp === "number" && msrp > amount ? msrp : null;

  return (
    <div
      className={cn(
        "relative inline-flex items-baseline gap-2 border border-line bg-card py-1.5 pr-3 pl-4",
        // The notch: a half circle cut into the left edge, filled with the surface colour below.
        "before:absolute before:top-1/2 before:-left-[6px] before:size-[11px] before:-translate-y-1/2 before:rounded-full before:border-r before:border-line before:content-['']",
        on === "page" ? "before:bg-background" : "before:bg-card",
        size === "lg" && "py-2 pr-4 pl-5",
        className,
      )}
    >
      {/* Light streak that passes once when the card (a "group") is hovered */}
      <span aria-hidden className="shine" />
      <span className="sr-only">{t("price")}</span>
      <span
        className={cn(
          "text-ink",
          size === "lg"
            ? "font-heading text-[1.75rem] leading-none font-medium [font-variant-numeric:lining-nums]"
            : "type-price text-[0.9375rem]",
        )}
      >
        {formatTaka(amount, locale)}
      </span>
      {regular !== null && (
        <del className="type-caption text-ink-muted">
          <span className="sr-only">{t("regularPrice")} </span>
          {formatTaka(regular, locale)}
        </del>
      )}
    </div>
  );
}