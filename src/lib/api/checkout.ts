import "client-only";
import { api } from "./client";
import type { components } from "./schema";

type VerificationLevel = components["schemas"]["VerificationLevel"];
export type OrderStatus = components["schemas"]["OrderStatus"];
export type PaymentStatus = components["schemas"]["PaymentStatus"];

export type DeliveryMethod = "STORE_PICKUP" | "VENDOR_DELIVERY";
export type PaymentMethod = "ONLINE" | "PAY_AT_STORE" | "CASH_ON_DELIVERY";

// Same as the backend (DELIVERY_FEE, taka per shop that delivers). Shown before ordering;
// the confirmation always shows the server's own numbers.
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
  subtotal: number;
  total: number;
  createdAt: string;
  shop: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    levelFloor: string | null;
    shopNumber: string | null;
    addressLine: string;
    verificationLevel: VerificationLevel;
  };
  items: { id: string; title: string; unitPrice: number; quantity: number; lineTotal: number; bargained: boolean }[];
};

export type CheckoutResult = { checkoutId: string; totalAmount: number; createdAt?: string; orders: Order[] };

// Only choices are sent: never prices, items or quantities (the server builds the orders from the cart).
export type ShopChoice = {
  shopId: string;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  deliveryAddress?: string;
};

export const checkoutKeys = {
  checkout: (checkoutId: string) => ["checkout", checkoutId] as const,
  orders: ["orders"] as const,
};

export function placeOrders(shops: ShopChoice[]): Promise<CheckoutResult> {
  return api.post<CheckoutResult>("/checkout", { shops });
}

export function getCheckout(checkoutId: string): Promise<CheckoutResult> {
  return api.get<CheckoutResult>(`/checkouts/${encodeURIComponent(checkoutId)}`);
}

export function payMockOrder(orderId: string): Promise<Order> {
  return api.post<Order>(`/orders/${encodeURIComponent(orderId)}/pay-mock`);
}