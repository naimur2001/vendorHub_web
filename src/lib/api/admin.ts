import "client-only";
import { api } from "./client";
import type { ApiResult } from "./core";
import type { components } from "./schema";

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