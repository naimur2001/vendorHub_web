"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/components/app-providers";
import { cartKeys, getCart } from "@/lib/api/cart";
import { cn } from "@/lib/utils";

/**
 * Number of items in the logged-in user's cart (0 for guests).
 * Shares the cart data with the cart page and "Add to cart", so it updates instantly.
 */
export function useCartCount(): number {
  const { status } = useSession();
  const { data } = useQuery({
    queryKey: cartKeys.cart,
    queryFn: getCart,
    enabled: status === "authenticated",
    select: (cart) => cart.totals.itemCount,
    staleTime: 30_000,
  });
  return status === "authenticated" ? (data ?? 0) : 0;
}

/** Small bordeaux circle with the count; hidden when the cart is empty. */
export function CartCountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "type-caption absolute flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 leading-none text-primary-foreground ring-2 ring-card",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}