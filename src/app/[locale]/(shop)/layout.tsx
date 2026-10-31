import { BottomNav } from "@/components/layout/bottom-nav";
import { TopNav } from "@/components/layout/top-nav";

// Shared frame for all shopping pages: top bar, content, bottom bar on phones.
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav />
      {/* Bottom padding on phones = bottom bar (4rem) + iPhone home bar + breathing room */}
      <main
        id="main"
        className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-10 md:pb-10"
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}