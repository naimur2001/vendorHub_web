import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { listProducts, type ProductCardData } from "./catalog";

/**
 * Home page "New in Dhaka's shops": the same 8 products for everyone, so it is cached.
 * The API is asked at most about once a minute, however many people open the home page.
 * Errors are not cached (the next visit tries again).
 */
export async function getLatestProducts(): Promise<ProductCardData[]> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 600 }); // seconds
  cacheTag("products"); // lets an admin action clear it later

  const { data } = await listProducts({ sort: "newest", availableOnly: true, limit: 8 }, { fresh: false });
  return data;
}