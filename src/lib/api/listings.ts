import "client-only";
import { api } from "./client";
import { publicGet } from "./public";
import type { components } from "./schema";

type Availability = components["schemas"]["Availability"];

/** Availability the shop may set by hand when it doesn't count stock. */
export type ManualAvailability = "AVAILABLE" | "LIMITED" | "OUT_OF_STOCK";

// The shop team's view of a listing (includes the private fields stockQty, minOfferPercent, isActive).
export type OwnerListing = {
  id: string;
  shopId: string;
  productId: string;
  price: number;
  availability: Availability;
  stockQty: number | null;
  bargainEnabled: boolean;
  minOfferPercent: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  product: { id: string; slug: string; title: string; msrp: number | null; images: string[] };
};

/** A product from the public catalog search, for "Add a product". */
export type CatalogPick = {
  id: string;
  slug: string;
  title: string;
  brand?: string | null;
  image?: string | null;
  msrp?: number | null;
};

export type ListingInput = {
  price: number;
  stockQty: number | null;
  availability?: ManualAvailability; // only when stock is not counted
  bargainEnabled: boolean;
  minOfferPercent: number;
};

export const listingKeys = {
  mine: (shopId: string) => ["owner", "listings", shopId] as const,
  catalog: (term: string) => ["owner", "catalog-search", term] as const,
};

const base = (shopId: string) => `/shops/${encodeURIComponent(shopId)}/listings`;

export function listOwnerListings(shopId: string): Promise<OwnerListing[]> {
  return api.get<OwnerListing[]>(base(shopId));
}

export function createListing(shopId: string, productId: string, input: ListingInput): Promise<OwnerListing> {
  return api.post<OwnerListing>(base(shopId), { productId, ...input });
}

export function updateListing(
  shopId: string,
  listingId: string,
  patch: Partial<ListingInput> & { isActive?: boolean },
): Promise<OwnerListing> {
  return api.patch<OwnerListing>(`${base(shopId)}/${encodeURIComponent(listingId)}`, patch);
}

// Public catalog search (the same one customers use).
export async function searchCatalog(term: string): Promise<CatalogPick[]> {
  return (await publicGet<CatalogPick[]>("/products", { q: term, limit: 8 })).data;
}