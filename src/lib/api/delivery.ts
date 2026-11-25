import "client-only";
import { api } from "./client";
import type { components } from "./schema";

// Courier delivery (Pathao first). Customers never see courier cost or margin; the courier name
// reaches them only after pickup (the server leaves it null before that).

type S = components["schemas"];
export type CourierProvider = S["CourierProvider"];
export type CourierCode = S["CourierCode"];
export type DeliveryZone = S["DeliveryZone"];
export type DeliveryZoneInput = S["DeliveryZoneInput"];
export type DeliveryZoneCode = S["DeliveryZoneCode"];
export type ShipmentStatus = S["ShipmentStatus"];
export type ShopDeliveryMode = S["ShopDeliveryMode"];
export type DeliveryMetrics = S["DeliveryMetrics"];
export type CustomerShipment = NonNullable<S["CustomerShipment"]>;
export type ShopShipment = NonNullable<S["ShopShipment"]>;
export type AdminShipment = S["AdminShipment"];
export type AdminShipmentDetail = S["AdminShipmentDetail"];
export type CourierLocation = { id: number; name: string };
export type CourierConfig = { deliveryType?: 48 | 12; itemType?: 1 | 2; itemWeight?: number };

export const SHIPMENT_STATUSES: ShipmentStatus[] = ["PENDING", "BOOKED", "PICKUP_ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RETURNING", "RETURNED", "CANCELLED"];

export type RangeFilter = { from?: string; to?: string; providerId?: string; shopId?: string };
export type Ranked = DeliveryMetrics & { shopId?: string; shopName?: string; shopSlug?: string; providerId?: string; providerCode?: CourierCode; providerName?: string };
export type DayPoint = {
  day: string; booked: number; delivered: number; failed: number; customerFees: number; courierCost: number; margin: number; ordersPlaced: number; orderValue: number;
  pricedShipments: number; // booked that day and priced by the courier (cancelled left out)
  pricedMargin: number; // their customer fee minus courier cost
  targetProfit: number | null; // their targets with the CURRENT profit rules (null when none has a rule)
  profitGap: number | null; // pricedMargin minus targetProfit
};
// Profit rules: a target for analysis only. They never change the customer fee or the real margin.
export type ProfitRule = S["DeliveryProfitRule"];
export type ProfitRuleInput = S["DeliveryProfitRuleInput"];
export type ProfitRuleType = S["ProfitRuleType"];
export type ProfitRuleBase = S["ProfitRuleBase"];

const enc = encodeURIComponent;

export const deliveryKeys = {
  couriers: ["admin", "couriers"] as const,
  zones: ["admin", "delivery-zones"] as const,
  cities: ["delivery", "cities"] as const,
  zonesOf: (cityId: number) => ["delivery", "zones", cityId] as const,
  areasOf: (zoneId: number) => ["delivery", "areas", zoneId] as const,
  summary: (f: RangeFilter) => ["admin", "delivery", "summary", f] as const,
  series: (f: RangeFilter) => ["admin", "delivery", "series", f] as const,
  byShop: (f: RangeFilter) => ["admin", "delivery", "by-shop", f] as const,
  byProvider: (f: RangeFilter) => ["admin", "delivery", "by-provider", f] as const,
  shipments: (q: object) => ["admin", "shipments", q] as const,
  shipment: (id: string) => ["admin", "shipment", id] as const,
  profitRules: ["admin", "delivery", "profit-rules"] as const,
};

// Public location lists (cached by the server for 24 hours)
export const listCities = () => api.get<CourierLocation[]>("/delivery/locations/cities");
export const listZones = (cityId: number) => api.get<CourierLocation[]>(`/delivery/locations/cities/${cityId}/zones`);
export const listAreas = (zoneId: number) => api.get<CourierLocation[]>(`/delivery/locations/zones/${zoneId}/areas`);

// Admin: couriers and zones
export const listCouriers = () => api.get<CourierProvider[]>("/admin/couriers");
export const updateCourier = (id: string, patch: { isActive?: boolean; isDefault?: boolean; sandbox?: boolean; config?: CourierConfig }) =>
  api.patch<CourierProvider>(`/admin/couriers/${enc(id)}`, patch);
