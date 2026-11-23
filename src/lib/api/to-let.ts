import "client-only";
import { api } from "./client";
import type { ApiResult } from "./core";
import { publicGet } from "./public";

// Shop To-Let. Vendors Hub is the middleman: public data never has the owner's or renter's contacts.

export type ToLetStatus = "PENDING_EMAIL" | "SUBMITTED" | "NEEDS_INFO" | "PUBLISHED" | "RENTED" | "REJECTED" | "EXPIRED" | "WITHDRAWN";
export type ToLetPhoto = { id: string; url: string; thumbUrl: string; width?: number | null; height?: number | null };
type MarketRef = { id: string; name: string; slug: string } | null;

export type ToLetCard = {
  id: string;
  slug: string;
  title: string;
  market: MarketRef;
  marketName: string | null;
  levelFloor: string | null;
  addressLine: string;
  sizeSqft: number;
  monthlyRent: number;
  advance: number;
  availableFrom: string | null; // YYYY-MM-DD (Dhaka)
  cover: ToLetPhoto | null;
  photoCount: number;
  publishedAt: string | null;
  expiresAt: string | null;
};
export type ToLetDetail = ToLetCard & { shopNumber: string | null; suitableFor: { id: string; name: string; slug: string }[]; description: string; photos: ToLetPhoto[] };
export type ToLetDocument = { id: string; mimeType: string; size: number; originalName: string; createdAt: string };
export type ToLetOwnerView = ToLetDetail & {
  marketId: string | null;
  status: ToLetStatus;
  rejectReason: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  documents: ToLetDocument[];
  createdAt: string;
  updatedAt: string;
};
export type ToLetMessage = { id: string; senderRole: "OWNER" | "RENTER" | "ADMIN"; mine: boolean; body: string; createdAt: string; readAt: string | null };

export type ToLetInput = {
  marketId?: string | null;
  marketName?: string | null;
  levelFloor?: string | null;
  shopNumber?: string | null;
  addressLine: string;
  sizeSqft: number;
  monthlyRent: number;
  advance: number;
  availableFrom: string; // YYYY-MM-DD
  suitableFor?: string[];
  description: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
};

export type ToLetSort = "newest" | "rent_asc" | "rent_desc";
export type ToLetQuery = { marketId?: string; minRent?: number; maxRent?: number; minSize?: number; maxSize?: number; q?: string; sort?: ToLetSort; page?: number };

/** How the owner proves it is their listing: logged in (nothing to send) or the private manage token from the email. */
export type OwnerAuth = { token?: string };
const ownerHeaders = (a: OwnerAuth) => (a.token ? { headers: { "X-Manage-Token": a.token } } : {});

export const TOKEN = /^[a-f0-9]{64}$/;

export const toLetKeys = {
  list: (q: ToLetQuery) => ["to-let", "list", q] as const,
  detail: (slug: string) => ["to-let", "detail", slug] as const,
  mine: ["to-let", "mine"] as const,
  managed: (token: string) => ["to-let", "managed", token.slice(0, 8)] as const,
  ownerMessages: (id: string) => ["to-let", "owner-messages", id] as const,
  inquiry: (id: string) => ["to-let", "inquiry", id] as const,
};

const base = (id: string) => `/to-let/${encodeURIComponent(id)}`;

// ---------- public ----------
export const listToLet = (q: ToLetQuery): Promise<ApiResult<ToLetCard[]>> => publicGet<ToLetCard[]>("/to-let", { ...q, limit: 12 });
export const getToLet = async (slug: string) => (await publicGet<ToLetDetail>(`/to-let/${encodeURIComponent(slug)}`)).data;

export type InquiryInput = { name: string; phone: string; email?: string; message: string };
export type InquiryResult = { inquiryId: string; status: string; createdAt: string; followToken?: string };
export const sendInquiry = (listingId: string, input: InquiryInput) => api.post<InquiryResult>(`${base(listingId)}/inquiries`, input);
export const getInquiryMessages = (id: string, token?: string) =>
  api.get<{ inquiryId: string; status: string; messages: ToLetMessage[] }>(`/to-let/inquiries/${encodeURIComponent(id)}/messages`, token ? { query: { token } } : {});
export const sendInquiryMessage = (id: string, body: string, token?: string) =>
  api.post<ToLetMessage>(`/to-let/inquiries/${encodeURIComponent(id)}/messages${token ? `?token=${token}` : ""}`, { body });

