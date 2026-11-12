import "client-only";
import { api } from "./client";

export type Interval = "day" | "week" | "month";
export type SalesPoint = { period: string; orders: number; revenue: number };
export type SalesReport = { points: SalesPoint[]; orders: number; revenue: number; average: number };
export type TopReport = {
  shops: { id: string; name: string; slug: string | null; orders: number; revenue: number }[];
  products: { id: string; title: string; slug: string | null; units: number; revenue: number }[];
};

type Raw = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const firstArray = (o: Raw, keys: string[]): Raw[] => {
  for (const k of keys) if (Array.isArray(o[k])) return o[k] as Raw[];
  return [];
};

// The backend counts `to` as exclusive, so one day is added to include the chosen end date.
const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** GET /admin/reports/sales, read defensively (field names may vary slightly). */
export async function getSales(from: string, to: string, interval: Interval): Promise<SalesReport> {
  const r = ((await api.get<Raw>("/admin/reports/sales", { query: { from, to: nextDay(to), interval } })) ?? {}) as Raw;
  const points = firstArray(r, ["points", "series", "rows", "data", "buckets"]).map((p) => ({
    period: str(p.period ?? p.date ?? p.bucket ?? p.label ?? p.start),
    orders: num(p.orders ?? p.orderCount),
    revenue: num(p.revenue ?? p.total),
  }));
  const totals = (r.totals ?? r.summary ?? r) as Raw;
  const orders = num(totals.orders ?? totals.orderCount) || points.reduce((s, p) => s + p.orders, 0);
  const revenue = num(totals.revenue ?? totals.total) || points.reduce((s, p) => s + p.revenue, 0);
  const average = num(totals.averageOrderValue ?? totals.average ?? totals.aov) || (orders ? Math.round(revenue / orders) : 0);
  return { points, orders, revenue, average };
}

/** GET /admin/reports/top */
export async function getTop(from: string, to: string, limit = 10): Promise<TopReport> {
  const r = ((await api.get<Raw>("/admin/reports/top", { query: { from, to: nextDay(to), limit } })) ?? {}) as Raw;
  return {
    shops: firstArray(r, ["topShops", "shops"]).map((s) => {
      const shop = (s.shop as Raw | undefined) ?? s;
      return { id: str(shop.id ?? s.shopId), name: str(shop.name ?? s.name), slug: str(shop.slug ?? s.slug) || null, orders: num(s.orders), revenue: num(s.revenue) };
    }),
    products: firstArray(r, ["topProducts", "products"]).map((p) => {
      const prod = (p.product as Raw | undefined) ?? p;
      return { id: str(prod.id ?? p.productId), title: str(prod.title ?? p.title), slug: str(prod.slug ?? p.slug) || null, units: num(p.units ?? p.unitsSold ?? p.quantity), revenue: num(p.revenue) };
    }),
  };
}