import "client-only";
import { api } from "./client";
import type { ApiResult } from "./core";
import type { components } from "./schema";

// Shop subscriptions. Switched OFF for now: every shop can use everything for free, and shop owners
// see nothing about plans. Admins set it up here and switch it on later.

type S = components["schemas"];
export type SubscriptionModule = S["SubscriptionModule"];
export type BillingPeriod = S["BillingPeriod"];
export type SubscriptionStatus = S["SubscriptionStatus"];
export type PaymentMethod = Exclude<S["SubscriptionPaymentMethod"], "ONLINE">; // ONLINE comes with the payment provider
export type SubscriptionPlan = S["SubscriptionPlan"];
export type PlanInput = S["SubscriptionPlanInput"];
export type PlanPatch = S["SubscriptionPlanPatch"];
export type PlanPrice = S["PlanPrice"];
export type SubscriptionRow = S["ShopSubscriptionRow"];
export type SubscriptionPayment = S["SubscriptionPayment"];
export type SubscriptionRequest = S["SubscriptionRequest"];
export type SubscriptionSummary = S["SubscriptionSummary"];
export type ModuleUsage = S["ModuleUsage"] & { module: SubscriptionModule; tracked?: boolean };
export type Entitlements = { enabled: boolean; modules: SubscriptionModule[]; limits: { maxProducts: number | null; maxStaff: number | null; maxActiveDeals: number | null } };
export type SubscriptionSettings = { subscriptionsEnabled: boolean; freeTrialDays: number; graceDays: number };

export const MODULES: SubscriptionModule[] = ["ANALYTICS", "CSV_IMPORT", "PROMOTIONS", "FEATURED_SLOTS", "STAFF_ACCOUNTS", "BARGAINING", "ORDER_CHAT", "COURIER_DELIVERY", "SHOP_PHOTOS_EXTRA", "PRIORITY_SUPPORT"];
export const PERIODS: BillingPeriod[] = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"];
export const STATUSES: SubscriptionStatus[] = ["ACTIVE", "TRIAL", "PAST_DUE", "CANCELLED", "EXPIRED", "FREE"];
export const PAYMENT_METHODS: PaymentMethod[] = ["MANUAL_BKASH", "MANUAL_NAGAD", "CASH", "BANK"];

export type SubscriptionQuery = {
  status?: SubscriptionStatus;
  planId?: string;
  period?: BillingPeriod;
  q?: string;
  expiringInDays?: number;
  unpaid?: "true";
  history?: "true";
  page: number;
};

export const subKeys = {
  settings: ["admin", "subscriptions", "settings"] as const,
  summary: (from: string, to: string) => ["admin", "subscriptions", "summary", from, to] as const,
  list: (q: SubscriptionQuery) => ["admin", "subscriptions", "list", q] as const,
  detail: (id: string) => ["admin", "subscriptions", "detail", id] as const,
  plans: ["admin", "subscriptions", "plans"] as const,
  requests: ["admin", "subscriptions", "requests"] as const,
  usage: ["admin", "subscriptions", "usage"] as const,
  entitlements: (shopId: string) => ["shop", "entitlements", shopId] as const,
  shopPlan: (shopId: string) => ["shop", "subscription", shopId] as const,
};

const enc = encodeURIComponent;

// ---------- Admin ----------
export const getSubSettings = () => api.get<SubscriptionSettings>("/admin/subscriptions/settings");
export const setSubSettings = (patch: Partial<SubscriptionSettings>) => api.patch<SubscriptionSettings>("/admin/subscriptions/settings", patch);
export const getSubSummary = (from: string, to: string) => api.get<SubscriptionSummary>("/admin/subscriptions/summary", { query: { from, to } });
export const getSubUsage = () => api.get<{ since: string; modules: ModuleUsage[] }>("/admin/subscriptions/usage");

