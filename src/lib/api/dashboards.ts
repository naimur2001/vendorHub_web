import "client-only";
import type { OrderStatus, PaymentStatus } from "./checkout";
import { api } from "./client";

// Shapes of customerDashboard() and adminDashboard() in dashboards.service.js
export type CustomerDashboard = {
  orders: {
    total: number;
    totalSpent: number;
    recent: { id: string; orderNumber: string; status: OrderStatus; paymentStatus: PaymentStatus; total: number; createdAt: string; shop: { name: string; slug: string } }[];
  };
  cart: { itemCount: number; shopCount: number };
  bargains: { active: number; waitingForMe: number; acceptedReadyToBuy: number };
  following: number;
  toReview: { orderId: string; shop: { id: string; name: string; slug: string } }[];
};

type Sales = { orders: number; revenue: number };
export type AdminDashboard = {
  users: { total: number; blocked: number; newLast7d: number };
  shops: { total: number; active: number; newLast7d: number };
  orders: { total: number; sales: { last24h: Sales; last7d: Sales; last30d: Sales } };
  verification: { pendingReview: number; autoFlagged: number; waitingForOwner: number; approvedThisWeek: number };
  bargains: { live: number };
  catalog: { products: number; activeListings: number; reviews: number };
  topShops30d: { shopId: string; name: string | null; slug: string | null; orders: number; revenue: number }[];
  recentActivity: { id: string; action: string; actor: string | null; createdAt: string }[];
};

export const getCustomerDashboard = () => api.get<CustomerDashboard>("/dashboard/customer");
export const getAdminDashboard = () => api.get<AdminDashboard>("/dashboard/admin");