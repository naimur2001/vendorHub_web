// Public product reviews (server or browser). Shape of reviewOut() + summary in reviews.service.js.
import type { ApiResult } from "./core";
import { publicGet } from "./public";

export type ProductReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: string | null;
  shop: { id: string; name: string; slug: string } | null;
};

export type ReviewSummary = { average: number | null; count: number; distribution: Record<"1" | "2" | "3" | "4" | "5", number> };

export async function getProductReviews(slug: string): Promise<{ items: ProductReview[]; summary: ReviewSummary | null; total: number }> {
  const r: ApiResult<ProductReview[]> = await publicGet<ProductReview[]>(`/products/${encodeURIComponent(slug)}/reviews`, { page: 1, limit: 10 });
  const summary = (r.meta as { summary?: ReviewSummary } | undefined)?.summary ?? null;
  return { items: r.data, summary, total: r.meta?.pagination?.total ?? r.data.length };
}