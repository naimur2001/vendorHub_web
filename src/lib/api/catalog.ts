// Catalog reads (public). Types match the backend's catalog.service.js exactly.
import { publicGet, type PublicGetOptions } from "./public";
import type { ApiResult } from "./core";
import type { components } from "./schema";

export type Availability = components["schemas"]["Availability"];
export type VerificationLevel = components["schemas"]["VerificationLevel"];

type Ref = { id: string; name: string };
type CategoryRef = { id: string; name: string; slug: string };

// GET /products (one card per canonical product)
export type ProductCardData = {
  id: string;
  slug: string;
  title: string;
  brand: Ref | null;
  category: CategoryRef;
  image: string | null;
  msrp: number | null;
  lowestPrice: number;
  highestPrice: number;
  shopCount: number;
  availability: Availability; // the best availability among the shops
  bargainAvailable: boolean;
  createdAt: string;
  bestListingId?: string | null; // the offer a product-card heart saves (cheapest in stock)
  deal?: { price: number; endsAt: string } | null; // the lowest live flash deal among its shops (lowestPrice already counts it)
};

/** A live flash deal on one listing: `price` on the listing is then already the deal price. */
export type ListingDeal = components["schemas"]["ListingDeal"];

// trending: units sold + add-to-carts in the last 7 days; popular: units sold all time; oldest: first added first
export type ProductSort = "newest" | "price_asc" | "price_desc" | "trending" | "popular" | "oldest";

export type ProductListQuery = {
  q?: string;
  category?: string; // category slug, includes subcategories
  brand?: string; // brand name
  minPrice?: number;
  maxPrice?: number;
  marketId?: string;
  shopId?: string;
  availableOnly?: boolean;
  bargain?: boolean; // only products with a shop that takes offers
  sort?: ProductSort;
  page?: number;
  limit?: number; // max 50
};

// GET /products/:slug
export type ListingShop = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  levelFloor: string | null;
  shopNumber: string | null;
  addressLine: string;
  verificationLevel: VerificationLevel;
  lastAuditedAt: string | null;
  supportsDelivery: boolean;
  supportsPickup: boolean;
  avgResponseMins: number | null;
  market: { id: string; name: string; slug: string } | null;
  rating: { average: number | null; count: number };
};

/** A listing's variations, e.g. Size: S M L (a value can be sold out). */
export type ListingOptionGroup = components["schemas"]["ListingOptions"][number];
/** A chosen variation: { Size: "M", Colour: "Black" }. */
export type ChosenOptions = Record<string, string>;

export type Listing = {
  id: string;
  options?: ListingOptionGroup[]; // empty or missing: nothing to choose
  price: number;
  availability: Availability;
  bargainEnabled: boolean;
  discountPercent: number | null;
  deal?: ListingDeal;
  shop: ListingShop;
};

export type ProductDetail = {
  product: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    specs: Record<string, string | number | boolean> | null;
    images: string[];
    msrp: number | null;
    brand: Ref | null;
    category: CategoryRef;
  };
  selectedListing: Listing | null;
  otherListings: Listing[];
  otherShopsCount: number;
};

export type Category = { id: string; name: string; slug: string; parentId: string | null; productCount: number };
export type Brand = { id: string; name: string; productCount: number };

export function listProducts(
  query: ProductListQuery = {},
  options: PublicGetOptions = {},
): Promise<ApiResult<ProductCardData[]>> {
  return publicGet<ProductCardData[]>("/products", query, options);
}

export async function getProduct(slug: string, listingId?: string): Promise<ProductDetail> {
  const { data } = await publicGet<ProductDetail>(`/products/${encodeURIComponent(slug)}`, { listingId });
  return data;
}

// Distance (km) from a point to each shop offering this product: listing id -> km (null = market has no map point).
// The point goes only to our API for this request.
export async function getListingDistances(slug: string, lat: number, lng: number): Promise<Record<string, number | null>> {
  const round = (n: number) => Math.round(n * 1e4) / 1e4;
  const { data } = await publicGet<ProductDetail>(`/products/${encodeURIComponent(slug)}`, { lat: round(lat), lng: round(lng) });
  const out: Record<string, number | null> = {};
  const all = [data.selectedListing, ...data.otherListings].filter(Boolean) as (Listing & { distanceKm?: number | null })[];
  for (const l of all) out[l.id] = l.distanceKm ?? null;
  return out;
}

export async function listCategories(): Promise<Category[]> {
  return (await publicGet<Category[]>("/categories")).data;
}

export async function listBrands(): Promise<Brand[]> {
  return (await publicGet<Brand[]>("/brands")).data;
}