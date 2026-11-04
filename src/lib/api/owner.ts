import "client-only";
import type { Bargain, BargainStatus } from "./bargains";
import type { DeliveryMethod, OrderStatus, PaymentMethod, PaymentStatus } from "./checkout";
import { api } from "./client";
import type { ApiResult } from "./core";
import type { components } from "./schema";

type Availability = components["schemas"]["Availability"];
type VerificationLevel = components["schemas"]["VerificationLevel"];

// What the shop team sees: the same negotiation plus the customer's name.
export type ShopBargain = Bargain & { customer?: { name: string } };

export type InboxFilter = BargainStatus | "ALL";

type Sales = { orders: number; revenue: number };
type VerificationRequest = { id: string; status: string; targetLevel: VerificationLevel };

// Exact shape of shopDashboard() in dashboards.service.js
export type ShopDashboard = {
  shop: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    verificationLevel: VerificationLevel;
    avgResponseMins: number | null;
  };
  orders: {
    total: number;
    byStatus: Record<OrderStatus, number>;
    recent: {
      id: string;
      orderNumber: string;
      status: OrderStatus;
      paymentMethod: PaymentMethod;
      paymentStatus: PaymentStatus;
      deliveryMethod: DeliveryMethod;
      total: number;
      createdAt: string;
      customer: string;
    }[];
  };
  sales: { last24h: Sales; last7d: Sales; last30d: Sales; completedRevenueLast30d: number };
  actions: {
    ordersToConfirm: number;
    ordersAwaitingPayment: number;
    bargainsWaiting: number;
    lowStockCount: number;
    lowStock: {
      id: string;
      availability: Availability;
      stockQty: number | null;
      price: number;
      product: { title: string; slug: string };
    }[];
  };
  listings: { active: number; inactive: number };
  verification: {
    level: VerificationLevel;
    openRequest: VerificationRequest | null;
    lastRequest: VerificationRequest | null;
  };
  reputation: { ratingAverage: number | null; reviewCount: number; followers: number };
  topProducts30d: { title: string; unitsSold: number }[];
};

export const ownerKeys = {
  inbox: (shopId: string, status: InboxFilter, page: number) => ["owner", "bargains", shopId, status, page] as const,
  dashboard: (shopId: string) => ["owner", "dashboard", shopId] as const,
};

// GET /shops/:shopId/bargains (owner, staff or admin of that shop; others get an error from the backend)
export function listShopBargains(
  shopId: string,
  query: { status: InboxFilter; page: number; limit: number },
): Promise<ApiResult<ShopBargain[]>> {
  return api.list<ShopBargain>(`/shops/${encodeURIComponent(shopId)}/bargains`, { query });
}

// GET /dashboard/shop/:shopId (same access rule)
export function getShopDashboard(shopId: string): Promise<ShopDashboard> {
  return api.get<ShopDashboard>(`/dashboard/shop/${encodeURIComponent(shopId)}`);
}