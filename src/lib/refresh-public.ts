"use client";

import { getAccessToken } from "@/lib/api/client";
import type { PublicTag } from "@/lib/public-tags";

/**
 * After an admin change: refresh the public pages that show it (fire and forget).
 * The token goes in the Authorization header, so it never shows up in server logs.
 */
export function refreshPublicPages(tags: PublicTag[]): void {
  const token = getAccessToken();
  if (!token) return;
  void fetch("/api/refresh-public", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tags }),
    credentials: "omit",
    keepalive: true, // still sent if the admin navigates away right after saving
  }).catch(() => undefined);
}
