import "client-only";
import { api } from "./client";

export type AnalyticsRange = "7d" | "30d";

type DayStats = { views: number; addToCarts: number; orders: number; revenue: number; bargainOffers: number; bargainsAccepted: number };

// Exact shape of analytics() in shopTools.service.js (days are Dhaka days, oldest first, every day present)
export type ShopAnalytics = {
  range: AnalyticsRange;
  timeZone: string;
  from: string;
  to: string;
  days: (DayStats & { date: string })[];
  totals: DayStats & { bargainWinRate: number | null };
  topListings: { listingId: string; views: number; addToCarts: number; unitsSold: number; revenue: number; productTitle: string | null; productSlug: string | null; price: number | null }[];
};

export type ImportResult = { created: number; updated: number; errors: { row: number; message: string }[] };

export const toolKeys = {
  analytics: (shopId: string, range: AnalyticsRange) => ["owner", "analytics", shopId, range] as const,
};

const base = (shopId: string) => `/shops/${encodeURIComponent(shopId)}`;

export const getShopAnalytics = (shopId: string, range: AnalyticsRange) =>
  api.get<ShopAnalytics>(`${base(shopId)}/analytics`, { query: { range } });

/** CSV of listings (max 1 MB, 500 rows). All rows are checked first: any bad row and nothing is saved (422 with the errors). */
export function importListingsCsv(shopId: string, file: File): Promise<ImportResult> {
  const body = new FormData();
  body.append("file", file);
  return api.post<ImportResult>(`${base(shopId)}/listings/import`, body);
}
