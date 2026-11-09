import "client-only";
import type { PaymentMethod, PaymentStatus } from "./checkout";
import { api } from "./client";
import type { ApiResult } from "./core";

export type ReturnStatus = "REQUESTED" | "REJECTED" | "ESCALATED" | "REFUNDED" | "CLOSED";
export type ReturnReason = "DEFECTIVE" | "WRONG_ITEM" | "NOT_AS_DESCRIBED" | "CHANGED_MIND" | "OTHER";
export const RETURN_REASONS: ReturnReason[] = ["DEFECTIVE", "WRONG_ITEM", "NOT_AS_DESCRIBED", "CHANGED_MIND", "OTHER"];
export const RETURN_STATUSES: ReturnStatus[] = ["REQUESTED", "REJECTED", "ESCALATED", "REFUNDED", "CLOSED"];

// Exact shape of present() in returns.service.js
export type ReturnRequest = {
  id: string;
  status: ReturnStatus;
  reason: ReturnReason;
  description: string;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  order: { id: string; orderNumber: string; total: number; paymentMethod: PaymentMethod; paymentStatus: PaymentStatus; completedAt: string };
  shop: { id: string; name: string; slug: string };
  customer: { name: string };
  messages: { id: string; authorRole: "CUSTOMER" | "SHOP" | "ADMIN"; author: string; body: string; createdAt: string }[];
  actions: { respond: boolean; escalate: boolean; resolve: boolean; message: boolean }; // which buttons to show
};

export type ReturnScope = { kind: "mine" } | { kind: "shop"; shopId: string } | { kind: "disputes" };
export type ReturnFilter = ReturnStatus | "ALL";
export type Decision = { decision: "APPROVE" | "REJECT"; note?: string; restock: boolean };

export const returnKeys = {
  list: (scope: ReturnScope, filter: ReturnFilter, page: number) => ["returns", scope, filter, page] as const,
  one: (id: string) => ["return", id] as const,
};

const path = (id: string) => `/returns/${encodeURIComponent(id)}`;

export function listReturns(scope: ReturnScope, filter: ReturnFilter, page: number): Promise<ApiResult<ReturnRequest[]>> {
  const status = filter === "ALL" ? undefined : filter;
  if (scope.kind === "shop") return api.list<ReturnRequest>(`/shops/${encodeURIComponent(scope.shopId)}/returns`, { query: { status, page, limit: 20 } });
  if (scope.kind === "disputes") return api.list<ReturnRequest>("/admin/disputes", { query: { status: filter, page, limit: 20 } });
  return api.list<ReturnRequest>("/returns", { query: { status, page, limit: 20 } });
}

export const getReturn = (id: string) => api.get<ReturnRequest>(path(id));
export const requestReturn = (orderId: string, body: { reason: ReturnReason; description: string }) =>
  api.post<ReturnRequest>(`/orders/${encodeURIComponent(orderId)}/returns`, body);
export const respondReturn = (id: string, d: Decision) => api.post<ReturnRequest>(`${path(id)}/respond`, d);
export const escalateReturn = (id: string, reason: string) => api.post<ReturnRequest>(`${path(id)}/escalate`, { reason });
export const resolveReturn = (id: string, d: Required<Decision>) => api.post<ReturnRequest>(`/admin/returns/${encodeURIComponent(id)}/resolve`, d);
export const addReturnMessage = (id: string, body: string) => api.post<ReturnRequest>(`${path(id)}/messages`, { body });