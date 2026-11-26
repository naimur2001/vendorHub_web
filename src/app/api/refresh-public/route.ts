import { revalidateTag } from "next/cache";
import { PUBLIC_TAGS } from "@/lib/public-tags";

/**
 * POST /api/refresh-public: refreshes public pages right after an admin change.
 * The admin's access token comes in the Authorization header, never in the body or as a
 * Server Action argument (the dev server prints those). Anyone can call this URL, so the
 * token is checked with the backend first: only a logged-in ADMIN may empty the cache.
 * Body: { "tags": ["banners", ...] }. Unknown tags are ignored.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token.length < 20 || token.length > 4096) return new Response(null, { status: 401 });

  let tags: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 1024) return new Response(null, { status: 413 });
    tags = (JSON.parse(raw) as { tags?: unknown }).tags;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > 5) return new Response(null, { status: 400 });

  const api = process.env.NEXT_PUBLIC_API_URL;
  if (!api) return new Response(null, { status: 503 });
  try {
    const res = await fetch(`${api}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) return new Response(null, { status: 403 });
    const body = (await res.json()) as { data?: { role?: string; user?: { role?: string } } };
    if ((body.data?.role ?? body.data?.user?.role) !== "ADMIN") return new Response(null, { status: 403 });
  } catch {
    return new Response(null, { status: 502 });
  }

  // expire: 0 = the next visit gets fresh data (updateTag only works inside Server Actions).
  for (const tag of new Set(tags)) {
    if (typeof tag === "string" && (PUBLIC_TAGS as readonly string[]).includes(tag)) revalidateTag(tag, { expire: 0 });
  }
  return new Response(null, { status: 204 });
}
