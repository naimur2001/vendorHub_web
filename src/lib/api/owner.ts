import "client-only";
import type { Bargain, BargainStatus } from "./bargains";
import { api } from "./client";
import type { ApiResult } from "./core";

// What the shop team sees: the same negotiation plus the customer's name.
export type ShopBargain = Bargain & { customer?: { name: string } };

export type InboxFilter = BargainStatus | "ALL";

export const ownerKeys = {
  inbox: (shopId: string, status: InboxFilter, page: number) => ["owner", "bargains", shopId, status, page] as const,
};

// GET /shops/:shopId/bargains (owner, staff or admin of that shop; others get an error from the backend)
export function listShopBargains(
  shopId: string,
  query: { status: InboxFilter; page: number; limit: number },
): Promise<ApiResult<ShopBargain[]>> {
  return api.list<ShopBargain>(`/shops/${encodeURIComponent(shopId)}/bargains`, { query });
}