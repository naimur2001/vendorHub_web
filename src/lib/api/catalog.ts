// Catalog reads (public). Types match the backend's catalog.service.js exactly.
import { publicGet } from "./public";
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
};

export type ProductSort = "newest" | "price_asc" | "price_desc";

export type ProductListQuery = {
  q?: string;
  category?: string; // category slug, includes subcategories
  brand?: string; // brand name
  minPrice?: number;
  maxPrice?: number;
  marketId?: string;
  shopId?: string;
  availableOnly?: boolean;
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

export type Listing = {
  id: string;
  price: number;
  availability: Availability;
  bargainEnabled: boolean;
  discountPercent: number | null;
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

export function listProducts(query: ProductListQuery = {}, signal?: AbortSignal): Promise<ApiResult<ProductCardData[]>> {
  return publicGet<ProductCardData[]>("/products", query, { signal });
}

export async function getProduct(slug: string, listingId?: string): Promise<ProductDetail> {
  const { data } = await publicGet<ProductDetail>(`/products/${encodeURIComponent(slug)}`, { listingId });
  return data;
}

export async function listCategories(): Promise<Category[]> {
  return (await publicGet<Category[]>("/categories")).data;
}

export async function listBrands(): Promise<Brand[]> {
  return (await publicGet<Brand[]>("/brands")).data;
}