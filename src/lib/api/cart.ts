import "client-only";
import { api } from "./client";
import type { components } from "./schema";

type Availability = components["schemas"]["Availability"];
type VerificationLevel = components["schemas"]["VerificationLevel"];

export const MAX_QTY_PER_ITEM = 10; // same as the backend

export type CartProblem = "UNAVAILABLE" | "OUT_OF_STOCK" | "INSUFFICIENT_STOCK";

// Exact shape of cart.service.js getCart(). Prices come from the server only.
export type CartItem = {
  id: string;
  listingId: string;
  quantity: number;
  product: { id: string; slug: string; title: string; image: string | null };
  msrp: number | null;
  unitPrice: number;
  lineTotal: number;
  availability: Availability;
  bargainApplied: boolean;
  problem: CartProblem | null; // shown, but not counted in the subtotal
};

export type CartShop = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  levelFloor: string | null;
  shopNumber: string | null;
  addressLine: string;
  verificationLevel: VerificationLevel;
  supportsDelivery: boolean;
  supportsPickup: boolean;
  market: { name: string; slug: string } | null;
};

export type CartGroup = { shop: CartShop; items: CartItem[]; subtotal: number };

export type Cart = {
  shops: CartGroup[];
  totals: { itemCount: number; shopCount: number; subtotal: number; checkoutReady: boolean };
};

export const cartKeys = { cart: ["cart"] as const };

// Every call returns the full, updated cart.
export function getCart(): Promise<Cart> {
  return api.get<Cart>("/cart");
}

export function addToCart(listingId: string, quantity = 1): Promise<Cart> {
  return api.post<Cart>("/cart/items", { listingId, quantity });
}

export function updateCartItem(itemId: string, quantity: number): Promise<Cart> {
  return api.patch<Cart>(`/cart/items/${encodeURIComponent(itemId)}`, { quantity });
}

export function removeCartItem(itemId: string): Promise<Cart> {
  return api.delete<Cart>(`/cart/items/${encodeURIComponent(itemId)}`);
}

export function clearCart(): Promise<Cart> {
  return api.delete<Cart>("/cart");
}