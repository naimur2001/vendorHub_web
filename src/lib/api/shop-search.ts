// GET /shops (public shop search). Types match the agreed contract with the backend.
import type { ApiResult } from "./core";
import { publicGet } from "./public";
import type { components } from "./schema";
import type { CoverPhoto, SocialLinks } from "./storefront";

type VerificationLevel = components["schemas"]["VerificationLevel"];

export type ShopSearchItem = {
  id: string;
  name: string;
  slug: string;
  phone: string | null; // null for shops created before phones were required
  whatsapp: string | null;
  socialLinks: SocialLinks;
  logoUrl: string | null;
  levelFloor: string | null;
  shopNumber: string | null;
  verificationLevel: VerificationLevel;
  market: { id: string; name: string; slug: string } | null;
  coverPhoto: CoverPhoto | null;
  ratingAverage: number | null;
  reviewCount: number;
  productCount: number;
};

export function searchShops(query: {
  q?: string;
  marketId?: string;
  verifiedOnly?: boolean;
  page?: number;
  limit?: number; // max 20
}): Promise<ApiResult<ShopSearchItem[]>> {
  return publicGet<ShopSearchItem[]>("/shops", query);
}