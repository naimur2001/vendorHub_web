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

export type WishlistIds = { listingIds: string[]; productIds: string[] };

// Which hearts are filled: shop offers by listing id, product cards by product id.
export async function getWishlistIds(): Promise<WishlistIds> {
  const data = await api.get<Partial<WishlistIds>>("/wishlist/ids");
  return { listingIds: data.listingIds ?? [], productIds: data.productIds ?? [] };
}

export function addToWishlist(listingId: string): Promise<unknown> {
  return api.post<unknown>("/wishlist", { listingId });
}

// Removes every saved offer of this product (from a product card).
export function removeProductFromWishlist(productId: string): Promise<unknown> {
  return api.delete<unknown>(`/wishlist/product/${encodeURIComponent(productId)}`);
}

export function removeFromWishlist(listingId: string): Promise<unknown> {
  return api.delete<unknown>(`/wishlist/${encodeURIComponent(listingId)}`);
}
