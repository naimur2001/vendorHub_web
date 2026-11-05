import type { Metadata } from "next";
import { NotFoundView } from "@/components/not-found-view";

// Shown for every unknown address and every notFound() inside a page. Never indexed.
export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return <NotFoundView />;
}