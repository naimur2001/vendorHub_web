// Shop storefront and market reads (public). Types match the real API responses.
import { API_URL, type ApiResult } from "./core";
import { publicGet } from "./public";
import type { components } from "./schema";
import type { MarketImage } from "./shops";
type Availability = components["schemas"]["Availability"];
type VerificationLevel = components["schemas"]["VerificationLevel"];
type ProductSort = "newest" | "price_asc" | "price_desc";

export type CoverPhoto = { url: string; kind: string; verified: boolean };

// GET /shops/:slug
export type Storefront = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  coverPhoto: CoverPhoto | null;
  photoCount: number;
  address: {
    levelFloor: string | null;
    shopNumber: string | null;
    addressLine: string;
    latitude: number | null;
    longitude: number | null;
  };
  market: { id: string; name: string; slug: string } | null;
  verification: { level: VerificationLevel; lastAuditedAt: string | null };
  supportsDelivery: boolean;
  supportsPickup: boolean;
  returnPolicy: { text: string; windowDays: number | null } | null;
  stats: {
    ratingAverage: number | null;
    reviewCount: number;
    avgResponseMins: number | null;
    followers: number;
    activeBargains: number;
  };
  staffCount: number;
  isFollowing: boolean; // only true when the request carries the user's token
};

// GET /shops/:slug/products (one row per listing of this shop)
export type ShopProduct = {
  listingId: string;
  product: { id: string; slug: string; title: string; brand: string | null; image: string | null };
  price: number;
  msrp: number | null;
  availability: Availability;
  bargainEnabled: boolean;
};

// GET /shops/:slug/categories
export type ShopCategory = { id: string; name: string; slug: string; productCount: number };

// GET /shops/:slug/reviews
export type ShopReview = {
  id: string;
  type: "PRODUCT" | "SHOP_TRUST";
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: string;
  product: { title: string; slug: string } | null;
};

// GET /markets/:slug
export type MarketShop = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  levelFloor: string | null;
  shopNumber: string | null;
  addressLine: string;
  verificationLevel: VerificationLevel;
  coverPhoto: CoverPhoto | null;
};

export type MarketDetail = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  image: MarketImage | null;
  latitude: number | null;
  longitude: number | null;
  shops: MarketShop[];
};

const shopPath = (slug: string) => `/shops/${encodeURIComponent(slug)}`;

export async function getStorefront(slug: string): Promise<Storefront> {
  return (await publicGet<Storefront>(shopPath(slug))).data;
}

export function listShopProducts(
  slug: string,
  query: {
    category?: string;
    sort?: ProductSort;
    bargainOnly?: boolean;
    availableOnly?: boolean;
    page?: number;
    limit?: number;
  },
): Promise<ApiResult<ShopProduct[]>> {
  return publicGet<ShopProduct[]>(`${shopPath(slug)}/products`, query);
}

export async function listShopCategories(slug: string): Promise<ShopCategory[]> {
  return (await publicGet<ShopCategory[]>(`${shopPath(slug)}/categories`)).data;
}

export function listShopReviews(
  slug: string,
  query: { type?: "PRODUCT" | "SHOP_TRUST"; page?: number; limit?: number },
): Promise<ApiResult<ShopReview[]>> {
  return publicGet<ShopReview[]>(`${shopPath(slug)}/reviews`, query);
}

export async function getMarketDetail(slug: string): Promise<MarketDetail> {
  return (await publicGet<MarketDetail>(`/markets/${encodeURIComponent(slug)}`)).data;
}

// Photos are only shown from our own API (shop owners can type any banner link: no trackers, no outside sites).
const MEDIA_ORIGIN = new URL(API_URL).origin;

export function safeMediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if ((url.protocol === "https:" || url.protocol === "http:") && url.origin === MEDIA_ORIGIN) return url.toString();
  } catch {
    // not a URL: ignore
  }
  return null;
}

/** "Level 3 · Shop 42" (adds "Shop" to a bare number). */
export function shopPlace(levelFloor: string | null, shopNumber: string | null): string {
  const number = shopNumber ? (/^shop\b/i.test(shopNumber) ? shopNumber : `Shop ${shopNumber}`) : null;
  return [levelFloor, number].filter(Boolean).join(" · ");
}

/** "Rahim Uddin Ahmed" -> "Rahim A." (reviewers' full names are not shown publicly). */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}