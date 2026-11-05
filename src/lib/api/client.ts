import "client-only";
import {
  API_PREFIX,
  API_URL,
  ApiError,
  buildUrl,
  readResponse,
  safeFetch,
  type ApiResult,
  type Query,
  type Session,
  type SessionUser,
} from "./core";

// Required on login, register, refresh and logout so the backend uses the httpOnly cookie.
// Another website cannot send this header (CORS), which is the CSRF protection.
const COOKIE_MODE_HEADERS = { "X-Auth-Mode": "cookie" };

// ---------- Session state (memory only, gone on reload; refresh brings it back) ----------

let accessToken: string | null = null;
let currentUser: SessionUser | null = null;
const listeners = new Set<(user: SessionUser | null) => void>();

function emit() {
  for (const listener of listeners) listener(currentUser);
}

export function getSessionUser(): SessionUser | null {
  return currentUser;
}

// The SessionProvider listens here, so React re-renders on login, logout and expiry.
export function subscribeSession(listener: (user: SessionUser | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setSession(session: Session | null): void {
  accessToken = session?.accessToken ?? null;
  currentUser = session?.user ?? null;
  emit();
}

// After editing the profile (name, phone, avatar) without a new token.
export function updateSessionUser(user: SessionUser): void {
  if (!accessToken) return;
  currentUser = user;
  emit();
}

// ---------- Refresh (single flight + cross-tab lock) ----------

let refreshing: Promise<Session | null> | null = null;

async function requestRefresh(): Promise<Session | null> {
  const res = await safeFetch(buildUrl("/auth/refresh"), {
    method: "POST",
    credentials: "include",
    headers: COOKIE_MODE_HEADERS,
  });

  // 401 = no cookie, or an expired / revoked one (the backend also deletes it). Not an error: just a guest.
  if (res.status === 401 || res.status === 403) {
    setSession(null);
    return null;
  }

  const { data } = await readResponse<Session>(res);
  setSession(data);
  return data;
}

// The browser lock makes tabs refresh one after another (each refresh rotates the cookie).
// `await` also unwraps the nested promise type that TypeScript gives navigator.locks.request.
async function refreshWithLock(): Promise<Session | null> {
  if (typeof navigator !== "undefined" && "locks" in navigator) {
    return await navigator.locks.request("vh-auth-refresh", () => requestRefresh());
  }
  return requestRefresh();
}

// Inside this tab: every caller shares the one refresh that is already running.
export function refreshSession(): Promise<Session | null> {
  if (refreshing) return refreshing;

  const run = refreshWithLock().finally(() => {
    refreshing = null;
  });
  refreshing = run;
  return run;
}

// ---------- Requests ----------

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Query;
  body?: unknown; // plain object -> JSON; FormData -> multipart (uploads)
  signal?: AbortSignal;
  auth?: boolean; // send the access token and refresh once on 401 (default true)
  cookieMode?: boolean; // login / register / logout: send and receive the session cookie
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = "GET", query, body, signal, auth = true, cookieMode = false } = options;

  // On page load the first refresh may still be running: wait so this request carries the token.
  if (auth && refreshing) await refreshing.catch(() => null);

  const send = (token: string | null) => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (cookieMode) Object.assign(headers, COOKIE_MODE_HEADERS);
    if (auth && token) headers.Authorization = `Bearer ${token}`;

    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
      payload = body; // the browser sets the multipart Content-Type itself
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }

    return safeFetch(buildUrl(path, query), {
      method,
      headers,
      body: payload,
      signal,
      credentials: cookieMode ? "include" : "same-origin",
    });
  };

  const sentToken = auth ? accessToken : null;
  let res = await send(sentToken);

  // Token expired (15 min): refresh once, then retry. A 401 without a token means "log in first".
  if (res.status === 401 && sentToken) {
    // Another request may already have refreshed while this one was on its way.
    const fresh =
      accessToken && accessToken !== sentToken
        ? accessToken
        : ((await refreshSession().catch(() => null))?.accessToken ?? null);

    if (fresh) res = await send(fresh);
  }

  return readResponse<T>(res);
}

type NoBody = Omit<RequestOptions, "method" | "body">;

// Short forms that return only `data`. Use apiRequest / api.list when you need meta.pagination.
export const api = {
  get: <T>(path: string, options?: NoBody) =>
    apiRequest<T>(path, { ...options, method: "GET" }).then((r) => r.data),
  list: <T>(path: string, options?: NoBody) => apiRequest<T[]>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: NoBody) =>
    apiRequest<T>(path, { ...options, method: "POST", body }).then((r) => r.data),
  patch: <T>(path: string, body?: unknown, options?: NoBody) =>
    apiRequest<T>(path, { ...options, method: "PATCH", body }).then((r) => r.data),
  put: <T>(path: string, body?: unknown, options?: NoBody) =>
    apiRequest<T>(path, { ...options, method: "PUT", body }).then((r) => r.data),
  delete: <T>(path: string, options?: NoBody) =>
    apiRequest<T>(path, { ...options, method: "DELETE" }).then((r) => r.data),
};

export { ApiError };


// ---------- Private files (verification documents) ----------

/** True only for files served by our own API at /api/v1/files/... */
export function isPrivateFileUrl(fileUrl: string): boolean {
  try {
    const url = new URL(fileUrl, API_URL);
    return url.origin === new URL(API_URL).origin && url.pathname.startsWith(`${API_PREFIX}/files/`);
  } catch {
    return false;
  }
}

/**
 * Downloads a private file with the login token and returns it as a Blob (kept in memory only).
 * The token is only ever sent to our own API's /files/ address, never to another site.
 */
export async function fetchPrivateFile(fileUrl: string, signal?: AbortSignal): Promise<Blob> {
  if (!isPrivateFileUrl(fileUrl)) throw new ApiError(400, "Not a Vendors Hub file");
  const url = new URL(fileUrl, API_URL).toString();

  // On page load the first refresh may still be running: wait so this request carries the token.
  if (refreshing) await refreshing.catch(() => null);

  const send = (token: string | null) =>
    safeFetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal,
      credentials: "same-origin",
      cache: "no-store", // private documents are never stored by the browser cache
    });

  const sentToken = accessToken;
  let res = await send(sentToken);

  // Token expired: refresh once, then retry (same rule as apiRequest).
  if (res.status === 401 && sentToken) {
    const fresh =
      accessToken && accessToken !== sentToken
        ? accessToken
        : ((await refreshSession().catch(() => null))?.accessToken ?? null);
    if (fresh) res = await send(fresh);
  }

  if (!res.ok) await readResponse(res); // throws ApiError with the backend's message
  return res.blob();
}