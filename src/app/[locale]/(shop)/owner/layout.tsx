import type { ReactNode } from "react";
import { Suspense } from "react";
import { OwnerNav } from "@/components/owner/owner-nav";

// Wraps every page under /owner: the shop tabs on top, then the page itself.
// The minimum height keeps the footer from jumping while a page loads.
export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[70vh] flex-col gap-6">
      {/* The tabs read the current address and ?shop=, which needs a Suspense boundary */}
      <Suspense fallback={<div className="h-12 border-b border-line" aria-hidden />}>
        <OwnerNav />
      </Suspense>
      {children}
    </div>
  );
}