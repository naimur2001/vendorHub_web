import "client-only";
import { api } from "./client";
import type { ApiResult } from "./core";
import type { components } from "./schema";

type VerificationLevel = components["schemas"]["VerificationLevel"];
export type OrderStatus = components["schemas"]["OrderStatus"];
export type PaymentStatus = components["schemas"]["PaymentStatus"];

// RESERVE_PICKUP: held for 2 hours, the shop confirms within 30 minutes, paid at the store.
export type DeliveryMethod = "STORE_PICKUP" | "VENDOR_DELIVERY" | "RESERVE_PICKUP";
export type PaymentMethod = "ONLINE" | "PAY_AT_STORE" | "CASH_ON_DELIVERY";

export const ORDER_STATUSES: OrderStatus[] = [
  "PLACED",
  "CONFIRMED",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
  "CANCELLED",
];


// Own-delivery shops only (the backend OWN_DELIVERY_FEE); courier fees come from GET /cart?addressId=.
export const DELIVERY_FEE = 60;

// Exact shape of formatOrder() in checkout.service.js
export type Order = {
  id: string;
  orderNumber: string;
  checkoutId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  deliveryMethod: DeliveryMethod;
  deliveryAddress: string | null;
  deliveryFee: number;
  reservedUntil?: string | null; // RESERVE_PICKUP: cancelled if not picked up by then
  confirmBy?: string | null; // RESERVE_PICKUP: the shop must confirm by then
  unreadCount?: number; // order lists only: chat messages from the shop not read yet
  subtotal: number;
  discount?: number; // coupon discount on the items (computed by the server)
  couponCode?: string | null;
  creditUsed?: number; // referral credit spent on this order
  total: number;
  createdAt: string;
  shop: {
    id: string;
    name: string;
    slug: string;
    phone: string | null; // null for shops created before phones were required
    logoUrl: string | null;
    levelFloor: string | null;
    shopNumber: string | null;
    addressLine: string;
    verificationLevel: VerificationLevel;
  };
  items: { id: string; title: string; unitPrice: number; quantity: number; lineTotal: number; bargained: boolean; productId?: string; productSlug?: string }[];

};

export type CheckoutResult = { checkoutId: string; totalAmount: number; createdAt?: string; orders: Order[] };

// Only choices are sent: never prices, items or quantities (the server builds the orders from the cart).
export type ShopChoice = {
  shopId: string;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  deliveryAddress?: string;
  addressId?: string; // a saved address (required for Vendors Hub courier delivery); the server builds the address text and the fee
  couponCode?: string; // the server checks it and computes the discount
};

export const checkoutKeys = {
  checkout: (checkoutId: string) => ["checkout", checkoutId] as const,
  orders: (status: OrderStatus | undefined, page: number) => ["orders", status ?? "ALL", page] as const,
};

// The key makes a retry return the first result instead of creating the orders twice.
export function placeOrders({ shops, key, useCredit = false }: { shops: ShopChoice[]; key: string; useCredit?: boolean }): Promise<CheckoutResult> {
  // useCredit: the server spends referral credit, at most 20% of each order's items after a coupon
  return api.post<CheckoutResult>("/checkout", { shops, useCredit }, { headers: { "Idempotency-Key": key } });
}

export function getCheckout(checkoutId: string): Promise<CheckoutResult> {
  return api.get<CheckoutResult>(`/checkouts/${encodeURIComponent(checkoutId)}`);
}

export function payMockOrder(orderId: string): Promise<Order> {
  return api.post<Order>(`/orders/${encodeURIComponent(orderId)}/pay-mock`);
}

// The logged-in customer's own orders (the backend never returns anyone else's).
export function listOrders(query: { status?: OrderStatus; page: number; limit: number }): Promise<ApiResult<Order[]>> {
  return api.list<Order>("/orders", { query });
}


// The customer cancels their own order (only while PLACED; the backend checks both).
export function cancelOrder(orderId: string, reason?: string): Promise<Order> {
  return api.post<Order>(`/orders/${encodeURIComponent(orderId)}/cancel`, reason ? { reason } : {});
}
// One saved status change (oldest first). No ids or user data.
export type OrderStatusEvent = components["schemas"]["OrderStatusEvent"];
// shipment: courier orders only (else null). Courier name and tracking code stay null until pickup.
export type OrderDetail = Order & { statusEvents: OrderStatusEvent[]; shipment?: import("./delivery").CustomerShipment | null };

export const orderKeys = {
  detail: (orderId: string) => ["order", orderId] as const,
};

// The logged-in customer's own order with its tracking timeline (404 for anyone else's).
export function getOrder(orderId: string): Promise<OrderDetail> {
  return api.get<OrderDetail>(`/orders/${encodeURIComponent(orderId)}`);
}
