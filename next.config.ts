import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");
const apiOrigin = apiUrl.origin;

// Content-Security-Policy: what the browser may load or contact from our pages.
// 'unsafe-inline' for scripts: Next.js inlines small bootstrap scripts; a nonce policy would
// force every page to be dynamic. Revisit before launch. 'unsafe-eval' only in dev (React dev tools).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${apiOrigin}`, // add the media/CDN origin here when uploads move there
  "font-src 'self' data:", // next/font serves Google fonts from our own origin
  `connect-src 'self' ${apiOrigin}${isDev ? " ws: wss:" : ""}`, // API only (+ hot reload in dev)
  "media-src 'self' blob:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Only when the API is on HTTPS; otherwise local `npm run start` would break API calls.
  ...(apiUrl.protocol === "https:" ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HTTPS only from the first visit on. Add includeSubDomains once every subdomain has HTTPS.
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]),
];

const nextConfig: NextConfig = {
  // Next.js 16.4 defaults from create-next-app
  cacheComponents: true,
  partialPrefetching: true,

  // Do not advertise the framework in the X-Powered-By header.
  poweredByHeader: false,

  // Tailwind CSS v4 runs as a Turbopack loader in this project (there is no postcss.config.mjs).
  // Without this, @theme / @utility / @apply and @import "tw-animate-css" are not processed.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Browsers must always check for a new service worker, never use a cached copy.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },

  async redirects() {
    return [
      // The backend mails reset links as APP_URL/reset-password?token=...
      // Our screen lives at /auth/reset-password. The query string (?token=) is kept.
      {
        source: "/reset-password",
        destination: "/auth/reset-password",
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);