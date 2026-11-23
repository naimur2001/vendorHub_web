import "client-only";
import { api } from "./client";
import type { ApiResult } from "./core";
import { publicGet } from "./public";

// ---------- featured slots (admin) ----------
export type FeaturedKind = "SHOP" | "PRODUCT";
export type FeaturedSlot = {
  id: string;
  kind: FeaturedKind;
  targetId: string;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  liveNow: boolean;
  createdAt: string;
  target?: { name: string; slug: string } | null; // when the backend sends it
};
export const FEATURED_MAX = 12; // per kind (backend rule)

// The public featured lists give names for the live slots
type PublicFeatured = { slotId: string; shop?: { name: string; slug: string }; product?: { title: string; slug: string } };

export const modKeys = {
  featured: (kind: FeaturedKind) => ["admin", "featured", kind] as const,
  products: (status: ModerationStatus, page: number) => ["admin", "moderation", status, page] as const,
  flags: (status: FlagStatus, page: number) => ["admin", "flags", status, page] as const,
};

export async function listFeatured(kind: FeaturedKind): Promise<FeaturedSlot[]> {
  const [slots, live] = await Promise.all([
    api.get<FeaturedSlot[]>("/admin/featured", { query: { kind } }),
    publicGet<PublicFeatured[]>("/featured", { kind }).then((r) => r.data).catch(() => [] as PublicFeatured[]),
  ]);
  const names = new Map(live.map((p) => [p.slotId, p.shop ? { name: p.shop.name, slug: p.shop.slug } : p.product ? { name: p.product.title, slug: p.product.slug } : null]));
  return slots.map((s) => ({ ...s, target: s.target ?? names.get(s.id) ?? null }));
}
export const addFeatured = (input: { kind: FeaturedKind; targetId: string; startsAt?: string | null; endsAt?: string | null }) =>
  api.post<FeaturedSlot>("/admin/featured", input);
export const reorderFeatured = (ids: string[]) => api.patch<FeaturedSlot[]>("/admin/featured/reorder", { ids });
export const removeFeatured = (id: string) => api.delete<unknown>(`/admin/featured/${encodeURIComponent(id)}`);

// ---------- product moderation (admin) ----------
export type ModerationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type PendingProduct = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  msrp: number | null;
  images: string[];
  category: { name: string } | null;
  brand: { name: string } | null;
  source: string | null;
  shop: { id: string; name: string; slug: string } | null;
  moderationStatus: ModerationStatus;
  moderationNote: string | null;
  moderatedAt: string | null;
  createdAt: string;
};
export const listModeration = (status: ModerationStatus, page: number): Promise<ApiResult<PendingProduct[]>> =>
  api.list<PendingProduct>("/admin/moderation/products", { query: { status, page, limit: 20 } });
export const approveProduct = (id: string) => api.post<unknown>(`/admin/moderation/products/${encodeURIComponent(id)}/approve`);
export const rejectProduct = (id: string, reason: string) => api.post<unknown>(`/admin/moderation/products/${encodeURIComponent(id)}/reject`, { reason });

// ---------- content flags ----------
export type FlagTarget = "REVIEW" | "ORDER_MESSAGE" | "REVIEW_PHOTO";
export type FlagReason = "SPAM" | "ABUSE" | "SCAM" | "PERSONAL_INFO" | "OFF_TOPIC" | "OTHER";
export const FLAG_REASONS: FlagReason[] = ["SPAM", "ABUSE", "SCAM", "PERSONAL_INFO", "OFF_TOPIC", "OTHER"];
export type FlagStatus = "OPEN" | "HIDDEN" | "KEPT";
export type Flag = {
  id: string;
  targetType: FlagTarget;
  targetId: string;
  reason: FlagReason;
  note: string | null;
  auto: boolean;
  status: FlagStatus;
  reportsOnTarget: number;
  target:
    | { id: string; type?: string; rating?: number; comment?: string | null; isHidden: boolean; body?: string; senderRole?: string; url?: string; thumbUrl?: string }
    | null;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
};
export const listFlags = (status: FlagStatus, page: number): Promise<ApiResult<Flag[]>> => api.list<Flag>("/admin/flags", { query: { status, page, limit: 20 } });
export const resolveFlag = (id: string, action: "HIDE" | "KEEP", note?: string) =>
  api.post<unknown>(`/admin/flags/${encodeURIComponent(id)}/resolve`, { action, ...(note && { note }) });

/** Anyone logged in can report a review, a review photo or a chat message (same report twice = no-op). */
export const reportContent = (input: { targetType: FlagTarget; targetId: string; reason: FlagReason; note?: string }) => api.post<{ id: string; status: string }>("/flags", input);
