import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppProviders } from "@/components/app-providers";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Text and UI: Jost. Headings: Playfair Display (Didone, neo-classical).
// Bangla later: add Noto Sans Bengali (text) and Noto Serif Bengali (headings).
// Self-hosted (no request to Google at build time or in the browser).
const playfair = localFont({
  src: "../../../node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2",
  variable: "--font-playfair",
  weight: "400 900",
  display: "swap",
});

const jost = localFont({
  src: "../../../node_modules/@fontsource-variable/jost/files/jost-latin-wght-normal.woff2",
  variable: "--font-jost",
  weight: "100 900",
  display: "swap",
});



// Bangla letters: used only when the text contains them (the browser loads them on demand).
const bnSans = localFont({
  src: "../../../node_modules/@fontsource-variable/noto-sans-bengali/files/noto-sans-bengali-bengali-wght-normal.woff2",
  variable: "--font-bn-sans",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const bnSerif = localFont({
  src: "../../../node_modules/@fontsource-variable/noto-serif-bengali/files/noto-serif-bengali-bengali-wght-normal.woff2",
  variable: "--font-bn-serif",
  weight: "100 900",
  display: "swap",
  preload: false,
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// Pre-render every locale at build time.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: { default: t("title"), template: `%s · ${t("title")}` },
    description: t("description"),
    applicationName: t("title"),
    // iPhone "Add to Home Screen" (and later the Capacitor app)
    appleWebApp: { capable: true, title: t("title"), statusBarStyle: "default" },
    icons: {
      icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#7A1E2C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Lets pages under this layout render statically.
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${jost.variable} ${playfair.variable} ${bnSans.variable} ${bnSerif.variable}`}>
      <body>
        {/* Translations for client components, then TanStack Query + session. */}
        <NextIntlClientProvider>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}