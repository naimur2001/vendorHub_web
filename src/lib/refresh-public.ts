"use client";

import { refreshPublic, type PublicTag } from "@/app/actions/refresh-public";
import { getAccessToken } from "@/lib/api/client";

/** After an admin change: refresh the public pages that show it (fire and forget). */
export function refreshPublicPages(tags: PublicTag[]): void {
  const token = getAccessToken();
  if (!token) return;
  void refreshPublic(tags, token).catch(() => undefined);
}