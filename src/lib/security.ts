// Helpers for values that come from the URL or from other users (shop owners, customers).
// Use them every time such a value becomes a link target or a redirect.

const BASE = "https://vendorshub.invalid"; // dummy origin, only used to parse relative paths

/**
 * Where to send the user after login, from ?next=...
 * Only paths on this site are allowed. Blocks open redirects such as
 * "https://evil.com", "//evil.com", "/\evil.com" and "javascript:...".
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || value.length > 2048) return fallback;

  // Must be a single leading slash. "//x" and "/\x" are treated by browsers as another site.
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;

  // No control characters (tabs and newlines can hide a second "/").
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return fallback;
  }

  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Links typed by users (shop website, Facebook page...).
 * Returns the URL only if it is http(s); javascript:, data:, file: and broken values give null.
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Props for every <a> that leaves the site with a user-provided URL:
 * new tab without access to our page (noopener), no referrer, and no SEO credit (nofollow ugc).
 */
export const externalLinkProps = {
  target: "_blank",
  rel: "noopener noreferrer nofollow ugc",
} as const;