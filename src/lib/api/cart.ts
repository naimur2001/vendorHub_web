import "client-only";
import { api } from "./client";
import type { components } from "./schema";

type Availability = components["schemas"]["Availability"];
type VerificationLevel = components["schemas"]["VerificationLevel"];

export const MAX_QTY_PER_ITEM = 10; // same as the backend

export type CartProblem = "UNAVAILABLE" | "OUT_OF_STOCK" | "INSUFFICIENT_STOCK" | "OPTION_UNAVAILABLE";

// Exact shape of cart.service.js getCart(). Prices come from the server only.
export type CartItem = {
  id: string;
  listingId: string;
  quantity: number;
  options?: Record<string, string>; // the chosen variation, e.g. { Size: "M" } ({} = none)
  product: { id: string; slug: string; title: string; image: string | null };
  msrp: number | null;
  unitPrice: number;
  lineTotal: number;
  availability: Availability;
  bargainApplied: boolean;
  deal?: components["schemas"]["ListingDeal"]; // a live flash deal lowered unitPrice
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
  deliveryAvailable: boolean; // false: delivery is not offered right now (courier store not ready)
  courierDelivery: boolean; // Vendors Hub courier: the fee depends on the address's zone
  market: { name: string; slug: string } | null;
};

// deliveryFee: this shop's delivery fee from the server; null when not available, or for a courier shop until an address is chosen
export type CartGroup = { shop: CartShop; items: CartItem[]; subtotal: number; deliveryFee: number | null };
export type DeliveryQuote = components["schemas"]["DeliveryQuote"];

export type Cart = {
  shops: CartGroup[];
  totals: { itemCount: number; shopCount: number; subtotal: number; checkoutReady: boolean };
  deliveryAddressId?: string | null; // the addressId sent, or null
  deliveryQuote?: DeliveryQuote | null; // the courier fee to that address (admin zone fee)
};

export const cartKeys = { cart: ["cart"] as const, quoted: (addressId: string | null) => ["cart", "quoted", addressId ?? "none"] as const };

// Every call returns the full, updated cart.
export function getCart(): Promise<Cart> {
  return api.get<Cart>("/cart");
}

// The same cart with each shop's delivery fee to a saved address of the customer (filled in by the server).
export function getCartFor(addressId: string): Promise<Cart> {
  return api.get<Cart>("/cart", { query: { addressId } });
}

// options: the chosen size / colour when the listing has variations (the server checks them).
export function addToCart(listingId: string, quantity = 1, options?: Record<string, string>): Promise<Cart> {
  return api.post<Cart>("/cart/items", { listingId, quantity, ...(options && Object.keys(options).length > 0 && { options }) });
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