import "client-only";
import { api } from "./client";
import type { components } from "./schema";

type S = components["schemas"];
export type PublicPopup = S["PublicPopup"];
export type AdminPopup = S["AdminPopup"];
export type PopupAudience = S["PopupAudience"];
export type PopupPages = S["PopupPages"];
export type PopupFrequency = S["PopupFrequency"];
export type PopupStatCounts = S["PopupStatCounts"];
export type PopupStats = { popupId: string; from: string; to: string; totals: PopupStatCounts; days: (PopupStatCounts & { day: string })[] };

export const popupKeys = {
  active: (page: string, lang: string, signedIn: boolean) => ["popup", page, lang, signedIn] as const,
  all: ["admin", "popups"] as const,
  settings: ["admin", "popups", "settings"] as const,
  stats: (id: string, from: string, to: string) => ["admin", "popups", "stats", id, from, to] as const,
};

// ---------- Public ----------

/** The one popup to show on this page, or null. The login token (when there is one) decides the audience. */
export const getActivePopup = (page: string, lang: string) => api.get<PublicPopup | null>("/popups/active", { query: { page, lang } });

/** Anonymous counts. Failures (429 and others) are ignored: they must never bother the visitor. */
export function sendPopupEvent(id: string, type: "VIEW" | "CLOSE" | "CLICK"): void {
  void api.post<unknown>(`/popups/${encodeURIComponent(id)}/events`, { type }, { auth: false }).catch(() => undefined);
}

// ---------- Admin ----------

// Text fields as the form holds them: "" clears an optional field on the server.
export type PopupInput = {
  titleEn: string;
  titleBn: string;
  bodyEn: string;
  bodyBn: string;
  linkUrl: string;
  ctaLabelEn: string;
  ctaLabelBn: string;
  isActive: boolean;
  startsAt: string; // ISO or ""
  endsAt: string; // ISO or ""
  priority: number; // 0-1000, the highest live one wins
  audience: PopupAudience;
  pages: PopupPages;
  frequency: PopupFrequency;
  delaySeconds: number; // 0-30
};

export const POPUP_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const POPUP_MAX_BYTES = 5 * 1024 * 1024;

function toForm(input: Partial<PopupInput>, files: { media?: File | null; mobileMedia?: File | null; removeMobileMedia?: boolean } = {}): FormData {
  const body = new FormData();
  for (const [key, value] of Object.entries(input)) body.append(key, String(value));
  if (files.media) body.append("media", files.media);
  if (files.mobileMedia) body.append("mobileMedia", files.mobileMedia);
  if (files.removeMobileMedia) body.append("removeMobileMedia", "true");
  return body;
}

export const listAdminPopups = () => api.get<AdminPopup[]>("/admin/popups");
export const createPopup = (input: PopupInput, media: File, mobileMedia: File | null) => api.post<AdminPopup>("/admin/popups", toForm(input, { media, mobileMedia }));
export const updatePopup = (id: string, input: Partial<PopupInput>, files?: { media?: File | null; mobileMedia?: File | null; removeMobileMedia?: boolean }) =>
  api.patch<AdminPopup>(`/admin/popups/${encodeURIComponent(id)}`, toForm(input, files));
export const deletePopup = (id: string) => api.delete<unknown>(`/admin/popups/${encodeURIComponent(id)}`);
export const stopPopup = (id: string) => api.post<AdminPopup>(`/admin/popups/${encodeURIComponent(id)}/stop`);
export const getPopupSettings = () => api.get<{ popupsEnabled: boolean }>("/admin/popups/settings");
export const setPopupSettings = (popupsEnabled: boolean) => api.patch<{ popupsEnabled: boolean }>("/admin/popups/settings", { popupsEnabled });
export const getPopupStats = (id: string, from: string, to: string) => api.get<PopupStats>(`/admin/popups/${encodeURIComponent(id)}/stats`, { query: { from, to } });
