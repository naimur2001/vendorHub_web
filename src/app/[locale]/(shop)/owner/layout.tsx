import type { ReactNode } from "react";
import { Suspense } from "react";
import { OwnerNav } from "@/components/owner/owner-nav";

// Wraps every page under /owner: the shop tabs on top, then the page itself.
export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      {/* The tabs read the current address and ?shop=, which needs a Suspense boundary */}
      <Suspense fallback={null}>
        <OwnerNav />
      </Suspense>
      {children}
    </div>
  );
}