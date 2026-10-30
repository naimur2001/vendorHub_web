import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest; Next.js adds the <link rel="manifest"> tag automatically.
// Needed for "Add to Home Screen" and for the Android Play Store wrapper (TWA).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Vendors Hub",
    short_name: "Vendors Hub",
    description: "Find verified physical shops, compare prices and bargain.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F8FAFC",
    theme_color: "#1E293B",
    lang: "en",
    categories: ["shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}