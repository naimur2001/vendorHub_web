import "client-only";
import { publicGet } from "./public";
import type { components } from "./schema";

export type NearShop = components["schemas"]["ShopSearchItem"] & { distanceKm: number };

export const NEAR_RADII = [2, 5, 10] as const;
export type NearRadius = (typeof NEAR_RADII)[number];

// Coordinates go only to our API for this request; they are never stored in the browser.
export async function getNearShops(lat: number, lng: number, radiusKm: NearRadius): Promise<NearShop[]> {
  const round = (n: number) => Math.round(n * 1e4) / 1e4; // ~11 m is plenty for "near me"
  return (await publicGet<NearShop[]>("/shops/near", { lat: round(lat), lng: round(lng), radiusKm, limit: 12 })).data;
}
