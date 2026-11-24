import "client-only";
import { api } from "./client";
import type { components } from "./schema";

// Product deletion: a shop owner asks, the product hides at once and is deleted after 12 hours unless an admin rejects.
// A product with orders is only deactivated (outcome DEACTIVATED), so order history stays.

export type DeletionRequest = components["schemas"]["ProductDeletionRequest"];
export type AdminDeletionRequest = components["schemas"]["AdminProductDeletionRequest"];
export type DeletionStatus = DeletionRequest["status"];
export type DeletionOutcome = NonNullable<DeletionRequest["outcome"]>;

const enc = encodeURIComponent;

export const deletionKeys = {
  admin: (status: DeletionStatus | undefined, page: number) => ["admin", "deletion-requests", status ?? "ALL", page] as const,
  shop: (shopId: string) => ["owner", "deletion-requests", shopId] as const,
};

// Admin
export const listAdminDeletionRequests = (status: DeletionStatus | undefined, page: number) =>
  api.list<AdminDeletionRequest>("/admin/deletion-requests", { query: { status, page, limit: 20 } });
export const approveDeletionRequest = (id: string) => api.post<unknown>(`/admin/deletion-requests/${enc(id)}/approve`);
export const rejectDeletionRequest = (id: string, note: string) => api.post<unknown>(`/admin/deletion-requests/${enc(id)}/reject`, { note });
export const deleteProductPermanently = (id: string) => api.delete<{ productId: string; outcome: DeletionOutcome }>(`/admin/products/${enc(id)}/permanent`);

// Shop owner
export const requestProductDeletion = (shopId: string, productId: string, reason?: string) =>
  api.post<DeletionRequest>(`/shops/${enc(shopId)}/products/${enc(productId)}/deletion-request`, reason ? { reason } : {});
export const listShopDeletionRequests = (shopId: string) =>
  api.list<DeletionRequest>(`/shops/${enc(shopId)}/deletion-requests`, { query: { page: 1, limit: 50 } });
export const cancelDeletionRequest = (shopId: string, id: string) => api.delete<unknown>(`/shops/${enc(shopId)}/deletion-requests/${enc(id)}`);

/** The 409 code the backend puts in error.details.code (NOT_CREATED_BY_SHOP, PRODUCT_LOCKED, SHARED_PRODUCT, ALREADY_PENDING, NOT_PENDING). */
export function deletionErrorCode(details: unknown): string | null {
  if (details && typeof details === "object" && "code" in details && typeof (details as { code: unknown }).code === "string") return (details as { code: string }).code;
  return null;
}
