"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle, Search } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { CategoryIcon } from "@/components/catalog/product-card";
import { parseAmount } from "@/lib/api/bargains";
import { ApiError } from "@/lib/api/core";
import {
  createListing,
  listingKeys,
  searchCatalog,
  updateListing,
  type CatalogPick,
  type ListingInput,
  type ManualAvailability,
  type OwnerListing,
} from "@/lib/api/listings";
import { safeMediaUrl } from "@/lib/api/storefront";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_PRICE = 99_999_999;
const MAX_STOCK = 100_000;
const MANUAL: ManualAvailability[] = ["AVAILABLE", "LIMITED", "OUT_OF_STOCK"];

const inputClass =
  "type-body h-12 w-full rounded-md border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none aria-invalid:border-error";
const primary =
  "type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60";

function Thumb({ src }: { src: string | null }) {
  return (
    <span className="relative flex h-14 w-12 shrink-0 items-center justify-center overflow-hidden rounded-t-full rounded-b-sm bg-highlight-soft text-highlight">
      {src ? (
        <Image src={src} alt="" fill unoptimized sizes="48px" className="object-cover" />
      ) : (
        <CategoryIcon categorySlug="" className="size-6" strokeWidth={1.25} aria-hidden />
      )}
    </span>
  );
}

/** Step 1 of "Add a product": search the public catalog and pick one. */
export function ProductPicker({ listedIds, onPick }: { listedIds: Set<string>; onPick: (product: CatalogPick) => void }) {
  const t = useTranslations("OwnerListings");
  const id = useId();
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");

  const results = useQuery({
    queryKey: listingKeys.catalog(term),
    queryFn: () => searchCatalog(term),
    enabled: term.length >= 2,
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Same cleaning as the public search: no control characters, at most 100 characters.
    setTerm(text.replace(/\p{Cc}/gu, "").trim().slice(0, 100));
  }

  return (
    <div className="flex flex-col gap-4">
      <form role="search" onSubmit={onSubmit} className="flex flex-col gap-2">
        <label htmlFor={id} className="type-body-medium text-ink">
          {t("searchLabel")}
        </label>
        <div className="flex gap-2">
          <input
            id={id}
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={100}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            className={inputClass}
          />
          <button type="submit" className="type-body-medium flex h-12 shrink-0 items-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover">
            <Search className="size-4" aria-hidden />
            {t("searchButton")}
          </button>
        </div>
        {term.length > 0 && term.length < 2 && <p className="type-caption text-ink-muted">{t("searchHint")}</p>}
      </form>

      {results.isFetching && (
        <p role="status" className="type-body flex items-center gap-2 text-ink-secondary">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          {t("searching")}
        </p>
      )}

      {results.data && results.data.length === 0 && <p className="type-body text-ink-secondary">{t("noResults")}</p>}

      {results.data && results.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.data.map((product) => {
            const listed = listedIds.has(product.id);
            return (
              <li key={product.id} className="flex items-center gap-3 rounded-md border border-line bg-card p-2">
                <Thumb src={safeMediaUrl(product.image ?? null)} />
                <div className="min-w-0 flex-1">
                  <p className="type-body-medium line-clamp-2 text-ink">{product.title}</p>
                  {product.brand && <p className="type-caption text-ink-muted">{product.brand}</p>}
                </div>
                {listed ? (
                  <span className="type-caption shrink-0 text-ink-muted">{t("alreadyListed")}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onPick(product)}
                    className="type-body-medium flex h-10 shrink-0 items-center rounded-sm border border-brand px-3 text-brand hover:bg-subtle"
                  >
                    {t("choose")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type FormProps = {
  shopId: string;
  product: { id: string; title: string; msrp?: number | null; image?: string | null };
  listing?: OwnerListing; // present = edit, missing = create
  onSaved: (listing: OwnerListing) => void;
  onCancel: () => void;
};

/** Price, stock and offers for a new or existing listing. */
export function ListingForm({ shopId, product, listing, onSaved, onCancel }: FormProps) {
  const t = useTranslations("OwnerListings");
  const locale = useLocale();
  const id = useId();

  const [price, setPrice] = useState(listing ? String(listing.price) : "");
  const [track, setTrack] = useState(listing ? listing.stockQty !== null : true);
  const [stock, setStock] = useState(listing?.stockQty !== null && listing?.stockQty !== undefined ? String(listing.stockQty) : "");
  const [manual, setManual] = useState<ManualAvailability>(
    listing && listing.stockQty === null && listing.availability !== "IN_STOCK" ? (listing.availability as ManualAvailability) : "AVAILABLE",
  );
  const [offers, setOffers] = useState(listing?.bargainEnabled ?? false);
  const [minOffer, setMinOffer] = useState(String(listing?.minOfferPercent ?? 92));
  const [errors, setErrors] = useState<Partial<Record<"price" | "stock" | "minOffer" | "form", string>>>({});

  const save = useMutation({
    mutationFn: (input: ListingInput) => (listing ? updateListing(shopId, listing.id, input) : createListing(shopId, product.id, input)),
    onSuccess: onSaved,
    onError: (err) => {
      let key = "errors.generic";
      if (err instanceof ApiError) {
        if (err.status === 409) key = "errors.duplicate";
        else if (err.status === 404) key = "errors.gone";
        else if (err.status === 400) key = "errors.invalid";
        else if (err.status === 0) key = "errors.network";
      }
      setErrors({ form: t(key) });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    const priceValue = parseAmount(price);
    if (priceValue === null || priceValue < 1 || priceValue > MAX_PRICE) next.price = t("errors.price");
    const stockValue = parseAmount(stock);
    if (track && (stockValue === null || stockValue > MAX_STOCK)) next.stock = t("errors.stock");
    const minValue = parseAmount(minOffer);
    if (offers && (minValue === null || minValue < 50 || minValue > 100)) next.minOffer = t("errors.minOffer");
    setErrors(next);
    if (Object.keys(next).length > 0 || priceValue === null) return;

    save.mutate({
      price: priceValue,
      stockQty: track ? (stockValue ?? 0) : null,
      ...(!track && { availability: manual }),
      bargainEnabled: offers,
      minOfferPercent: offers ? (minValue ?? 92) : (listing?.minOfferPercent ?? 92),
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-md border border-line bg-surface p-2">
        <Thumb src={safeMediaUrl(product.image ?? null)} />
        <p className="type-body-medium line-clamp-2 text-ink">{product.title}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-price`} className="type-body-medium text-ink">
          {t("form.price")}
        </label>
        <input
          id={`${id}-price`}
          type="text"
          inputMode="numeric"
          maxLength={12}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          aria-invalid={errors.price ? true : undefined}
          className={cn(inputClass, "type-price text-[1.25rem]")}
        />
        {product.msrp ? <p className="type-caption text-ink-muted">{t("form.msrp", { amount: formatTaka(product.msrp, locale) })}</p> : null}
        {errors.price && <p className="type-caption text-error">{errors.price}</p>}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="type-body-medium mb-1 text-ink">{t("form.stockMode")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[true, false].map((value) => (
            <label
              key={String(value)}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand",
                track === value ? "border-brand bg-highlight-soft/40" : "border-line-strong bg-card hover:border-brand",
              )}
            >
              <input type="radio" name={`${id}-track`} checked={track === value} onChange={() => setTrack(value)} className="mt-1 size-4 accent-brand" />
              <span className="flex flex-col">
                <span className="type-body-medium text-ink">{value ? t("form.track") : t("form.untracked")}</span>
                <span className="type-caption text-ink-muted">{value ? t("form.trackHint") : t("form.untrackedHint")}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {track ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-stock`} className="type-body-medium text-ink">
            {t("form.stockQty")}
          </label>
          <input
            id={`${id}-stock`}
            type="text"
            inputMode="numeric"
            maxLength={7}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            aria-invalid={errors.stock ? true : undefined}
            className={inputClass}
          />
          {errors.stock && <p className="type-caption text-error">{errors.stock}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-availability`} className="type-body-medium text-ink">
            {t("form.availability")}
          </label>
          <select
            id={`${id}-availability`}
            value={manual}
            onChange={(e) => setManual(e.target.value as ManualAvailability)}
            className={inputClass}
          >
            {MANUAL.map((a) => (
              <option key={a} value={a}>
                {t(`availability.${a}`)}
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-line-strong p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand">
        <input type="checkbox" checked={offers} onChange={(e) => setOffers(e.target.checked)} className="size-5 accent-brand" />
        <span className="type-body-medium text-ink">🤝 {t("form.offers")}</span>
      </label>

      {offers && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-min`} className="type-body-medium text-ink">
            {t("form.minOffer")}
          </label>
          <input
            id={`${id}-min`}
            type="text"
            inputMode="numeric"
            maxLength={3}
            value={minOffer}
            onChange={(e) => setMinOffer(e.target.value)}
            aria-describedby={`${id}-min-hint`}
            aria-invalid={errors.minOffer ? true : undefined}
            className={cn(inputClass, "w-28")}
          />
          <p id={`${id}-min-hint`} className="type-caption text-ink-muted">
            {t("form.minOfferHint")}
          </p>
          {errors.minOffer && <p className="type-caption text-error">{errors.minOffer}</p>}
        </div>
      )}

      {errors.form && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {errors.form}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={save.isPending}
          className="type-body-medium flex h-12 items-center justify-center rounded-sm border border-ink px-4 text-ink hover:bg-subtle"
        >
          {t("form.cancel")}
        </button>
        <button type="submit" disabled={save.isPending} aria-busy={save.isPending} className={primary}>
          {save.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {save.isPending ? t("form.saving") : listing ? t("form.save") : t("form.create")}
        </button>
      </div>
    </form>
  );
}