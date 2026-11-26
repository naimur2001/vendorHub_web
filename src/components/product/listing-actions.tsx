"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { MakeOfferButton } from "@/components/bargain/offer-sheet";
import { AddToCartButton } from "@/components/cart/add-to-cart";
import type { ChosenOptions, ListingOptionGroup } from "@/lib/api/catalog";
import { cn } from "@/lib/utils";

type Props = {
  listingId: string;
  productSlug: string;
  options: ListingOptionGroup[];
  bargainEnabled: boolean;
  outOfStock: boolean;
  image: string | null;
};

// A group with a single value that can be bought needs no choice: it starts selected.
function startChoice(groups: ListingOptionGroup[]): ChosenOptions {
  const chosen: ChosenOptions = {};
  for (const g of groups) {
    const available = g.values.filter((v) => v.inStock !== false);
    if (available.length === 1) chosen[g.name] = available[0].value;
  }
  return chosen;
}

/**
 * The shop's variations (size, colour...) as chips, then Buy now, Add to cart and Make an offer.
 * Buy now and Add to cart wait until every group has a value; sold-out values are crossed out.
 * The server checks the choice again (and the price is always the server's).
 */
export function ListingActions({ listingId, productSlug, options, bargainEnabled, outOfStock, image }: Props) {
  const t = useTranslations("Product");
  const groups = options.filter((g) => g.values.length > 0);
  const [chosen, setChosen] = useState<ChosenOptions>(() => startChoice(groups));
  const missing = groups.filter((g) => !chosen[g.name]).map((g) => g.name);
  const needsChoice = missing.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <fieldset key={group.name} className="flex flex-col gap-2">
          <legend className="type-body-medium mb-2 text-ink">
            {group.name}
            {chosen[group.name] && <span className="font-normal text-ink-secondary">: {chosen[group.name]}</span>}
          </legend>
          <div role="radiogroup" aria-label={group.name} className="flex flex-wrap gap-2">
            {group.values.map((v) => {
              const soldOut = v.inStock === false;
              const selected = chosen[group.name] === v.value;
              return (
                <button
                  key={v.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={soldOut || outOfStock}
                  aria-label={soldOut ? t("optionSoldOut", { value: v.value }) : v.value}
                  onClick={() => setChosen((c) => ({ ...c, [group.name]: v.value }))}
                  className={cn(
                    "type-body-medium relative inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border px-4 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none",
                    selected
                      ? "border-brand bg-brand text-primary-foreground shadow-card"
                      : "border-line-strong bg-card text-ink hover:border-brand",
                    soldOut && "cursor-not-allowed border-dashed text-ink-disabled line-through hover:border-line-strong",
                  )}
                >
                  {selected && <Check className="size-4" aria-hidden />}
                  {v.value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        {needsChoice && !outOfStock && (
          <p className="type-caption text-highlight" aria-live="polite">
            {t("chooseFirst", { groups: missing.join(", ") })}
          </p>
        )}
        {/* Buy now is the main action; Add to cart and Make an offer sit under it */}
        <AddToCartButton listingId={listingId} productSlug={productSlug} disabled={outOfStock} image={image} buyNow options={chosen} needsChoice={needsChoice} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <AddToCartButton listingId={listingId} productSlug={productSlug} disabled={outOfStock} image={image} outline options={chosen} needsChoice={needsChoice} />
          </div>
          {bargainEnabled && !outOfStock && (
            <div className="flex-1">
              <MakeOfferButton listingId={listingId} productSlug={productSlug} />
            </div>
          )}
        </div>
        {outOfStock && <p className="type-caption text-ink-muted">{t("outOfStock")}</p>}
      </div>
    </div>
  );
}
