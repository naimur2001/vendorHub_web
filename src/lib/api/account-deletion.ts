import "client-only";
import { api } from "./client";
import { ApiError } from "./core";

export function requestDeletion(password: string, reason?: string): Promise<{ deletionScheduledFor: string }> {
  return api.post<{ deletionScheduledFor: string }>("/users/me/deletion", { password, ...(reason && { reason }) });
}

export function cancelDeletion(): Promise<unknown> {
  return api.delete<unknown>("/users/me/deletion");
}

export type Blocker = { code: string; count: number; text: string };

/** 409 blockers: strings ("OPEN_ORDERS") or objects ({ type|code, count, message }). */
export function blockersOf(err: unknown): Blocker[] | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const raw = (err.details as { blockers?: unknown } | undefined)?.blockers;
  if (!Array.isArray(raw)) return null;
  return raw.map((b) => {
    if (typeof b === "string") return { code: b, count: 1, text: b };
    const o = (b ?? {}) as Record<string, unknown>;
    const code = String(o.type ?? o.code ?? "");
    const count = typeof o.count === "number" ? o.count : 1;
    return { code, count, text: typeof o.message === "string" ? o.message : code };
  });
}