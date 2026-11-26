// Sort orders offered on a market page (server page and client dropdown both use this list).
export const MARKET_SORTS = ["newest", "popular", "price_asc", "price_desc"] as const;
export type MarketSort = (typeof MARKET_SORTS)[number];
