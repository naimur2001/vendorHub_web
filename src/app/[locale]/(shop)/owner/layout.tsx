import type { ReactNode } from "react";
import { Suspense } from "react";
import { OwnerNav } from "@/components/owner/owner-nav";

// Wraps every page under /owner: one width for the tabs and all owner pages,
// so switching tabs never moves the content sideways. The minimum height keeps the footer still.
export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-5xl flex-col gap-6">
      {/* The tabs read the current address and ?shop=, which needs a Suspense boundary */}
      <Suspense fallback={<div className="h-12 border-b border-line" aria-hidden />}>
        <OwnerNav />
      </Suspense>
      {children}
    </div>
  );
}