import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import en from "../../messages/en.json";
import { routing } from "./routing";

type Messages = Record<string, unknown>;

// Missing Bangla texts fall back to English instead of showing raw keys.
function merge(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" ? merge(base[k] as Messages, v as Messages) : v;
  }
  return out;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages = locale === "en" ? en : merge(en as Messages, (await import(`../../messages/${locale}.json`)).default as Messages);
  return { locale, messages, timeZone: "Asia/Dhaka" };
});