// ---------- owner ----------
export const createToLet = (input: ToLetInput) => api.post<ToLetOwnerView & { emailConfirmationRequired: boolean }>("/to-let", input);
export const confirmToLetEmail = (token: string) => api.post<{ listingId: string; status: ToLetStatus }>("/to-let/confirm-email", { token });
export const getManagedToLet = (token: string) => api.get<ToLetOwnerView>("/to-let/manage", { query: { token } });
export const listMyToLet = () => api.get<ToLetOwnerView[]>("/me/to-let");
export const updateToLet = (id: string, patch: Partial<ToLetInput>, a: OwnerAuth) => api.patch<ToLetOwnerView>(base(id), patch, ownerHeaders(a));
export const withdrawToLet = (id: string, a: OwnerAuth) => api.post<{ id: string; status: ToLetStatus }>(`${base(id)}/withdraw`, undefined, ownerHeaders(a));
export function addToLetPhoto(id: string, file: File, a: OwnerAuth) {
  const body = new FormData();
  body.append("image", file);
  return api.post<ToLetPhoto>(`${base(id)}/photos`, body, ownerHeaders(a));
}
export const removeToLetPhoto = (id: string, photoId: string, a: OwnerAuth) => api.delete<unknown>(`${base(id)}/photos/${encodeURIComponent(photoId)}`, ownerHeaders(a));
export function addToLetDocument(id: string, file: File, a: OwnerAuth) {
  const body = new FormData();
  body.append("file", file);
  return api.post<ToLetDocument>(`${base(id)}/documents`, body, ownerHeaders(a));
}
export const getOwnerMessages = (id: string, a: OwnerAuth) => api.get<{ messages: ToLetMessage[] }>(`${base(id)}/messages`, ownerHeaders(a));
export const sendOwnerMessage = (id: string, body: string, a: OwnerAuth) => api.post<ToLetMessage>(`${base(id)}/messages`, { body }, ownerHeaders(a));

// ---------- admin ----------
export type AdminToLetRow = {
  id: string;
  slug: string | null;
  title: string;
  status: ToLetStatus;
  marketName: string | null;
  monthlyRent: number;
  sizeSqft: number;
  contactName: string;
  contactPhone: string;
  guest: boolean;
  photoCount: number;
  documentCount: number;
  inquiryCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  expiresAt: string | null;
};
export type AdminInquiry = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string;
  status: "NEW" | "IN_TALKS" | "CONNECTED" | "CLOSED";
  guest: boolean;
  contactsSharedAt: string | null;
  createdAt: string;
  messages: ToLetMessage[];
};
export type AdminToLetDetail = Omit<ToLetOwnerView, "documents"> & {
  submitter: { id: string; name: string; email?: string } | null;
  guest: boolean;
  documents: (ToLetDocument & { url: string })[];
  ownerThread: { messages: ToLetMessage[] };
  inquiries: AdminInquiry[];
  notes: { id: string; body: string; author: { name: string } | null; createdAt: string }[];
};
export const adminToLetKeys = {
  list: (status: ToLetStatus | undefined, page: number) => ["admin", "to-let", status ?? "ALL", page] as const,
  detail: (id: string) => ["admin", "to-let-detail", id] as const,
};
export async function listAdminToLet(status: ToLetStatus | undefined, page: number) {
  const r = await api.list<AdminToLetRow>("/admin/to-let", { query: { status, page, limit: 20 } });
  return { ...r, counts: (r.meta as { counts?: Partial<Record<ToLetStatus, number>> } | undefined)?.counts ?? null };
}
const admin = (id: string) => `/admin/to-let/${encodeURIComponent(id)}`;
export const getAdminToLet = (id: string) => api.get<AdminToLetDetail>(admin(id));
export const publishToLet = (id: string) => api.post<unknown>(`${admin(id)}/publish`);
export const requestToLetInfo = (id: string, message: string) => api.post<unknown>(`${admin(id)}/request-info`, { message });
export const rejectToLet = (id: string, reason: string) => api.post<unknown>(`${admin(id)}/reject`, { reason });
export const markToLetRented = (id: string) => api.post<unknown>(`${admin(id)}/mark-rented`);
export const renewToLet = (id: string) => api.post<unknown>(`${admin(id)}/renew`);
export const addToLetNote = (id: string, body: string) => api.post<unknown>(`${admin(id)}/notes`, { body });
export const replyToOwner = (id: string, body: string) => api.post<ToLetMessage>(`${admin(id)}/messages`, { body });
export const replyToInquiry = (id: string, body: string) => api.post<ToLetMessage>(`/admin/to-let/inquiries/${encodeURIComponent(id)}/messages`, { body });
export const setInquiryStatus = (id: string, status: AdminInquiry["status"]) => api.patch<unknown>(`/admin/to-let/inquiries/${encodeURIComponent(id)}`, { status });
export const shareInquiryContacts = (id: string) => api.post<unknown>(`/admin/to-let/inquiries/${encodeURIComponent(id)}/share-contacts`);
