// The only cache labels the public pages use (see catalog-cache.ts). Anything else is ignored.
export const PUBLIC_TAGS = ["products", "catalog", "markets", "shops", "banners", "featured", "to-let"] as const;
export type PublicTag = (typeof PUBLIC_TAGS)[number];
