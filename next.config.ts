import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Next.js 16.4 defaults from create-next-app
  cacheComponents: true,
  partialPrefetching: true,

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