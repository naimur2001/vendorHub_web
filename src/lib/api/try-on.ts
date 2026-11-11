import "client-only";
import { api } from "./client";

export type TryOnView = "LEFT" | "LEFT_45" | "FRONT" | "RIGHT_45" | "RIGHT";
const ALL: TryOnView[] = ["LEFT", "LEFT_45", "FRONT", "RIGHT_45", "RIGHT"];

export type TryOnInfo = { available: boolean; views: TryOnView[]; startView: TryOnView; createOrder: TryOnView[]; notice: string | null };

const asViews = (v: unknown): TryOnView[] | null =>
  Array.isArray(v) && v.length > 0 && v.every((x) => ALL.includes(x as TryOnView)) ? (v as TryOnView[]) : null;

/** GET /products/:slug/try-on. The backend signals availability with a non-empty `views` list. */
export async function getTryOnInfo(slug: string): Promise<TryOnInfo> {
  const r = (await api.get<Record<string, unknown>>(`/products/${encodeURIComponent(slug)}/try-on`, { auth: false })) ?? {};
  const listed = asViews(r.views); // empty list = not available for this product
  const views = listed ?? ALL;
  const start = ALL.includes(r.startView as TryOnView) ? (r.startView as TryOnView) : "FRONT";
   // Front is always created first (the others use it as a reference).
  const order = [start, ...(asViews(r.createOrder) ?? views).filter((v) => v !== start)];
  const notice = typeof r.notice === "string" ? r.notice : typeof r.note === "string" ? r.note : null;
  return { available: r.available === true || r.eligible === true || listed !== null, views, startView: start, createOrder: order, notice };
}

/** POST /try-on: one picture. Returns a data:image/… URL (kept in memory only). */
/** Finds the picture anywhere in the answer: a data: URL, or base64 + mime type. */
function findPicture(x: unknown, depth = 0): string | null {
  if (depth > 4 || x == null) return null;
  if (typeof x === "string") return /^data:image\/(png|jpeg|webp);base64,/.test(x) ? x : null;
  if (typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const b64 = o.base64 ?? o.data ?? o.imageBase64;
  const mime = o.mimeType ?? o.mime ?? o.contentType;
  if (typeof b64 === "string" && typeof mime === "string" && /^image\/(png|jpeg|webp)$/.test(mime) && /^[A-Za-z0-9+/=]+$/.test(b64.slice(0, 100))) {
    return `data:${mime};base64,${b64}`;
  }
  for (const v of Object.values(o)) {
    const found = findPicture(v, depth + 1);
    if (found) return found;
  }
  return null;
}

/** POST /try-on: one picture. Returns a data:image/… URL (kept in memory only). */
export async function createTryOn(productId: string, view: TryOnView, photo: File, reference?: Blob): Promise<string> {
  const body = new FormData();
  body.append("photo", photo);
  if (reference) body.append("reference", reference, "reference.png");
  const r = await api.post<unknown>("/try-on", body, { query: { productId, view } });
  const picture = findPicture(r);
  if (!picture) throw new Error("No picture in the try-on answer");
  return picture;
}

/** data:image/…;base64,… → Blob, without fetch (our CSP blocks fetch to data: URLs, on purpose). */
export async function dataUrlToBlob(url: string): Promise<Blob> {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(url);
  if (!m) throw new Error("Not an image data URL");
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}