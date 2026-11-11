import "client-only";
import { api } from "./client";

export type ShopUpdate = {
  name?: string;
  description?: string | null;
  marketId?: string | null;
  levelFloor?: string | null;
  shopNumber?: string | null;
  addressLine?: string;
  latitude?: number | null;
  longitude?: number | null;
  supportsDelivery?: boolean;
  supportsPickup?: boolean;
  returnPolicy?: string | null;
  returnWindowDays?: number;
};

export type StaffMember = { userId: string; name: string; email: string; role?: string; membership?: string };

const base = (shopId: string) => `/shops/${encodeURIComponent(shopId)}`;

export function updateShop(shopId: string, patch: ShopUpdate): Promise<unknown> {
  return api.patch<unknown>(base(shopId), patch);
}

// Logo and banner: one real image file, checked and re-drawn by the server.
export function uploadShopImage(shopId: string, kind: "logo" | "banner", file: File): Promise<unknown> {
  const body = new FormData();
  body.append("image", file);
  return api.put<unknown>(`${base(shopId)}/${kind}`, body);
}
export function removeShopImage(shopId: string, kind: "logo" | "banner"): Promise<unknown> {
  return api.delete<unknown>(`${base(shopId)}/${kind}`);
}

type Raw = Record<string, unknown>;

// One entry per person; accepts a plain list or { owner, staff: [...] }, with or without a nested `user`.
function toMember(x: Raw, role?: string): StaffMember {
  const u = (x.user as Raw | undefined) ?? x;
  return {
    userId: String(x.userId ?? u.id ?? ""),
    name: String(u.name ?? ""),
    email: String(u.email ?? ""),
    role: role ?? (x.role as string | undefined) ?? (x.membership as string | undefined),
  };
}

export async function listStaff(shopId: string): Promise<StaffMember[]> {
  const r = await api.get<unknown>(`${base(shopId)}/staff`);
  if (Array.isArray(r)) return (r as Raw[]).map((x) => toMember(x));
  const o = (r ?? {}) as { owner?: Raw; staff?: Raw[] };
  return [...(o.owner ? [toMember(o.owner, "OWNER")] : []), ...(o.staff ?? []).map((x) => toMember(x, "STAFF"))];
}
export function addStaff(shopId: string, email: string): Promise<unknown> {
  return api.post<unknown>(`${base(shopId)}/staff`, { email });
}
export function removeStaff(shopId: string, userId: string): Promise<unknown> {
  return api.delete<unknown>(`${base(shopId)}/staff/${encodeURIComponent(userId)}`);
}