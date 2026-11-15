import "client-only";
import { api } from "./client";

export type SimilarProduct = {
  slug: string;
  title: string;
  image: string | null;
  lowestPrice: number | null;
  shopCount: number;
  matchPercent: number; // 70–100, from the backend's score
};

export type PhotoSearchResult = {
  query: string | null; // null = no search words recognised
  label: string;
  categorySlug: string | null;
  products: SimilarProduct[];
};

// The API always answers with its 12 closest products, however far away they are. Its `score`
// (0 to 1; the same photo scores 1) is about 0.64 for products that have nothing to do with the
// photo, so only clearly closer ones are shown.
const MIN_SCORE = 0.7;

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

/** POST /search/by-image. Everything from the answer is treated as untrusted and cleaned. */
export async function searchByPhoto(file: File): Promise<PhotoSearchResult> {
  const body = new FormData();
  body.append("photo", await shrink(file), "photo.jpg");
  const r = (await api.post<Record<string, unknown>>("/search/by-image", body)) ?? {};

  const query = clean(r.query, 100);
  const cat = r.category as { slug?: unknown } | null | undefined;
  const products = (Array.isArray(r.products) ? (r.products as Record<string, unknown>[]) : [])
    .filter((p) => typeof p.slug === "string" && SLUG.test(p.slug) && typeof p.title === "string")
    .filter((p) => (num(p.score) ?? 0) >= MIN_SCORE)
    .sort((a, b) => (num(b.score) ?? 0) - (num(a.score) ?? 0))
    .slice(0, 12)
    .map((p) => ({
      slug: p.slug as string,
      title: clean(p.title, 200),
      image: typeof p.thumbnail === "string" ? p.thumbnail : typeof p.image === "string" ? p.image : null,
      lowestPrice: num(p.lowestPrice),
      shopCount: num(p.shopCount) ?? 0,
      matchPercent: Math.round(Math.min(num(p.score) ?? 0, 1) * 100),
    }));

  return {
    query: query.length >= 2 ? query : null,
    label: clean(r.label, 80),
    categorySlug: typeof cat?.slug === "string" && SLUG.test(cat.slug) ? cat.slug : null,
    products,
  };
}