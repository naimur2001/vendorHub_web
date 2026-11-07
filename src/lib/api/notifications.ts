import "client-only";
import { api } from "./client";

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
};

export const notificationKeys = { count: ["notifications", "count"] as const, list: ["notifications", "list"] as const };

export function getUnreadCount(): Promise<{ unread: number }> {
  return api.get<{ unread: number }>("/notifications/unread-count");
}
export function listNotifications(): Promise<Notification[]> {
  return api.get<Notification[]>("/notifications", { query: { page: 1, limit: 20 } });
}
export function markNotificationRead(id: string): Promise<unknown> {
  return api.post<unknown>(`/notifications/${encodeURIComponent(id)}/read`);
}
export function markAllNotificationsRead(): Promise<unknown> {
  return api.post<unknown>("/notifications/read-all");
}