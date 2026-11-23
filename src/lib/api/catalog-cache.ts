import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { listProducts, type Brand, type Category, type ProductCardData } from "./catalog";
import { publicGet } from "./public";
import type { Market } from "./shops";
import type { components } from "./schema";

// Lists that rarely change: cached 10 minutes, served stale up to 5 minutes while refreshing.
const SLOW_CHANGING = { stale: 300, revalidate: 600, expire: 3600 };

/**
 * Home page "New in Dhaka's shops": the same 8 products for everyone, so it is cached.
 * The API is asked at most about once a minute, however many people open the home page.
 * Errors are not cached (the next visit tries again).
 */
export async function getLatestProducts(): Promise<ProductCardData[]> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 600 }); // seconds
  cacheTag("products");

  const { data } = await listProducts({ sort: "newest", availableOnly: true, limit: 8 }, { fresh: false });
  return data;
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife(SLOW_CHANGING);
  cacheTag("catalog");
  return (await publicGet<Category[]>("/categories", undefined, { fresh: false })).data;
}

export async function getBrands(): Promise<Brand[]> {
  "use cache";
  cacheLife(SLOW_CHANGING);
  cacheTag("catalog");
  return (await publicGet<Brand[]>("/brands", undefined, { fresh: false })).data;
}

export async function getMarkets(): Promise<Market[]> {
  "use cache";
  cacheLife(SLOW_CHANGING);
  cacheTag("markets");
  return (await publicGet<Market[]>("/markets", undefined, { fresh: false })).data;
}
export type HomeBanner = components["schemas"]["Banner"];

/**
 * Home page billboard: the live banners (the backend applies the schedule).
 * Cached 1 minute so a scheduled banner appears or ends within about a minute;
 * an admin change refreshes it at once through the "banners" tag.
 */
export async function getBanners(): Promise<HomeBanner[]> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 600 });
  cacheTag("banners");
  return (await publicGet<HomeBanner[]>("/banners", undefined, { fresh: false })).data;
}

/** Home page side advertisement(s): live SIDE_AD banners (the page shows the first). Same cache rules as the slider. */
export async function getSideAds(): Promise<HomeBanner[]> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 600 });
  cacheTag("banners");
  return (await publicGet<HomeBanner[]>("/banners", { placement: "SIDE_AD" }, { fresh: false })).data;
}

export type PublicDeal = components["schemas"]["PublicDeal"];

/**
 * Home page "Flash deals" row: active deals, ending soonest first (prices from the server).
 * Cached 30 seconds, like the API's own Cache-Control, so an ended deal leaves the row quickly.
 */
export async function getDeals(): Promise<PublicDeal[]> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 300 });
  cacheTag("deals");
  return (await publicGet<PublicDeal[]>("/deals", { limit: 12 }, { fresh: false })).data;
}

export type ShelfKey = "trending" | "popular" | "bestPrice" | "bargain" | "premium" | "classics";
// Tab order on the home page
export const SHELF_KEYS: ShelfKey[] = ["trending", "popular", "bestPrice", "bargain", "premium", "classics"];
const SHELVES: Record<ShelfKey, Parameters<typeof listProducts>[0]> = {
  trending: { sort: "trending", availableOnly: true, limit: 8 }, // last 7 days
  popular: { sort: "popular", availableOnly: true, limit: 8 }, // all time
  bestPrice: { sort: "price_asc", availableOnly: true, limit: 8 },
  bargain: { sort: "trending", bargain: true, availableOnly: true, limit: 8 },
  premium: { sort: "price_desc", availableOnly: true, limit: 8 },
  classics: { sort: "oldest", availableOnly: true, limit: 8 }, // the longest on the site
};

/** Home page "Explore the shelves" tabs: 8 products each, cached like the latest products. */
export async function getShelf(key: ShelfKey): Promise<ProductCardData[]> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 600 });
  cacheTag("products");
  const { data } = await listProducts(SHELVES[key], { fresh: false });
  return data;
}
