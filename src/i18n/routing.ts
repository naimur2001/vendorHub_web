import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

// Add "bn" here (plus messages/bn.json) when the Bangla translation is ready.
export const routing = defineRouting({
  locales: ["en"],
  defaultLocale: "en",
  // English at plain URLs (/auth/login), other languages prefixed (/bn/auth/login).
  localePrefix: "as-needed",
  // Do not switch language from the browser's Accept-Language; the user picks it.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

// Locale-aware versions of Link, redirect, useRouter, usePathname.
// Use these everywhere instead of the ones from "next/link" / "next/navigation".
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);