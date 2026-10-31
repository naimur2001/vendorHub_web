import type { Metadata, Viewport } from "next";
import { Jost, Playfair_Display } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppProviders } from "@/components/app-providers";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Text and UI: Jost. Headings: Playfair Display (Didone, neo-classical).
// Bangla later: add Noto Sans Bengali (text) and Noto Serif Bengali (headings).
const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
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
    <html lang={locale} className={`${jost.variable} ${playfair.variable}`}>
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