export const listDeliveryZones = () => api.get<DeliveryZone[]>("/admin/delivery-zones");
export const createDeliveryZone = (input: DeliveryZoneInput) => api.post<DeliveryZone>("/admin/delivery-zones", input);
export const updateDeliveryZone = (id: string, patch: Partial<DeliveryZoneInput>) => api.patch<DeliveryZone>(`/admin/delivery-zones/${enc(id)}`, patch);
export const deleteDeliveryZone = (id: string) => api.delete<unknown>(`/admin/delivery-zones/${enc(id)}`);
export const createCourierStore = (shopId: string, loc?: { courierCityId: number; courierZoneId: number; courierAreaId: number }) =>
  api.post<{ shopId: string; provider: CourierCode; courierStoreId: string | null; state: "READY" | "PENDING_APPROVAL" }>(`/admin/shops/${enc(shopId)}/courier-store`, loc ?? {});

// Admin: monitor
export const getDeliverySummary = (f: RangeFilter) => api.get<DeliveryMetrics & { from: string; to: string; countsByStatus: Record<string, number>; belowTarget: number }>("/admin/delivery/summary", { query: f });
export const getDeliverySeries = (f: RangeFilter) => api.get<{ from: string; to: string; points: DayPoint[] }>("/admin/delivery/timeseries", { query: { ...f, interval: "day" } });
export const getDeliveryByShop = (f: RangeFilter) => api.get<{ items: Ranked[] }>("/admin/delivery/by-shop", { query: f });
export const getDeliveryByProvider = (f: RangeFilter) => api.get<{ items: Ranked[] }>("/admin/delivery/by-provider", { query: f });
export type ShipmentQuery = RangeFilter & { status?: ShipmentStatus; q?: string; stuck?: "true"; page: number };
export const listShipments = (q: ShipmentQuery) => api.list<AdminShipment>("/admin/shipments", { query: { ...q, limit: 20 } });
export const getShipment = (id: string) => api.get<AdminShipmentDetail>(`/admin/shipments/${enc(id)}`);
export const cancelShipment = (id: string) => api.post<unknown>(`/admin/shipments/${enc(id)}/cancel`);
export const rebookShipment = (id: string) => api.post<unknown>(`/admin/shipments/${enc(id)}/rebook`);
export const markCodRemitted = (id: string) => api.post<unknown>(`/admin/shipments/${enc(id)}/mark-cod-remitted`);
export const markShopPaid = (id: string) => api.post<unknown>(`/admin/shipments/${enc(id)}/mark-shop-paid`);

// Admin: profit rules (the most specific active rule wins: zone + courier > zone > courier > all)
export const listProfitRules = () => api.get<ProfitRule[]>("/admin/delivery/profit-rules");
export const createProfitRule = (input: ProfitRuleInput) => api.post<ProfitRule>("/admin/delivery/profit-rules", input);
export const updateProfitRule = (id: string, patch: Partial<ProfitRuleInput>) => api.patch<ProfitRule>(`/admin/delivery/profit-rules/${enc(id)}`, patch);
export const deleteProfitRule = (id: string) => api.delete<unknown>(`/admin/delivery/profit-rules/${enc(id)}`);

// Shop
export const setDeliveryMode = (shopId: string, deliveryMode: ShopDeliveryMode) =>
  api.patch<{ shopId: string; deliveryMode: ShopDeliveryMode; courierReady: boolean }>(`/shops/${enc(shopId)}/delivery-mode`, { deliveryMode });
export const shipOrder = (shopId: string, orderId: string) => api.post<ShopShipment>(`/shops/${enc(shopId)}/orders/${enc(orderId)}/ship`);

/** The 409 code the backend puts in error.details.code. */
export function errorCode(details: unknown): string | null {
  return details && typeof details === "object" && "code" in details && typeof (details as { code: unknown }).code === "string" ? (details as { code: string }).code : null;
}
