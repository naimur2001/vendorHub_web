import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

// Runs once per request on the server: picks the locale and loads its messages.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // Dates are always shown in Dhaka time (same as the backend reports).
    // Setting it here also prevents server/browser time-zone mismatches.
    timeZone: "Asia/Dhaka",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});