import "client-only";
import type { Cart } from "./cart";
import { api } from "./client";
import type { ApiResult } from "./core";
import type { components } from "./schema";

type Availability = components["schemas"]["Availability"];
export type BargainStatus = components["schemas"]["BargainStatus"];

export const MAX_OFFERS = 6; // same as the backend

export type BargainEvent = {
  id: string;
  actor: "CUSTOMER" | "SHOP" | "SYSTEM";
  amount: number | null;
  note: string | null;
  createdAt: string;
};

// Exact shape of format() in bargains.service.js (customer view; list items have no events)
export type Bargain = {
  id: string;
  status: BargainStatus;
  listPrice: number;
  currentOffer: number;
  agreedPrice: number | null;
  expiresAt: string;
  secondsLeft: number;
  createdAt: string;
  yourTurn: boolean;
  product: { id: string; slug: string; title: string; image: string | null };
  shop: { id: string; name: string; slug: string };
  listing: { id: string; price: number; availability: Availability };
  events?: BargainEvent[];
};

// GET /listings/:listingId/bargain-info (the shop's private minimum is never included)
export type BargainInfo = {
  listingId: string;
  bargainEnabled: boolean;
  listPrice: number;
  minOffer: number;
  maxOffer: number;
  responseWindowMinutes: number;
  activeBargain: { id: string; status: BargainStatus } | null;
};

export const bargainKeys = {
  info: (listingId: string) => ["bargain-info", listingId] as const,
  bargain: (id: string) => ["bargain", id] as const,
  mine: (status: BargainStatus | undefined, page: number) => ["bargains", status ?? "ALL", page] as const,
};

const path = (id: string) => `/bargains/${encodeURIComponent(id)}`;

export function getBargainInfo(listingId: string): Promise<BargainInfo> {
  return api.get<BargainInfo>(`/listings/${encodeURIComponent(listingId)}/bargain-info`);
}

// Only the listing and the amount are sent.
export function createBargain(listingId: string, offer: number): Promise<Bargain> {
  return api.post<Bargain>("/bargains", { listingId, offer });
}

export function getBargain(id: string): Promise<Bargain> {
  return api.get<Bargain>(path(id));
}

export function acceptBargain(id: string): Promise<Bargain> {
  return api.post<Bargain>(`${path(id)}/accept`);
}

export function counterBargain(id: string, amount: number): Promise<Bargain> {
  return api.post<Bargain>(`${path(id)}/counter`, { amount });
}

export function declineBargain(id: string): Promise<Bargain> {
  return api.post<Bargain>(`${path(id)}/decline`);
}

// One unit at the agreed price; returns the updated cart.
export function bargainToCart(id: string): Promise<Cart> {
  return api.post<Cart>(`${path(id)}/add-to-cart`);
}

export function listMyBargains(query: { status?: BargainStatus; page: number; limit: number }): Promise<ApiResult<Bargain[]>> {
  return api.list<Bargain>("/bargains", { query });
}

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** "৩৪,০০০", "৳ 34,000", "34000" -> 34000; anything else -> null (whole taka only). */
export function parseAmount(text: string): number | null {
  const cleaned = text
    .trim()
    .replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)))
    .replace(/[,\s৳]/g, "");
  return /^\d{1,9}$/.test(cleaned) ? Number(cleaned) : null;
}