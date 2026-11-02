"use client";

import { CircleAlert, LoaderCircle, SlidersHorizontal, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition, type FormEvent } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link, useRouter } from "@/i18n/routing";
import type { Brand, ProductSort } from "@/lib/api/catalog";
import type { Market } from "@/lib/api/shops";
import { formatTaka } from "@/lib/format";
import { activeFilterCount, MAX_PRICE, searchHref, type SearchState } from "@/lib/search-params";
import { cn } from "@/lib/utils";

type FilterProps = { state: SearchState; markets: Market[]; brands: Brand[] };

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

// "১৫,০০০", "৳ 15,000", " 15000 " -> 15000. Only whole taka up to MAX_PRICE.
function parsePrice(input: string): { value?: number; error?: "priceInvalid" | "priceTooHigh" } {
  const cleaned = input
    .trim()
    .replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)))
    .replace(/[,\s৳]/g, "");
  if (cleaned === "") return {};
  if (!/^\d{1,9}$/.test(cleaned)) return { error: "priceInvalid" };
  const value = Number(cleaned);
  if (value > MAX_PRICE) return { error: "priceTooHigh" };
  return { value };
}

const fieldClass =
  "type-body w-full rounded-md border border-input bg-card px-3 text-ink placeholder:text-ink-muted hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none aria-invalid:border-error";

const CLEARED: Partial<SearchState> = {
  sort: "newest",
  availableOnly: false,
  minPrice: undefined,
  maxPrice: undefined,
  marketId: undefined,
  brand: undefined,
};

