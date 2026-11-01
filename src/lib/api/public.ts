// Public (no login) API reads that work on the server and in the browser.
// Never sends a token, so it is safe for server-rendered pages shared by everyone.
import { API_PREFIX, API_URL, readResponse, safeFetch, type ApiResult, type Query } from "./core";

// On the server an internal address can be used (e.g. http://127.0.0.1:4000 on the VM).
function baseUrl(): string {
  if (typeof window === "undefined") {
    return (process.env.API_INTERNAL_URL || API_URL).replace(/\/$/, "");
  }
  return API_URL;
}

export async function publicGet<T>(
  path: string,
  query?: Query,
  options: { signal?: AbortSignal } = {},
): Promise<ApiResult<T>> {
  const url = new URL(`${API_PREFIX}${path}`, baseUrl());
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
  }

  const res = await safeFetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options.signal,
    cache: "no-store", // prices and stock change often; always fresh
  });
  return readResponse<T>(res);
}