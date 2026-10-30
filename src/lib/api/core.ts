// Shared by browser and server code. No tokens, no user state here.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
export const API_PREFIX = "/api/v1";

// ---------- Types shared across the app ----------

export type Role = "CUSTOMER" | "SHOP_OWNER" | "SHOP_STAFF" | "ADMIN";

// Same fields as publicUser() in the backend's auth.service.js
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
};

// What login, register and refresh return in cookie mode (no refreshToken in the JSON).
export type Session = {
  user: SessionUser;
  accessToken: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ApiMeta = {
  pagination?: Pagination;
  [key: string]: unknown;
};

export type ApiResult<T> = {
  data: T;
  meta?: ApiMeta;
};

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

// ---------- Errors ----------

// status 0 = the server could not be reached (offline, API down, CORS).
export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

// ---------- Helpers ----------

// buildUrl("/products", { q: "galaxy", page: 2 }) -> http://localhost:4000/api/v1/products?q=galaxy&page=2
// Empty values are left out, so filters can be passed as they are.
export function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${API_PREFIX}${path}`, API_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

// fetch, but a network failure becomes ApiError(0). Cancelled requests are passed through.
export async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function fallbackMessage(status: number): string {
  if (status === 401) return "Please log in.";
  if (status === 403) return "You are not allowed to do this.";
  if (status === 404) return "Not found.";
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  return "Request failed.";
}

// Turns the backend reply into { data, meta } or throws ApiError with the backend's message.
//   success: { success: true, data, meta? }
//   failure: { success: false, error: { message, details } }
export async function readResponse<T>(res: Response): Promise<ApiResult<T>> {
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (res.ok && isObject(body) && body.success === true) {
    return { data: body.data as T, meta: body.meta as ApiMeta | undefined };
  }

  const error = isObject(body) && isObject(body.error) ? body.error : null;
  const message = typeof error?.message === "string" ? error.message : fallbackMessage(res.status);
  throw new ApiError(res.status, message, error?.details);
}