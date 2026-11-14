"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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

/** Sent on window when something was just added to the cart (after the little photo lands). */
export const CART_LANDED_EVENT = "vh:cart-landed";

/**
 * Small bordeaux circle with the count; hidden when the cart is empty.
 * When an item lands in the cart it bounces once and the number flips up like a counter.
 */
export function CartCountBadge({ count, className }: { count: number; className?: string }) {
  const [bumps, setBumps] = useState(0);

  useEffect(() => {
    const onLanded = () => setBumps((n) => n + 1);
    window.addEventListener(CART_LANDED_EVENT, onLanded);
    return () => window.removeEventListener(CART_LANDED_EVENT, onLanded);
  }, []);

  if (count <= 0) return null;
  return (
    <span
      key={bumps} // a new key restarts the one-shot animations
      aria-hidden
      className={cn(
        "type-caption absolute flex h-5 min-w-5 items-center justify-center overflow-hidden rounded-full bg-brand px-1 leading-none text-primary-foreground ring-2 ring-card",
        bumps > 0 && "badge-bounce",
        className,
      )}
    >
      <span className={cn("block", bumps > 0 && "badge-flip")}>{count > 99 ? "99+" : count}</span>
    </span>
  );
}