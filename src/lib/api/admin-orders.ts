import "client-only";
import type { DeliveryMethod, OrderStatus, PaymentMethod, PaymentStatus } from "./checkout";
import { api } from "./client";
import type { ApiResult } from "./core";

export type LateKind = "unconfirmed" | "delivery" | "pickup";
export type LateFilter = LateKind | "any";
export const LATE_KINDS: LateKind[] = ["unconfirmed", "delivery", "pickup"];

export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  shop: { id: string; name: string; slug: string };
  customer: { name: string; phone: string | null };
  status: OrderStatus;
  lateReason: LateKind | null;
  delivery: { method: DeliveryMethod; fee: number; reservedUntil?: string | null; confirmBy?: string | null };
  payment: { method: PaymentMethod; status: PaymentStatus };
  total: number;
  createdAt: string;
  lastStatusAt: string | null;
  openReturn: boolean;
  messageCount: number;
};
export type AdminOrderCounts = { byStatus: Record<OrderStatus, number>; byLate: Record<LateFilter, number> };

export type AdminOrderDetail = Omit<AdminOrderRow, "shop" | "customer" | "delivery"> & {
  completedAt: string | null;
  shopRemindedAt: string | null;
  delivery: { method: DeliveryMethod; address: string | null; fee: number; reservedUntil?: string | null; confirmBy?: string | null };
  items: { id: string; title: string; unitPrice: number; quantity: number; lineTotal: number; bargained: boolean; flashDeal: boolean }[];
  subtotal: number;
  couponCode: string | null;
  discount: number;
  creditUsed: number;
  statusEvents: { status: OrderStatus; note: string | null; actorRole: string | null; actorName: string | null; createdAt: string }[];
  payments: { id: string; provider: string; providerRef: string | null; amount: number; status: string; createdAt: string; callbackAt: string | null }[];
  returns: { id: string; reason: string; description: string | null; status: string; resolutionNote: string | null; createdAt: string }[];
  shop: { id: string; name: string; slug: string; phone: string | null; whatsapp: string | null; addressLine: string; shopNumber: string | null; market: { name: string } | null; owner?: { name: string; email?: string; phone?: string | null } | null };
  customer: { id: string; name: string; email: string; phone: string | null };
  adminNotes: { id: string; body: string; author: { id: string; name: string } | null; createdAt: string }[];
};
export type AdminChat = { readOnly: true; messages: { id: string; senderRole: "CUSTOMER" | "SHOP"; body: string; hidden: boolean; createdAt: string; readAt: string | null }[] };

export type AdminOrderQuery = {
  status?: OrderStatus;
  late?: LateFilter;
  deliveryMethod?: DeliveryMethod;
  paymentStatus?: PaymentStatus;
  q?: string;
  page: number;
};

export const adminOrderKeys = {
  list: (q: AdminOrderQuery) => ["admin", "orders", q] as const,
  detail: (id: string) => ["admin", "order", id] as const,
  chat: (id: string) => ["admin", "order-chat", id] as const,
};

const path = (id: string) => `/admin/orders/${encodeURIComponent(id)}`;

export async function listAdminOrders(q: AdminOrderQuery): Promise<ApiResult<AdminOrderRow[]> & { counts: AdminOrderCounts | null }> {
  const r = await api.list<AdminOrderRow>("/admin/orders", { query: { ...q, limit: 20 } });
  return { ...r, counts: (r.meta as { counts?: AdminOrderCounts } | undefined)?.counts ?? null };
}
export const getAdminOrder = (id: string) => api.get<AdminOrderDetail>(path(id));
export const getAdminChat = (id: string) => api.get<AdminChat>(`${path(id)}/messages`);
export const adminCancelOrder = (id: string, reason: string) => api.post<{ refundNeeded?: boolean }>(`${path(id)}/cancel`, { reason });
export const addAdminNote = (id: string, body: string) => api.post<AdminOrderDetail["adminNotes"][number]>(`${path(id)}/notes`, { body });
export const remindShop = (id: string) => api.post<{ reminded: boolean; recipients: number; nextReminderAt: string }>(`${path(id)}/remind-shop`);
