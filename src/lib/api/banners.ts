import "client-only";
import { api } from "./client";
import type { components } from "./schema";

export type AdminBanner = components["schemas"]["AdminBanner"];
export type BannerListMeta = components["schemas"]["BannerListMeta"];
export type BannerFit = components["schemas"]["BannerFit"];
export type BannerPlacement = components["schemas"]["BannerPlacement"];

// Text fields as the form holds them: "" clears an optional field on the server.
export type BannerInput = {
  titleEn: string;
  titleBn: string;
  subtitleEn: string;
  subtitleBn: string;
  linkUrl: string;
  ctaLabelEn: string;
  ctaLabelBn: string;
  isActive: boolean;
  fit: BannerFit; // COVER fills the frame (may crop), CONTAIN shows the whole image
  placement: BannerPlacement; // HERO = the slider, SIDE_AD = the tall advert beside it
  startsAt: string; // ISO or ""
  endsAt: string; // ISO or ""
};

export const BANNER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const BANNER_MAX_BYTES = 5 * 1024 * 1024;

export const bannerKeys = {
  all: ["admin", "banners"] as const,
  list: (placement: BannerPlacement) => ["admin", "banners", placement] as const,
};

function toForm(input: BannerInput, files: { media?: File | null; mobileMedia?: File | null; removeMobileMedia?: boolean }): FormData {
  const body = new FormData();
  for (const [key, value] of Object.entries(input)) body.append(key, String(value));
  if (files.media) body.append("media", files.media);
  if (files.mobileMedia) body.append("mobileMedia", files.mobileMedia);
  if (files.removeMobileMedia) body.append("removeMobileMedia", "true");
  return body;
}

// All banners (also hidden, scheduled and expired) with meta { total, max }.
export async function listAdminBanners(placement: BannerPlacement): Promise<{ banners: AdminBanner[]; meta: BannerListMeta }> {
  const { data, meta } = await api.list<AdminBanner>("/admin/banners", { query: { placement } });
  const m = meta as Partial<BannerListMeta> | undefined;
  return { banners: data, meta: { total: m?.total ?? data.length, max: m?.max ?? 12 } };
}

export function createBanner(input: BannerInput, media: File, mobileMedia: File | null): Promise<AdminBanner> {
  return api.post<AdminBanner>("/admin/banners", toForm(input, { media, mobileMedia }));
}

export function updateBanner(
  id: string,
  input: BannerInput,
  files: { media?: File | null; mobileMedia?: File | null; removeMobileMedia?: boolean },
): Promise<AdminBanner> {
  return api.patch<AdminBanner>(`/admin/banners/${encodeURIComponent(id)}`, toForm(input, files));
}

// Quick on/off switch from the list (multipart like the full update).
export function setBannerActive(id: string, isActive: boolean): Promise<AdminBanner> {
  const body = new FormData();
  body.append("isActive", String(isActive));
  return api.patch<AdminBanner>(`/admin/banners/${encodeURIComponent(id)}`, body);
}

export function deleteBanner(id: string): Promise<unknown> {
  return api.delete<unknown>(`/admin/banners/${encodeURIComponent(id)}`);
}

export function reorderBanners(ids: string[]): Promise<unknown> {
  return api.patch<unknown>("/admin/banners/reorder", { ids });
}
