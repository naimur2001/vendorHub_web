// Reading and writing the storefront URL (/shops/x?tab=reviews&reviews=trust&page=2).
// Every value from the URL is checked; anything unexpected falls back to the default.
import type { ProductSort } from "@/lib/api/catalog";

export type ShopTab = "products" | "bargains" | "reviews";
export type ReviewFilter = "all" | "trust" | "product";

export type StorefrontState = {
  tab: ShopTab;
  category?: string;
  sort: ProductSort;
  availableOnly: boolean;
  page: number;
  reviews: ReviewFilter;
};

export const SHOP_PAGE_SIZE = 24;
export const REVIEW_PAGE_SIZE = 10;
const MAX_PAGE = 500;

export const DEFAULT_STOREFRONT: StorefrontState = {
  tab: "products",
  sort: "newest",
  availableOnly: false,
  page: 1,
  reviews: "all",
};

type RawParams = Record<string, string | string[] | undefined>;

const TABS: ShopTab[] = ["products", "bargains", "reviews"];
const SORTS: ProductSort[] = ["newest", "price_asc", "price_desc"];
const REVIEWS: ReviewFilter[] = ["all", "trust", "product"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function oneOf<T extends string>(value: string | undefined, allowed: T[], fallback: T): T {
  return value && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

export function parseStorefrontParams(raw: RawParams): StorefrontState {
  const category = first(raw.category);
  const page = first(raw.page);
  const pageNumber = page && /^\d{1,3}$/.test(page) ? Number(page) : 1;

  return {
    tab: oneOf(first(raw.tab), TABS, "products"),
    category: category && category.length <= 80 && SLUG.test(category) ? category : undefined,
    sort: oneOf(first(raw.sort), SORTS, "newest"),
    availableOnly: first(raw.availableOnly) === "true",
    page: pageNumber >= 1 && pageNumber <= MAX_PAGE ? pageNumber : 1,
    reviews: oneOf(first(raw.reviews), REVIEWS, "all"),
  };
}

/**
 * Link to the storefront with some values changed (defaults are left out of the URL).
 * Changing anything goes back to page 1 unless `page` is given. `hash` jumps to a section.
 */
export function storefrontHref(
  slug: string,
  state: StorefrontState,
  changes: Partial<StorefrontState> = {},
  hash?: string,
): string {
  const next: StorefrontState = { ...state, page: 1, ...changes };
  const params = new URLSearchParams();

  if (next.tab !== "products") params.set("tab", next.tab);
  if (next.tab === "reviews") {
    if (next.reviews !== "all") params.set("reviews", next.reviews);
  } else {
    if (next.category) params.set("category", next.category);
    if (next.sort !== "newest") params.set("sort", next.sort);
    if (next.availableOnly && next.tab === "products") params.set("availableOnly", "true");
  }
  if (next.page > 1) params.set("page", String(next.page));

  const query = params.toString();
  return `/shops/${slug}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}