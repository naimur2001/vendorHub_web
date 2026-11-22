"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/app-providers";
import { Link, usePathname } from "@/i18n/routing";
import { ApiError } from "@/lib/api/core";
import { addToWishlist, getWishlistIds, removeFromWishlist, wishlistKeys } from "@/lib/api/wishlist";
import { cn } from "@/lib/utils";

const BASE =
  "relative flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink-secondary hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60";

/** Save / unsave one shop listing. Customers only; guests get a login link; shop teams and admins see nothing. */
export function HeartButton({ listingId, title, className }: { listingId: string; title: string; className?: string }) {
  const t = useTranslations("Wishlist");
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { status, user } = useSession();
  const isCustomer = status === "authenticated" && user?.role === "CUSTOMER";
  const [pops, setPops] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const ids = useQuery({ queryKey: wishlistKeys.ids, queryFn: getWishlistIds, enabled: isCustomer, staleTime: 60_000 });
  const saved = ids.data?.includes(listingId) ?? false;

  const toggle = useMutation({
    mutationFn: (save: boolean) => (save ? addToWishlist(listingId) : removeFromWishlist(listingId)),
    onMutate: async (save) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: wishlistKeys.ids });
      const before = queryClient.getQueryData<string[]>(wishlistKeys.ids);
      queryClient.setQueryData<string[]>(wishlistKeys.ids, (list = []) => (save ? [...list, listingId] : list.filter((id) => id !== listingId)));
      if (save) setPops((n) => n + 1);
      return { before };
    },
    onError: (err, _save, ctx) => {
      queryClient.setQueryData(wishlistKeys.ids, ctx?.before);
      const limit = err instanceof ApiError && err.status === 409;
      setError(limit ? t("limit") : t("error"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

  if (status === "loading" || (status === "authenticated" && !isCustomer)) return null;

  if (!isCustomer) {
    return (
      <Link href={`/auth/login?next=${encodeURIComponent(pathname)}`} aria-label={t("loginToSave", { title })} className={cn(BASE, className)}>
        <Heart className="size-5" aria-hidden />
      </Link>
    );
  }

  return (
    <span className={cn("relative inline-flex flex-col items-end", className)}>
      <button
        type="button"
        onClick={() => toggle.mutate(!saved)}
        disabled={toggle.isPending}
        aria-pressed={saved}
        aria-label={saved ? t("remove", { title }) : t("save", { title })}
        className={cn(BASE, saved && "border-brand text-brand")}
      >
        {/* A new key replays the one-shot pop and the gold burst */}
        <Heart key={pops} className={cn("size-5", saved && "fill-current", pops > 0 && saved && "heart-pop")} aria-hidden />
        {pops > 0 && saved && <span key={`b${pops}`} aria-hidden className="heart-burst pointer-events-none absolute inset-0 rounded-full border-2 border-gold opacity-0" />}
      </button>
      {error && (
        <span role="alert" className="type-caption absolute top-full right-0 mt-1 w-max max-w-48 text-right text-error">
          {error}
        </span>
      )}
    </span>
  );
}
