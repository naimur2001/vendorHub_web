import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { listProducts, type Brand, type Category, type ProductCardData } from "./catalog";
import { publicGet } from "./public";
import type { Market } from "./shops";

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