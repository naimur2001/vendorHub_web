import "client-only";
import { api } from "./client";
import type { components } from "./schema";

type VerificationLevel = components["schemas"]["VerificationLevel"];

export type VerificationRequestStatus =
  | "PENDING"
  | "AUTO_FLAGGED"
  | "CORRECTION_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "REVOKED";

// GET /users/me/shops (exact contract agreed with the backend)
export type MyShop = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  membership: "OWNER" | "STAFF";
  staffTitle: string | null;
  verificationLevel: VerificationLevel;
  market: { id: string; name: string; slug: string } | null;
  levelFloor: string | null;
  shopNumber: string | null;
  latestVerification: {
    id: string;
    status: VerificationRequestStatus;
    targetLevel: VerificationLevel;
    createdAt: string;
  } | null;
  createdAt: string;
};


export type MarketImage = { url: string; thumbUrl: string; width: number; height: number };
// GET /markets
export type Market = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  shopCount: number;
  image: MarketImage | null;
};

// POST /shops (only send optional fields that have a value)
export type CreateShopInput = {
  name: string;
  addressLine: string;
  description?: string;
  marketId?: string;
  levelFloor?: string;
  shopNumber?: string;
  supportsDelivery: boolean;
  supportsPickup: boolean;
};

// POST /uploads
export type UploadedFile = {
  id: string;
  url: string;
  purpose: "PUBLIC_IMAGE" | "PRIVATE_DOCUMENT";
  mimeType: string;
  size: number;
};

export type VerificationDocumentType = "TRADE_LICENSE" | "NID" | "SHOP_PHOTO";

export const shopKeys = {
  mine: ["me", "shops"] as const,
  markets: ["markets"] as const,
};

export function getMyShops(): Promise<MyShop[]> {
  return api.get<MyShop[]>("/users/me/shops");
}

export function getMarkets(): Promise<Market[]> {
  return api.get<Market[]>("/markets", { auth: false });
}

export function createShop(input: CreateShopInput): Promise<{ id: string; slug: string }> {
  return api.post<{ id: string; slug: string }>("/shops", input);
}

// Private document: only the uploader and admins can open it (served through the API, never public).
export function uploadPrivateDocument(file: File): Promise<UploadedFile> {
  const body = new FormData();
  body.append("file", file);
  return api.post<UploadedFile>("/uploads", body, { query: { purpose: "PRIVATE_DOCUMENT" } });
}

export function requestVerification(
  shopId: string,
  input: { targetLevel: VerificationLevel; documents: { type: VerificationDocumentType; fileUrl: string }[] },
): Promise<unknown> {
  return api.post<unknown>(`/shops/${encodeURIComponent(shopId)}/verifications`, input);
}