"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { useSession } from "@/components/app-providers";
import { Link, usePathname } from "@/i18n/routing";
import { ApiError } from "@/lib/api/core";
import {
  addToWishlist,
  getWishlistIds,
  removeFromWishlist,
  removeProductFromWishlist,
  wishlistKeys,
  type WishlistIds,
} from "@/lib/api/wishlist";
import { cn } from "@/lib/utils";

const BASE =
  "relative flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink-secondary hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60";

// A shop offer is saved by its listing; a product card saves its best offer and
// counts as saved when any offer of that product is saved.
type Target = { kind: "listing"; listingId: string } | { kind: "product"; productId: string; listingId: string };

const EMPTY: WishlistIds = { listingIds: [], productIds: [] };

function isSaved(ids: WishlistIds | undefined, target: Target): boolean {
  if (!ids) return false;
  return target.kind === "listing" ? ids.listingIds.includes(target.listingId) : ids.productIds.includes(target.productId);
}

function withChange(ids: WishlistIds = EMPTY, target: Target, save: boolean): WishlistIds {
  const productId = target.kind === "product" ? target.productId : null;
  if (save) {
    return {
      listingIds: [...ids.listingIds, target.listingId],
      productIds: productId ? [...ids.productIds, productId] : ids.productIds,
    };
  }
  return {
    listingIds: ids.listingIds.filter((id) => id !== target.listingId),
    productIds: productId ? ids.productIds.filter((id) => id !== productId) : ids.productIds,
  };
}

type ToggleProps = { target: Target; title: string; className?: string; overlay?: boolean };

const noop = () => () => {};

// The heart renders only in the browser: the server can't know who is logged in, and the
// query hooks read the clock, which Next.js does not allow while prerendering a page.
function HeartToggle(props: ToggleProps) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? <HeartToggleLive {...props} /> : null;
}

function HeartToggleLive({ target, title, className, overlay }: ToggleProps) {
  const t = useTranslations("Wishlist");
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { status, user } = useSession();
  const isCustomer = status === "authenticated" && user?.role === "CUSTOMER";
  const [pops, setPops] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const ids = useQuery({ queryKey: wishlistKeys.ids, queryFn: getWishlistIds, enabled: isCustomer, staleTime: 60_000 });
  const saved = isSaved(ids.data, target);

  const toggle = useMutation({
    mutationFn: (save: boolean) => {
      if (save) return addToWishlist(target.listingId);
      return target.kind === "product" ? removeProductFromWishlist(target.productId) : removeFromWishlist(target.listingId);
    },
    onMutate: async (save) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: wishlistKeys.ids });
      const before = queryClient.getQueryData<WishlistIds>(wishlistKeys.ids);
      queryClient.setQueryData<WishlistIds>(wishlistKeys.ids, (current) => withChange(current, target, save));
      if (save) setPops((n) => n + 1);
      return { before };
    },
    onError: (err, _save, ctx) => {
      queryClient.setQueryData(wishlistKeys.ids, ctx?.before);
      setError(err instanceof ApiError && err.status === 409 ? t("limit") : t("error"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

  if (status === "loading" || (status === "authenticated" && !isCustomer)) return null;

  const look = cn(BASE, overlay && "border-transparent bg-card/90 shadow-card backdrop-blur-sm");

  if (!isCustomer) {
    return (
      <Link href={`/auth/login?next=${encodeURIComponent(pathname)}`} aria-label={t("loginToSave", { title })} className={cn(look, className)}>
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
        className={cn(look, saved && "border-brand text-brand")}
      >
        {/* A new key replays the one-shot pop and the gold burst */}
        <Heart key={pops} className={cn("size-5", saved && "fill-current", pops > 0 && saved && "heart-pop")} aria-hidden />
        {pops > 0 && saved && <span key={`b${pops}`} aria-hidden className="heart-burst pointer-events-none absolute inset-0 rounded-full border-2 border-gold opacity-0" />}
      </button>
      {error && (
        <span role="alert" className="type-caption absolute top-full right-0 mt-1 w-max max-w-48 rounded-sm bg-card px-1 text-right text-error">
          {error}
        </span>
      )}
    </span>
  );
}

/** Save / unsave one shop offer. Customers only; guests get a login link; shop teams and admins see nothing. */
export function HeartButton({ listingId, title, className }: { listingId: string; title: string; className?: string }) {
  return <HeartToggle target={{ kind: "listing", listingId }} title={title} className={className} />;
}

/** Product card heart: saves the cheapest available offer; filled when any offer of the product is saved. */
export function ProductHeart({ productId, listingId, title, className }: { productId: string; listingId: string; title: string; className?: string }) {
  return <HeartToggle target={{ kind: "product", productId, listingId }} title={title} className={className} overlay />;
}