export const listPlans = () => api.get<(SubscriptionPlan & { currentShops?: number })[]>("/admin/subscription-plans");
export const createPlan = (input: PlanInput) => api.post<SubscriptionPlan>("/admin/subscription-plans", input);
export const updatePlan = (id: string, patch: PlanPatch) => api.patch<SubscriptionPlan>(`/admin/subscription-plans/${enc(id)}`, patch);
export const deletePlan = (id: string) => api.delete<unknown>(`/admin/subscription-plans/${enc(id)}`);
export const setPlanPrices = (id: string, prices: { period: BillingPeriod; amount: number; isActive: boolean }[]) =>
  api.put<SubscriptionPlan>(`/admin/subscription-plans/${enc(id)}/prices`, { prices });

export function listSubscriptions(q: SubscriptionQuery): Promise<ApiResult<SubscriptionRow[]>> {
  return api.list<SubscriptionRow>("/admin/subscriptions", { query: { ...q, limit: 20 } });
}
export const getSubscription = (id: string) => api.get<SubscriptionRow & { payments: SubscriptionPayment[] }>(`/admin/subscriptions/${enc(id)}`);
export const updateSubscription = (id: string, patch: { cancelAtPeriodEnd?: boolean; status?: SubscriptionStatus; note?: string; extendDays?: number }) =>
  api.patch<SubscriptionRow>(`/admin/subscriptions/${enc(id)}`, patch);
export const startShopPlan = (shopId: string, input: { planId: string; period: BillingPeriod; startsAt?: string; trialDays?: number; note?: string }) =>
  api.post<SubscriptionRow>(`/admin/shops/${enc(shopId)}/subscription`, input);
export const recordPayment = (id: string, input: { amount: number; method: PaymentMethod; reference?: string; paidAt?: string }) =>
  api.post<SubscriptionPayment>(`/admin/subscriptions/${enc(id)}/payments`, input);
export const refundPayment = (id: string, note?: string) => api.post<SubscriptionPayment>(`/admin/subscription-payments/${enc(id)}/refund`, note ? { note } : {});

export const listRequests = () => api.get<SubscriptionRequest[]>("/admin/subscription-requests");
export const approveRequest = (id: string, input: { startsAt?: string; trialDays?: number; note?: string } = {}) =>
  api.post<unknown>(`/admin/subscription-requests/${enc(id)}/approve`, input);
export const rejectRequest = (id: string, note: string) => api.post<unknown>(`/admin/subscription-requests/${enc(id)}/reject`, { note });

// ---------- Shop side ----------
export type ShopSubscriptionView = S["ShopSubscriptionView"];
/** The shop's plan, limits used and the published plans. Only { enabled: false } while subscriptions are off. */
export const getShopSubscription = (shopId: string) => api.get<ShopSubscriptionView>(`/shops/${enc(shopId)}/subscription`);
/** Owner only. 409 REQUEST_PENDING, 400 PLAN_NOT_AVAILABLE; { enabled: false } while off. */
export const requestPlan = (shopId: string, planId: string, period: BillingPeriod) =>
  api.post<SubscriptionRequest | { enabled: false }>(`/shops/${enc(shopId)}/subscription/request`, { planId, period });
/** What this shop may use. While subscriptions are off: enabled false, every module, no limits. */
export const getEntitlements = (shopId: string) => api.get<Entitlements>(`/shops/${enc(shopId)}/entitlements`);

/** 402 PLAN_REQUIRED / 409 PLAN_LIMIT from any shop action (only once subscriptions are switched on). */
export function planProblem(details: unknown): { kind: "required"; module: string } | { kind: "limit"; name: string; limit: number; used: number } | null {
  if (!details || typeof details !== "object") return null;
  const d = details as { code?: unknown; module?: unknown; name?: unknown; limit?: unknown; used?: unknown };
  if (d.code === "PLAN_REQUIRED") return { kind: "required", module: typeof d.module === "string" ? d.module : "" };
  if (d.code === "PLAN_LIMIT" && typeof d.limit === "number" && typeof d.used === "number") return { kind: "limit", name: typeof d.name === "string" ? d.name : "", limit: d.limit, used: d.used };
  return null;
}
