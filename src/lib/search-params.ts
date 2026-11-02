// Reading and writing the search URL (/search?q=...&category=...&page=2).
// Everything from the URL is checked here; anything unexpected is ignored, never passed on.
import type { ProductListQuery, ProductSort } from "@/lib/api/catalog";

export const PAGE_SIZE = 24;
export const MAX_PRICE = 10_000_000; // ৳1,00,00,000
const MAX_PAGE = 500;

export type SearchState = {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  marketId?: string;
  availableOnly: boolean;
  sort: ProductSort;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const SORTS: ProductSort[] = ["newest", "price_asc", "price_desc"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Trimmed text without control characters, at most `max` characters.
function cleanText(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  let out = "";
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    out += code < 32 || code === 127 ? " " : ch;
  }
  out = out.replace(/\s+/g, " ").trim().slice(0, max);
  return out || undefined;
}

function wholeNumber(value: string | undefined, min: number, max: number): number | undefined {
  if (!value || !/^\d{1,9}$/.test(value)) return undefined;
  const n = Number(value);
  return n >= min && n <= max ? n : undefined;
}

export function parseSearchParams(raw: RawParams): SearchState {
  const category = first(raw.category);
  const marketId = first(raw.marketId);
  const sort = first(raw.sort) as ProductSort | undefined;

  let minPrice = wholeNumber(first(raw.minPrice), 0, MAX_PRICE);
  let maxPrice = wholeNumber(first(raw.maxPrice), 0, MAX_PRICE);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  return {
    q: cleanText(first(raw.q), 100),
    category: category && category.length <= 80 && SLUG.test(category) ? category : undefined,
    brand: cleanText(first(raw.brand), 60),
    minPrice,
    maxPrice,
    marketId: marketId && UUID.test(marketId) ? marketId : undefined,
    availableOnly: first(raw.availableOnly) === "true",
    sort: sort && SORTS.includes(sort) ? sort : "newest",
    page: wholeNumber(first(raw.page), 1, MAX_PAGE) ?? 1,
  };
}

export function toProductQuery(state: SearchState): ProductListQuery {
  return {
    q: state.q,
    category: state.category,
    brand: state.brand,
    minPrice: state.minPrice,
    maxPrice: state.maxPrice,
    marketId: state.marketId,
    availableOnly: state.availableOnly || undefined,
    sort: state.sort,
    page: state.page,
    limit: PAGE_SIZE,
  };
}

/** How many filters are on (sort is an order, not a filter). */
export function activeFilterCount(state: SearchState): number {
  return (
    (state.availableOnly ? 1 : 0) +
    (state.minPrice !== undefined || state.maxPrice !== undefined ? 1 : 0) +
    (state.marketId ? 1 : 0) +
    (state.brand ? 1 : 0)
  );
}

/**
 * Link to the search page with some values changed. Defaults are left out of the URL.
 * Changing any filter goes back to page 1 unless `page` is given.
 */
export function searchHref(state: SearchState, changes: Partial<SearchState> = {}): string {
  const next: SearchState = { ...state, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("category", next.category);
  if (next.brand) params.set("brand", next.brand);
  if (next.minPrice !== undefined) params.set("minPrice", String(next.minPrice));
  if (next.maxPrice !== undefined) params.set("maxPrice", String(next.maxPrice));
  if (next.marketId) params.set("marketId", next.marketId);
  if (next.availableOnly) params.set("availableOnly", "true");
  if (next.sort !== "newest") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}