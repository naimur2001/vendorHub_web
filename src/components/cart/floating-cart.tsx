"use client";

import { useQuery } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useSession } from "@/components/app-providers";
import { CART_LANDED_EVENT } from "@/components/cart/cart-badge";
import { Link, usePathname } from "@/i18n/routing";
import { cartKeys, getCart } from "@/lib/api/cart";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

type Spot = { side: "left" | "right"; y: number }; // y: share of the screen height (0 top, 1 bottom)

// Kept in memory only (survives moving between pages, not a reload).
let remembered: Spot = { side: "right", y: 0.42 };

const DRAG_START = 6; // px before a press counts as a drag (a shorter one is a tap: open the cart)
const SNAP_MS = 250;
const TOP_GAP = 72; // stay below the top bar
const BOTTOM_GAP = 88; // and above the phone bottom bar

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The cart as a small tab on the edge of the screen: bag + item count on bordeaux, the total under it on ivory.
 * Updates the moment something is added. Drag it anywhere: it snaps to the nearest side
 * (left or right). Arrow keys move it too. Tap / Enter opens the cart.
 */
export function FloatingCart() {
  const t = useTranslations("Cart");
  const locale = useLocale();
  const pathname = usePathname();
  const { status } = useSession();
  const { data } = useQuery({
    queryKey: cartKeys.cart,
    queryFn: getCart,
    enabled: status === "authenticated",
    select: (cart) => cart.totals,
    staleTime: 30_000,
  });
  const count = status === "authenticated" ? (data?.itemCount ?? 0) : 0;
  const total = status === "authenticated" ? (data?.subtotal ?? 0) : 0;

  const ref = useRef<HTMLAnchorElement>(null);
  const [spot, setSpot] = useState<Spot>(remembered);
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const glide = useRef<{ dx: number; dy: number } | null>(null); // where it was dropped, from its new resting place
  const [bumps, setBumps] = useState(0);

  useEffect(() => {
    const onLanded = () => setBumps((n) => n + 1);
    window.addEventListener(CART_LANDED_EVENT, onLanded);
    return () => window.removeEventListener(CART_LANDED_EVENT, onLanded);
  }, []);

  // After a drop: start from where the finger let go and glide to the edge (transform only).
  useLayoutEffect(() => {
    const el = ref.current;
    const from = glide.current;
    glide.current = null;
    if (!el || !from) return;
    el.style.transition = "none";
    el.style.transform = `translate(${from.dx}px, ${from.dy}px)`;
    if (reducedMotion()) {
      el.style.transform = "";
      return;
    }
    void el.offsetWidth; // apply the start position before the transition
    el.style.transition = `transform ${SNAP_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
    el.style.transform = "";
  }, [spot]);

  function move(next: Spot) {
    remembered = next;
    setSpot(next);
  }

  function onPointerDown(e: PointerEvent<HTMLAnchorElement>) {
    if (e.button !== 0) return;
    press.current = { x: e.clientX, y: e.clientY, moved: false };
    justDragged.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.transition = "none";
  }

  function onPointerMove(e: PointerEvent<HTMLAnchorElement>) {
    const p = press.current;
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) < DRAG_START) return;
    p.moved = true;
    e.currentTarget.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function onPointerUp(e: PointerEvent<HTMLAnchorElement>) {
    const p = press.current;
    press.current = null;
    if (!p?.moved) return; // a tap: the link opens the cart
    justDragged.current = true;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const side = rect.left + rect.width / 2 < window.innerWidth / 2 ? "left" : "right";
    const top = Math.min(Math.max(rect.top, TOP_GAP), Math.max(TOP_GAP, window.innerHeight - rect.height - BOTTOM_GAP));
    const restLeft = side === "left" ? 0 : window.innerWidth - rect.width;
    glide.current = { dx: rect.left - restLeft, dy: rect.top - top };
    move({ side, y: top / window.innerHeight });
  }

  function onPointerCancel(e: PointerEvent<HTMLAnchorElement>) {
    press.current = null;
    e.currentTarget.style.transform = "";
  }

  function onKeyDown(e: KeyboardEvent<HTMLAnchorElement>) {
    const step = 0.05;
    const next =
      e.key === "ArrowLeft"
        ? { ...spot, side: "left" as const }
        : e.key === "ArrowRight"
          ? { ...spot, side: "right" as const }
          : e.key === "ArrowUp"
            ? { ...spot, y: Math.max(0, spot.y - step) }
            : e.key === "ArrowDown"
              ? { ...spot, y: Math.min(1, spot.y + step) }
              : null;
    if (!next) return;
    e.preventDefault();
    move(next);
  }

  // The cart and checkout pages show the cart already.
  if (/^\/(cart|checkout)(\/|$)/.test(pathname)) return null;

  const items = t("floatItems", { count });
  const price = formatTaka(total, locale);
  const left = spot.side === "left";

  return (
    <Link
      ref={ref}
      href="/cart"
      aria-label={t("floatLabel", { items, total: price })}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (justDragged.current) {
          e.preventDefault(); // it was moved, not tapped
          justDragged.current = false;
        }
      }}
      onDragStart={(e) => e.preventDefault()} // no browser link-drag ghost
      style={{ top: `clamp(${TOP_GAP}px, ${(spot.y * 100).toFixed(2)}vh, calc(100vh - 7rem - ${BOTTOM_GAP}px))` }}
      className={cn(
        "fixed z-30 flex w-[4.5rem] cursor-grab touch-none flex-col overflow-hidden border border-gold/60 bg-card shadow-modal select-none active:cursor-grabbing md:w-20",
        "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none",
        left ? "left-0 rounded-r-xl border-l-0" : "right-0 rounded-l-xl border-r-0",
      )}
    >
      <span className="flex flex-col items-center gap-1 border-b border-gold bg-brand px-2 pt-2.5 pb-2 text-primary-foreground">
        <ShoppingBag key={bumps} className={cn("size-6 text-gold", bumps > 0 && "badge-bounce")} strokeWidth={1.75} aria-hidden />
        <span className="type-caption leading-tight font-medium whitespace-nowrap">{items}</span>
      </span>
      <span className="type-body-medium flex h-9 items-center justify-center bg-surface px-1 text-[0.8125rem] whitespace-nowrap text-brand tabular-nums">{price}</span>
    </Link>
  );
}
