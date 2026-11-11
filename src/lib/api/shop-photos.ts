import "client-only";
import { api } from "./client";

export type ShopPhotoKind = "EXTERIOR" | "SIGNBOARD" | "INTERIOR" | "DISPLAY" | "PANORAMA_360" | "OTHER";
export const PHOTO_KINDS: ShopPhotoKind[] = ["EXTERIOR", "SIGNBOARD", "INTERIOR", "DISPLAY", "PANORAMA_360", "OTHER"];

// present() in shopPhotos.service.js
export type ShopPhoto = { id: string; kind: ShopPhotoKind; caption: string | null; url: string; isCover: boolean; sortOrder: number; verified: boolean };

export const photoKeys = { list: (slug: string) => ["shop-photos", slug] as const };

const base = (shopId: string) => `/shops/${encodeURIComponent(shopId)}/photos`;

export const listShopPhotos = (slug: string) => api.get<ShopPhoto[]>(`/shops/${encodeURIComponent(slug)}/photos`, { auth: false });

// Public image upload (same endpoint as documents, other purpose), then add it to the gallery.
export async function addShopPhoto(shopId: string, file: File, kind: ShopPhotoKind, caption: string): Promise<ShopPhoto> {
  const body = new FormData();
  body.append("file", file);
  const up = await api.post<{ id: string }>("/uploads", body, { query: { purpose: "PUBLIC_IMAGE" } });
  return api.post<ShopPhoto>(base(shopId), { uploadId: up.id, kind, ...(caption && { caption }) });
}

export const makeCover = (shopId: string, photoId: string) => api.patch<ShopPhoto>(`${base(shopId)}/${encodeURIComponent(photoId)}`, { isCover: true });
export const deleteShopPhoto = (shopId: string, photoId: string) => api.delete<unknown>(`${base(shopId)}/${encodeURIComponent(photoId)}`);
export const verifyShopPhoto = (shopId: string, photoId: string, verified: boolean) =>
  api.patch<ShopPhoto>(`/admin/shops/${encodeURIComponent(shopId)}/photos/${encodeURIComponent(photoId)}/verify`, { verified });