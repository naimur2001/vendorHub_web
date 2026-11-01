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

export type PublicGetOptions = {
  signal?: AbortSignal;
  // true (default): always ask the API. false: let a surrounding "use cache" decide.
  fresh?: boolean;
};

export async function publicGet<T>(
  path: string,
  query?: Query,
  { signal, fresh = true }: PublicGetOptions = {},
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
    signal,
    ...(fresh && { cache: "no-store" as const }), // prices and stock change often
  });
  return readResponse<T>(res);
}