import "client-only";
import { api } from "./client";
import type { components } from "./schema";

// The shop team's flash deals and coupons. Prices and discounts are always checked again by the server.
export type ShopDeal = components["schemas"]["ShopDeal"];
export type Coupon = components["schemas"]["Coupon"];

export type DealInput = { listingId: string; dealPrice: number; startsAt?: string; endsAt: string; maxQty?: number | null };
export type CouponInput = {
  code: string;
  percentOff?: number;
  amountOff?: number;
  minOrder?: number;
  startsAt?: string;
  endsAt: string;
  maxUses?: number | null;
  perCustomer?: number;
};

export const promoKeys = {
  deals: (shopId: string) => ["owner", "deals", shopId] as const,
  coupons: (shopId: string) => ["owner", "coupons", shopId] as const,
};

const base = (shopId: string) => `/shops/${encodeURIComponent(shopId)}`;

export const listShopDeals = (shopId: string) => api.get<ShopDeal[]>(`${base(shopId)}/deals`);
export const createDeal = (shopId: string, input: DealInput) => api.post<ShopDeal>(`${base(shopId)}/deals`, input);
/** A deal not started yet is deleted; a running one ends now (orders keep their deal price). */
export const endDeal = (shopId: string, dealId: string) => api.delete<unknown>(`${base(shopId)}/deals/${encodeURIComponent(dealId)}`);

export const listCoupons = (shopId: string) => api.get<Coupon[]>(`${base(shopId)}/coupons`);
export const createCoupon = (shopId: string, input: CouponInput) => api.post<Coupon>(`${base(shopId)}/coupons`, input);
export const updateCoupon = (shopId: string, couponId: string, patch: { isActive?: boolean; endsAt?: string; maxUses?: number | null }) =>
  api.patch<Coupon>(`${base(shopId)}/coupons/${encodeURIComponent(couponId)}`, patch);
