import { BottomNav } from "@/components/layout/bottom-nav";
import { FloatingCart } from "@/components/cart/floating-cart";
import { SiteFooter } from "@/components/layout/site-footer";
import { TopNav } from "@/components/layout/top-nav";
import { VerifyBanner } from "@/components/auth/email-verification";
import { DeletionGate } from "@/components/account/deletion-gate";
import { WelcomePopup } from "@/components/layout/welcome-popup";
import { Suspense } from "react";
// Shared frame for all shopping pages: top bar, content, bottom bar on phones.
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav />
      <VerifyBanner />
      <DeletionGate />
      {/* The footer below carries the extra room for the phone bottom bar */}
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-10 md:px-10">
        {children}
      </main>
      <SiteFooter />
      <BottomNav />
      {/* The cart tab on the edge of the screen (drag it to either side) */}
      <Suspense fallback={null}>
        <FloatingCart />
      </Suspense>
      {/* The admin's welcome poster (reads the time for "once a day", so it sits in Suspense) */}
      <Suspense fallback={null}>
        <WelcomePopup />
      </Suspense>
    </div>
  );
}