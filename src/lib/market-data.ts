import { cacheLife, cacheTag } from "next/cache";
import { ApiError } from "@/lib/api/core";
import { publicGet } from "@/lib/api/public";
import type { MarketDetail, MarketShop } from "@/lib/api/storefront";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const validSlug = (slug: string) => slug.length <= 200 && SLUG.test(slug);

// Markets change rarely: cached 5 minutes. "Not found" is cached too (null), so invented names don't hit the API.
export async function marketData(slug: string): Promise<MarketDetail | null> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag("markets");
  try {
    return (await publicGet<MarketDetail>(`/markets/${encodeURIComponent(slug)}`, undefined, { fresh: false })).data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err; // other errors are not cached
  }
}

// "Level 2" -> 2, "Ground floor" -> 0, no floor -> last.
function floorRank(floor: string | null): number {
  if (!floor) return Number.POSITIVE_INFINITY;
  if (/ground/i.test(floor)) return 0;
  const n = floor.match(/-?\d+/);
  return n ? Number(n[0]) : 999;
}

/** The market's shops grouped by floor, lowest floor first (shops without a floor last). */
export function groupByFloor(shops: MarketShop[]): [string | null, MarketShop[]][] {
  const groups = new Map<string | null, MarketShop[]>();
  for (const shop of shops) {
    const key = shop.levelFloor?.trim() || null;
    groups.set(key, [...(groups.get(key) ?? []), shop]);
  }
  return [...groups.entries()].sort(([a], [b]) => floorRank(a) - floorRank(b) || (a ?? "").localeCompare(b ?? ""));
}
