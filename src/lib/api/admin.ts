import "client-only";
import { api } from "./client";
import type { ApiResult } from "./core";
import type { components } from "./schema";
import { publicGet } from "./public";
export type VerificationLevel = components["schemas"]["VerificationLevel"];
export type VerificationStatus = "PENDING" | "AUTO_FLAGGED" | "CORRECTION_REQUESTED" | "APPROVED" | "REJECTED" | "REVOKED";
export type DocumentType = "TRADE_LICENSE" | "NID" | "SHOP_PHOTO" | "OTHER";
export type QueueFilter = "OPEN" | "ALL" | VerificationStatus;
export type ScoreBand = "GREEN" | "AMBER" | "RED";

export const LEVELS: VerificationLevel[] = [
  "UNVERIFIED",
  "DOCUMENTS_VERIFIED",
  "BUSINESS_VERIFIED",
  "PHYSICAL_SHOP_VERIFIED",
  "TRUSTED_VENDOR",
];

export const QUEUE_FILTERS: QueueFilter[] = [
  "OPEN",
  "PENDING",
  "AUTO_FLAGGED",
  "CORRECTION_REQUESTED",
  "APPROVED",
  "REJECTED",
  "REVOKED",
  "ALL",
];

export type VerificationDoc = {
  id: string;
  type: DocumentType;
  fileUrl: string; // private file: opened only with the admin's login (step G2)
  needsReupload: boolean;
  reviewed: boolean;
};

// Exact shape of adminRow() in verification.service.js
export type AdminVerificationRow = {
  id: string;
  status: VerificationStatus;
  targetLevel: VerificationLevel;
  currentLevel: VerificationLevel;
  submittedAt: string;
  reviewedAt: string | null;
  shop: { id: string; name: string; slug: string; addressLine: string };
  documents: VerificationDoc[];
  precheckScore: number | null;
  scoreBand: ScoreBand | null;
  actions: { approve: boolean; requestCorrection: boolean; reject: boolean; revoke: boolean }; // which buttons the backend allows
};

export type QueueStats = { pendingReview: number; autoFlagged: number; approvedThisWeek: number };

export type QueueQuery = {
  status: QueueFilter;
  q?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  page: number;
  limit: number;
};

export const adminKeys = {
  queue: (query: QueueQuery) => ["admin", "verifications", query] as const,
  verification: (id: string) => ["admin", "verification", id] as const,
};

// GET /admin/verifications (admins only; the backend refuses everyone else)
export async function listVerifications(query: QueueQuery): Promise<ApiResult<AdminVerificationRow[]> & { stats: QueueStats | null }> {
  const result = await api.list<AdminVerificationRow>("/admin/verifications", {
    query: {
      status: query.status,
      q: query.q,
      from: query.from,
      // "until" includes the whole chosen day
      to: query.to ? `${query.to}T23:59:59.999` : undefined,
      page: query.page,
      limit: query.limit,
    },
  });
  const stats = (result.meta as { stats?: QueueStats } | undefined)?.stats ?? null;
  return { ...result, stats };
}



// ---------- Review panel (G2) ----------

export type StepState = "completed" | "current" | "upcoming" | "rejected";

// Exact shape of getForAdmin() in verification.service.js
export type AdminVerificationDetail = AdminVerificationRow & {
  internalNotes: string | null;
  precheck: { score: number | null; band: ScoreBand | null; details: Record<string, boolean | string> | null };
  stepper: { level: VerificationLevel; state: StepState }[];
  shopDetails: { levelFloor: string | null; shopNumber: string | null; market: string | null; lastAuditedAt: string | null };
  owner: { name: string; email: string };
  history: { id: string; action: string; meta: Record<string, unknown> | null; createdAt: string; actor: string | null }[];
};

const vPath = (id: string) => `/admin/verifications/${encodeURIComponent(id)}`;

export function getVerification(id: string): Promise<AdminVerificationDetail> {
  return api.get<AdminVerificationDetail>(vPath(id));
}

export function saveNotes(id: string, notes: string): Promise<{ internalNotes: string }> {
  return api.patch<{ internalNotes: string }>(`${vPath(id)}/notes`, { notes });
}

export function markDocumentReviewed(id: string, docId: string, reviewed: boolean): Promise<AdminVerificationDetail> {
  return api.patch<AdminVerificationDetail>(`${vPath(id)}/documents/${encodeURIComponent(docId)}`, { reviewed });
}

export function approveVerification(id: string): Promise<AdminVerificationDetail> {
  return api.post<AdminVerificationDetail>(`${vPath(id)}/approve`);
}

export function requestCorrection(id: string, note: string, documentIds: string[]): Promise<AdminVerificationDetail> {
  return api.post<AdminVerificationDetail>(`${vPath(id)}/request-correction`, { note, documentIds });
}

