import "client-only";
import { api } from "./client";

export type TryOnView = "LEFT" | "LEFT_45" | "FRONT" | "RIGHT_45" | "RIGHT";
const ALL: TryOnView[] = ["LEFT", "LEFT_45", "FRONT", "RIGHT_45", "RIGHT"];

export type TryOnInfo = { available: boolean; views: TryOnView[]; startView: TryOnView; createOrder: TryOnView[]; notice: string | null };

const asViews = (v: unknown): TryOnView[] | null =>
  Array.isArray(v) && v.length > 0 && v.every((x) => ALL.includes(x as TryOnView)) ? (v as TryOnView[]) : null;

/** GET /products/:slug/try-on, read defensively (only known view names are used). */
export async function getTryOnInfo(slug: string): Promise<TryOnInfo> {
  const r = (await api.get<Record<string, unknown>>(`/products/${encodeURIComponent(slug)}/try-on`, { auth: false })) ?? {};
  const views = asViews(r.views) ?? ALL;
  const start = ALL.includes(r.startView as TryOnView) ? (r.startView as TryOnView) : "FRONT";
  const order = asViews(r.createOrder) ?? [start, ...views.filter((v) => v !== start)];
  return { available: r.available === true || r.eligible === true, views, startView: start, createOrder: order, notice: typeof r.notice === "string" ? r.notice : null };
}

/** POST /try-on: one picture. Returns a data:image/… URL (kept in memory only). */
export async function createTryOn(productId: string, view: TryOnView, photo: File, reference?: Blob): Promise<string> {
  const body = new FormData();
  body.append("photo", photo);
  if (reference) body.append("reference", reference, "reference.png");
  const r = await api.post<unknown>("/try-on", body, { query: { productId, view } });
  const found = r && typeof r === "object" ? Object.values(r as Record<string, unknown>).find((v) => typeof v === "string" && v.startsWith("data:image/")) : r;
  if (typeof found !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(found)) throw new Error("No picture in the answer");
  return found;
}

export async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}