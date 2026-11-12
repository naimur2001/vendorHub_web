import "client-only";
import { api } from "./client";

export type SimilarProduct = {
  slug: string;
  title: string;
  image: string | null;
  lowestPrice: number | null;
  shopCount: number;
  matchPercent: number | null; // 0–100, when the backend sends a score
};

export type PhotoSearchResult = {
  query: string | null; // null = no search words recognised
  label: string;
  categorySlug: string | null;
  products: SimilarProduct[];
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\p{Cc}/gu, "").trim().slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Shrinks the photo in the browser (max 1024 px, JPEG): faster upload, and EXIF/location data is dropped. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.85));
}

/** `match` may be a 0–1 score or a 0–100 percentage; anything else is ignored. */
function toPercent(v: unknown): number | null {
  const n = num(v);
  if (n === null || n < 0) return null;
  return Math.round(n <= 1 ? n * 100 : Math.min(n, 100));
}

/** POST /search/by-image. Everything from the answer is treated as untrusted and cleaned. */
export async function searchByPhoto(file: File): Promise<PhotoSearchResult> {
  const body = new FormData();
  body.append("photo", await shrink(file), "photo.jpg");
  const r = (await api.post<Record<string, unknown>>("/search/by-image", body)) ?? {};

  const query = clean(r.query, 100);
  const cat = r.category as { slug?: unknown } | null | undefined;
  const products = (Array.isArray(r.products) ? (r.products as Record<string, unknown>[]) : [])
    .filter((p) => typeof p.slug === "string" && SLUG.test(p.slug) && typeof p.title === "string")
    .slice(0, 12)
    .map((p) => ({
      slug: p.slug as string,
      title: clean(p.title, 200),
      image: typeof p.thumbnail === "string" ? p.thumbnail : typeof p.image === "string" ? p.image : null,
      lowestPrice: num(p.lowestPrice),
      shopCount: num(p.shopCount) ?? 0,
      matchPercent: toPercent(p.match),
    }));

  return {
    query: query.length >= 2 ? query : null,
    label: clean(r.label, 80),
    categorySlug: typeof cat?.slug === "string" && SLUG.test(cat.slug) ? cat.slug : null,
    products,
  };
}