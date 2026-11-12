"use server";

import { updateTag } from "next/cache";

// The only cache labels the public pages use. Anything else is ignored.
const ALLOWED = ["products", "catalog", "markets", "shops"] as const;
export type PublicTag = (typeof ALLOWED)[number];

/**
 * Refreshes public pages right after an admin change.
 * Server Actions can be called by anyone, so the caller is checked with the backend first:
 * only a logged-in ADMIN may empty the cache.
 */
export async function refreshPublic(tags: string[], token: string): Promise<boolean> {
  if (!Array.isArray(tags) || tags.length > 4 || typeof token !== "string" || token.length < 20 || token.length > 4096) return false;

  const api = process.env.NEXT_PUBLIC_API_URL;
  if (!api) return false;
  try {
    const res = await fetch(`${api}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) return false;
    const body = (await res.json()) as { data?: { role?: string; user?: { role?: string } } };
    if ((body.data?.role ?? body.data?.user?.role) !== "ADMIN") return false;
  } catch {
    return false;
  }

  for (const tag of new Set(tags)) {
    if ((ALLOWED as readonly string[]).includes(tag)) updateTag(tag);
  }
  return true;
}