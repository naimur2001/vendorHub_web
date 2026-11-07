import "client-only";
import { api } from "./client";

export type ReviewType = "PRODUCT" | "SHOP_TRUST";

export type ReviewInput = { orderId: string; type: ReviewType; productId?: string; rating: number; comment?: string };

export function createReview(input: ReviewInput): Promise<{ id: string }> {
  return api.post<{ id: string }>("/reviews", input);
}

export function updateReview(id: string, patch: { rating: number; comment: string | null }): Promise<{ id: string }> {
  return api.patch<{ id: string }>(`/reviews/${encodeURIComponent(id)}`, patch);
}