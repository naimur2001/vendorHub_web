"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type KeyboardEvent } from "react";
import { searchCatalog } from "@/lib/api/listings";
import { safeMediaUrl } from "@/lib/api/storefront";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "/products/<slug>" for a valid slug, else null. */
export function productPath(slug: string): string | null {
  return SLUG.test(slug) ? `/products/${slug}` : null;
}

/** The slug inside a "/products/<slug>" link, or null for any other link. */
export function productSlugOf(link: string): string | null {
  const match = /^\/products\/([a-z0-9-]+)$/.exec(link);
  return match && SLUG.test(match[1]) ? match[1] : null;
}

const field =
  "type-body h-11 w-full rounded-sm border border-line-strong bg-card px-3 text-ink placeholder:text-ink-muted focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none";

/**
 * Search the catalog and pick the product a gallery picture opens.
 * Lives inside the banner form, so it uses no <form> of its own (Enter searches).
 */
export function ProductLinkPicker({ value, onChange }: { value: string; onChange: (link: string) => void }) {
  const t = useTranslations("AdminBanners");
  const id = useId();
  const [term, setTerm] = useState("");
  const [searched, setSearched] = useState("");
  // Title of the product picked in this session (an existing link only knows its slug).
  const [pickedTitle, setPickedTitle] = useState<string | null>(null);
  const slug = productSlugOf(value);

  const results = useQuery({
    queryKey: ["admin", "gallery-product-search", searched],
    enabled: searched.length >= 2,
    queryFn: () => searchCatalog(searched),
  });

  const search = () => setSearched(term.trim().slice(0, 100));
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); // don't submit the banner form
      search();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${id}-q`} className="type-body-medium text-ink">
        {t("product")}
      </label>

      {slug && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand bg-subtle p-3">
          <span className="flex min-w-0 items-center gap-2">
            <Check className="size-4 shrink-0 text-brand" aria-hidden />
            <span className="flex min-w-0 flex-col">
              <span className="type-body-medium truncate text-ink">{pickedTitle ?? slug}</span>
              <span className="type-caption truncate text-ink-muted">{value}</span>
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setPickedTitle(null);
            }}
            aria-label={t("productRemove")}
            className="flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-secondary hover:bg-card focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          id={`${id}-q`}
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={onKey}
          maxLength={100}
          placeholder={t(slug ? "productChange" : "productSearch")}
          className={field}
        />
        <button
          type="button"
          onClick={search}
          aria-label={t("productSearchButton")}
          className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-action text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Search className="size-4" aria-hidden />
        </button>
      </div>
      <p className="type-caption text-ink-muted">{t("productHint")}</p>

      {searched.length >= 2 &&
        (results.isPending ? (
          <div className="h-24 skeleton rounded-md" aria-hidden />
        ) : results.isError ? (
          <p role="alert" className="type-body text-ink-secondary">
            {t("productLoadError")}
          </p>
        ) : results.data.length === 0 ? (
          <p className="type-body text-ink-secondary">{t("productNone")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {results.data.flatMap((p) => {
              const path = productPath(p.slug);
              if (!path) return [];
              const image = safeMediaUrl(p.image);
              const chosen = path === value;
              return [
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(path);
                      setPickedTitle(p.title);
                      setSearched("");
                      setTerm("");
                    }}
                    aria-pressed={chosen}
                    className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none focus-visible:ring-inset"
                  >
                    <span className="size-10 shrink-0 overflow-hidden rounded-sm bg-subtle">
                      {/* eslint-disable-next-line @next/next/no-img-element -- media server thumbnail */}
                      {image && <img src={image} alt="" className="size-full object-cover" loading="lazy" />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="type-body-medium truncate text-ink">{p.title}</span>
                      {p.brand && <span className="type-caption truncate text-ink-muted">{p.brand}</span>}
                    </span>
                    {chosen && <Check className="size-4 shrink-0 text-brand" aria-hidden />}
                  </button>
                </li>,
              ];
            })}
          </ul>
        ))}
    </div>
  );
}