/** The filter form, shared by the phone sheet and the desktop column. */
function FilterForm({ state, markets, brands, onApplied }: FilterProps & { onApplied?: () => void }) {
  const t = useTranslations("Search");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const ids = { sort: useId(), stock: useId(), min: useId(), max: useId(), market: useId(), brand: useId() };

  const [sort, setSort] = useState<ProductSort>(state.sort);
  const [availableOnly, setAvailableOnly] = useState(state.availableOnly);
  const [minPrice, setMinPrice] = useState(state.minPrice?.toString() ?? "");
  const [maxPrice, setMaxPrice] = useState(state.maxPrice?.toString() ?? "");
  const [marketId, setMarketId] = useState(state.marketId ?? "");
  const [brand, setBrand] = useState(state.brand ?? "");
  const [errors, setErrors] = useState<{ min?: string; max?: string }>({});

  // Only brands that have products; keep a brand from the URL selectable even if it is not listed.
  const brandOptions = brands.filter((b) => b.productCount > 0).map((b) => b.name);
  if (state.brand && !brandOptions.some((b) => b.toLowerCase() === state.brand?.toLowerCase())) {
    brandOptions.unshift(state.brand);
  }

  function go(href: string) {
    startTransition(() => router.push(href));
    onApplied?.();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const min = parsePrice(minPrice);
    const max = parsePrice(maxPrice);

    const next: { min?: string; max?: string } = {
      min: min.error ? t(`filterErrors.${min.error}`) : undefined,
      max: max.error ? t(`filterErrors.${max.error}`) : undefined,
    };
    if (!next.min && !next.max && min.value !== undefined && max.value !== undefined && min.value > max.value) {
      next.max = t("filterErrors.priceOrder");
    }
    setErrors(next);
    if (next.min || next.max) return;

    // The server checks every value again (parseSearchParams); this only builds the link.
    go(
      searchHref(state, {
        sort,
        availableOnly,
        minPrice: min.value,
        maxPrice: max.value,
        marketId: marketId || undefined,
        brand: brand || undefined,
      }),
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.sort} className="type-body-medium text-ink">
          {t("sort")}
        </label>
        <select id={ids.sort} value={sort} onChange={(e) => setSort(e.target.value as ProductSort)} className={cn(fieldClass, "h-12")}>
          <option value="newest">{t("sortNewest")}</option>
          <option value="price_asc">{t("sortPriceAsc")}</option>
          <option value="price_desc">{t("sortPriceDesc")}</option>
        </select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="type-body-medium mb-1 text-ink">{t("availability")}</legend>
        <label htmlFor={ids.stock} className="type-body flex min-h-11 cursor-pointer items-center gap-3 text-ink">
          <input
            id={ids.stock}
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
            className="size-5 accent-brand"
          />
          {t("inStockOnly")}
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="type-body-medium mb-1 text-ink">{t("price")}</legend>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { id: ids.min, label: t("minPrice"), placeholder: t("minPlaceholder"), value: minPrice, set: setMinPrice, error: errors.min },
              { id: ids.max, label: t("maxPrice"), placeholder: t("maxPlaceholder"), value: maxPrice, set: setMaxPrice, error: errors.max },
            ] as const
          ).map((field) => (
            <div key={field.id} className="flex flex-col gap-1">
              <label htmlFor={field.id} className="sr-only">
                {field.label}
              </label>
              <input
                id={field.id}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={14}
                placeholder={field.placeholder}
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
                aria-invalid={field.error ? true : undefined}
                aria-describedby={field.error ? `${field.id}-error` : undefined}
                className={cn(fieldClass, "h-12")}
              />
              {field.error && (
                <p id={`${field.id}-error`} className="type-caption flex items-start gap-1 text-error">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {field.error}
                </p>
              )}
            </div>
          ))}
        </div>
      </fieldset>

      {markets.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.market} className="type-body-medium text-ink">
            {t("market")}
          </label>
          <select id={ids.market} value={marketId} onChange={(e) => setMarketId(e.target.value)} className={cn(fieldClass, "h-12")}>
            <option value="">{t("allMarkets")}</option>
            {markets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {brandOptions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.brand} className="type-body-medium text-ink">
            {t("brand")}
          </label>
          <select id={ids.brand} value={brand} onChange={(e) => setBrand(e.target.value)} className={cn(fieldClass, "h-12")}>
            <option value="">{t("allBrands")}</option>
            {brandOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="type-body-medium flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-action text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-80"
        >
          {isPending && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
          {isPending ? t("applying") : t("apply")}
        </button>
        <button
          type="button"
          onClick={() => go(searchHref(state, CLEARED))}
          disabled={isPending}
          className="type-body-medium h-11 rounded-sm text-brand underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          {t("reset")}
        </button>
      </div>
    </form>
  );
}

/** Desktop: the form in a column that stays in view. */
export function DesktopFilters(props: FilterProps) {
  const t = useTranslations("Search");
  return (
    <section aria-labelledby="filters-heading" className="sticky top-24 flex flex-col gap-4 rounded-md border border-line bg-card p-4">
      <h2 id="filters-heading" className="type-h3 text-ink">
        {t("filtersTitle")}
      </h2>
      {/* key: the form starts fresh from the URL after every change */}
      <FilterForm key={searchHref(props.state)} {...props} />
    </section>
  );
}

/** Phone: a Filters button that opens the form in a sheet from the bottom. */
export function MobileFilters(props: FilterProps) {
  const t = useTranslations("Search");
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(props.state);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="type-body-medium flex h-11 items-center gap-2 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
        <SlidersHorizontal className="size-4" aria-hidden />
        {count > 0 ? t("filtersWithCount", { count }) : t("filters")}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto rounded-t-lg bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <SheetHeader>
          <SheetTitle className="type-h3 text-ink">{t("filtersTitle")}</SheetTitle>
          <SheetDescription className="type-body text-ink-secondary">{t("filtersText")}</SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <FilterForm key={searchHref(props.state)} {...props} onApplied={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Removable chips for the active filters (links, so they also work without JavaScript). */
export function ActiveFilters({ state, markets }: { state: SearchState; markets: Market[] }) {
  const t = useTranslations("Search");
  const locale = useLocale();
  const chips: { key: string; label: string; href: string }[] = [];

  if (state.availableOnly) {
    chips.push({ key: "stock", label: t("chipInStock"), href: searchHref(state, { availableOnly: false }) });
  }
  if (state.minPrice !== undefined || state.maxPrice !== undefined) {
    const min = state.minPrice !== undefined ? formatTaka(state.minPrice, locale) : undefined;
    const max = state.maxPrice !== undefined ? formatTaka(state.maxPrice, locale) : undefined;
    const label = min && max ? t("chipPriceRange", { min, max }) : min ? t("chipPriceMin", { min }) : t("chipPriceMax", { max: max ?? "" });
    chips.push({ key: "price", label, href: searchHref(state, { minPrice: undefined, maxPrice: undefined }) });
  }
  if (state.marketId) {
    const name = markets.find((m) => m.id === state.marketId)?.name ?? t("market");
    chips.push({ key: "market", label: t("chipMarket", { name }), href: searchHref(state, { marketId: undefined }) });
  }
  if (state.brand) {
    chips.push({ key: "brand", label: t("chipBrand", { name: state.brand }), href: searchHref(state, { brand: undefined }) });
  }

  if (chips.length === 0) return null;

  return (
    <div role="group" aria-label={t("activeFilters")} className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          aria-label={t("removeFilter", { label: chip.label })}
          className="type-body-medium flex h-9 max-w-full items-center gap-1.5 rounded-full border border-brand bg-card pr-2.5 pl-3.5 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          <span className="truncate">{chip.label}</span>
          <X className="size-4 shrink-0" aria-hidden />
        </Link>
      ))}
      {chips.length > 1 && (
        <Link
          href={searchHref(state, { availableOnly: false, minPrice: undefined, maxPrice: undefined, marketId: undefined, brand: undefined })}
          className="type-body-medium px-2 text-ink-secondary underline-offset-4 hover:text-brand hover:underline"
        >
          {t("clearAll")}
        </Link>
      )}
    </div>
  );
}