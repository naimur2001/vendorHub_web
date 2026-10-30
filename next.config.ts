import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
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