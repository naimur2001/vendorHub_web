import "client-only";
import { api } from "./client";
import type { components } from "./schema";

export type OrderMessage = components["schemas"]["OrderMessage"];
export type ChatState = { messages: OrderMessage[]; unreadCount: number; closed: boolean };

// The customer's own order, or the shop team's view of it (both checked by the backend).
export type ChatScope = { kind: "customer"; orderId: string } | { kind: "shop"; shopId: string; orderId: string };

const base = (s: ChatScope) =>
  s.kind === "customer"
    ? `/orders/${encodeURIComponent(s.orderId)}/messages`
    : `/shops/${encodeURIComponent(s.shopId)}/orders/${encodeURIComponent(s.orderId)}/messages`;

export const chatKeys = { thread: (s: ChatScope) => ["chat", s.kind, s.orderId] as const };

// The latest 100 messages, oldest first.
export function getChat(scope: ChatScope): Promise<ChatState> {
  return api.get<ChatState>(base(scope));
}

// Plain text only (1-1000 characters); shown as text, never as HTML.
export function sendChatMessage(scope: ChatScope, body: string): Promise<OrderMessage> {
  return api.post<OrderMessage>(base(scope), { body });
}

// Marks the other side's messages as read.
export function markChatRead(scope: ChatScope): Promise<unknown> {
  return api.post<unknown>(`${base(scope)}/read`);
}