export function rejectVerification(id: string, reason: string): Promise<AdminVerificationDetail> {
  return api.post<AdminVerificationDetail>(`${vPath(id)}/reject`, { reason });
}

export function revokeShop(shopId: string, reason: string): Promise<{ shopId: string; level: VerificationLevel }> {
  return api.post<{ shopId: string; level: VerificationLevel }>(`/admin/shops/${encodeURIComponent(shopId)}/revoke`, { reason });
}




// ---------- Markets (G4a) ----------

// GET /markets (public list, always fresh here) and GET /markets/:slug for the saved location.
export type MarketImage = { url: string; thumbUrl: string; width: number; height: number };

export type AdminMarket = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  shopCount: number;
  image: MarketImage | null;
};
export type MarketInput = {
  name: string;
  city: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export const marketKeys = {
  all: ["admin", "markets"] as const,
  location: (slug: string) => ["admin", "market-location", slug] as const,
};

export async function listAllMarkets(): Promise<AdminMarket[]> {
  return (await publicGet<AdminMarket[]>("/markets")).data;
}

export async function getMarketLocation(slug: string): Promise<{ latitude: number | null; longitude: number | null }> {
  const { data } = await publicGet<{ latitude: number | null; longitude: number | null }>(`/markets/${encodeURIComponent(slug)}`);
  return { latitude: data.latitude, longitude: data.longitude };
}

// Admin only (the backend checks and writes the audit log).
export function createMarket(input: MarketInput): Promise<AdminMarket> {
  return api.post<AdminMarket>("/admin/markets", input);
}

export function updateMarket(id: string, input: MarketInput): Promise<AdminMarket> {
  return api.patch<AdminMarket>(`/admin/markets/${encodeURIComponent(id)}`, input);
}

export function deleteMarket(id: string): Promise<{ message: string }> {
  return api.delete<{ message: string }>(`/admin/markets/${encodeURIComponent(id)}`);
}



// Photo: one real image file, checked and re-drawn as WebP by the server (admin only).
export function uploadMarketImage(id: string, file: File): Promise<unknown> {
  const body = new FormData();
  body.append("image", file);
  return api.put<unknown>(`/admin/markets/${encodeURIComponent(id)}/image`, body);
}

export function removeMarketImage(id: string): Promise<unknown> {
  return api.delete<unknown>(`/admin/markets/${encodeURIComponent(id)}/image`);
}



// ---------- Products (G4b) ----------

export type CatalogCategory = { id: string; name: string; slug: string; parentId?: string | null; children?: CatalogCategory[] };
export type CatalogBrand = { id: string; name: string };

// GET /admin/products row (admin catalog module)
export type AdminProduct = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  specs: Record<string, unknown> | null;
  msrp: number | null;
  images: string[];
  isActive: boolean;
  brand: { id: string; name: string } | null;
  category: { id: string; name: string; slug: string };
  activeListings: number;
  source: "ADMIN" | "SHOP";
  createdBy: { id: string; name: string; slug: string } | null;
  reviewedAt: string | null;
};

export type ProductInput = {
  title: string;
  categoryId: string;
  brandId: string | null;
  description: string | null;
  specs: Record<string, string>;
  msrp: number | null;
};

export type ProductQuery = {
  q?: string;
  categoryId?: string;
  isActive?: boolean;
  source?: "ADMIN" | "SHOP";
  reviewed?: boolean;
  page: number;
  limit: number;
};

export const productKeys = {
  list: (q: ProductQuery) => ["admin", "products", q] as const,
  categories: ["admin", "categories"] as const,
  brands: ["admin", "brands"] as const,
};

export function listAdminProducts(q: ProductQuery): Promise<ApiResult<AdminProduct[]>> {
  return api.list<AdminProduct>("/admin/products", { query: q });
}

export async function listCategories(): Promise<CatalogCategory[]> {
  return (await publicGet<CatalogCategory[]>("/categories")).data;
}

export async function listBrands(): Promise<CatalogBrand[]> {
  return (await publicGet<CatalogBrand[]>("/brands")).data;
}

export function createProduct(input: ProductInput): Promise<AdminProduct> {
  return api.post<AdminProduct>("/admin/products", input);
}

export function updateProduct(id: string, patch: Partial<ProductInput> & { isActive?: boolean }): Promise<AdminProduct> {
  return api.patch<AdminProduct>(`/admin/products/${encodeURIComponent(id)}`, patch);
}


export function reviewProduct(id: string): Promise<unknown> {
  return api.post<unknown>(`/admin/products/${encodeURIComponent(id)}/review`);
}

export function mergeProduct(id: string, intoProductId: string): Promise<unknown> {
  return api.post<unknown>(`/admin/products/${encodeURIComponent(id)}/merge`, { intoProductId });
}