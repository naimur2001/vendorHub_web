import "client-only";
import { api } from "./client";
import type { ApiResult } from "./core";
import type { components } from "./schema";

export type WishlistItem = components["schemas"]["WishlistItem"];

export const wishlistKeys = {
  ids: ["wishlist", "ids"] as const,
  list: (page: number) => ["wishlist", "list", page] as const,
};

// The logged-in customer's saved listings (the user always comes from the token).
export function listWishlist(query: { page: number; limit: number }): Promise<ApiResult<WishlistItem[]>> {
  return api.list<WishlistItem>("/wishlist", { query });
}

// Only the listing ids: which hearts are filled.
export async function getWishlistIds(): Promise<string[]> {
  return (await api.get<{ listingIds: string[] }>("/wishlist/ids")).listingIds;
}

export function addToWishlist(listingId: string): Promise<unknown> {
  return api.post<unknown>("/wishlist", { listingId });
}

export function removeFromWishlist(listingId: string): Promise<unknown> {
  return api.delete<unknown>(`/wishlist/${encodeURIComponent(listingId)}`);
}
