"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, CircleCheck, LoaderCircle, ShoppingCart } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSession } from "@/components/app-providers";
import { CART_LANDED_EVENT } from "@/components/cart/cart-badge";
import { Link } from "@/i18n/routing";
import { addToCart, cartKeys, type Cart } from "@/lib/api/cart";
import { ApiError } from "@/lib/api/core";
import { safeMediaUrl } from "@/lib/api/storefront";

type Props = {
  listingId: string;
  productSlug: string; // to come back to this product (and this shop) after login
  disabled?: boolean; // out of stock
  image?: string | null; // product photo: a tiny copy flies to the cart icon
};

// Fixed, friendly messages only; the server never reveals stock numbers anyway.
function errorKey(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return "errors.stock";
    if (err.status === 400) return "errors.limit";
    if (err.status === 404) return "errors.gone";
    if (err.status === 429) return "errors.tooMany";
    if (err.status === 0) return "errors.network";
  }
  return "errors.generic";
}

const buttonClass =
  "type-body-medium flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const FLY_MS = 550; // same as .fly-x / .fly-y in globals.css
const DONE_MS = 1400; // how long the button shows the checkmark
const FLY_SIZE = 40;

type Flight = { id: number; left: number; top: number; dx: number; dy: number };

/** Where the flight ends: the cart icon that is on screen (top bar on desktop, bottom bar on phones). */
function visibleCartTarget(): DOMRect | null {
  for (const el of document.querySelectorAll<HTMLElement>("[data-cart-target]")) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  return null;
}

export function AddToCartButton({ listingId, productSlug, disabled = false, image = null }: Props) {
  const t = useTranslations("Cart");
  const { status } = useSession();
  const queryClient = useQueryClient();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [done, setDone] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const photo = safeMediaUrl(image);

  const pendingLand = useRef<(() => void) | null>(null);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((id) => window.clearTimeout(id));
      // Leaving the page mid-flight: the cart still gets its new contents.
      pendingLand.current?.();
    };
  }, []);

  // The cart count changes (and the badge bounces) when the little photo lands on the cart icon.
  function land(cart: Cart) {
    queryClient.setQueryData(cartKeys.cart, cart); // the cart badge updates without another request
    window.dispatchEvent(new Event(CART_LANDED_EVENT));
  }

  function celebrate(cart: Cart) {
    const from = buttonRef.current?.getBoundingClientRect();
    const to = visibleCartTarget();
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm || !from || !to) {
      land(cart);
      return;
    }

    setDone(true);
    const left = from.left + from.width / 2 - FLY_SIZE / 2;
    const top = from.top + from.height / 2 - FLY_SIZE / 2;
    setFlight({
      id: Date.now(),
      left,
      top,
      dx: to.left + to.width / 2 - FLY_SIZE / 2 - left,
      dy: to.top + to.height / 2 - FLY_SIZE / 2 - top,
    });
    pendingLand.current = () => {
      pendingLand.current = null;
      land(cart);
    };
    timers.current.push(
      window.setTimeout(() => {
        setFlight(null);
        pendingLand.current?.();
      }, FLY_MS),
      window.setTimeout(() => setDone(false), DONE_MS),
    );
  }

  const add = useMutation({
    // Only the listing and quantity are sent; the price is decided by the server.
    mutationFn: () => addToCart(listingId, 1),
    onMutate: () => setMessage(null),
    onSuccess: (cart) => {
      setMessage({ kind: "ok", text: t("added") });
      celebrate(cart);
    },
    onError: (err) => setMessage({ kind: "error", text: t(errorKey(err)) }),
  });

  if (status !== "authenticated") {
    const next = `/products/${productSlug}?listing=${listingId}`;
    return (
      <Link
        href={`/auth/login?next=${encodeURIComponent(next)}`}
        aria-disabled={status === "loading" || disabled}
        className={buttonClass}
      >
        <ShoppingCart className="size-5" aria-hidden />
        {t("loginToAdd")}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => add.mutate()}
        disabled={disabled || add.isPending}
        aria-busy={add.isPending}
        className={buttonClass}
      >
        {add.isPending ? (
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
        ) : done ? (
          // Checkmark pops in with a small gold ring burst
          <span className="cart-burst flex">
            <Check className="pop-in size-5" strokeWidth={2.5} aria-hidden />
          </span>
        ) : (
          <ShoppingCart className="size-5" aria-hidden />
        )}
        {add.isPending ? t("adding") : done ? t("added") : t("add")}
      </button>

      {/* A tiny arch (the product photo when there is one) arcs to the cart icon.
          Outer box moves sideways at a steady pace, inner box rises then falls: together, an arc. */}
      {flight &&
        createPortal(
          <span
            key={flight.id}
            aria-hidden
            className="fly-x pointer-events-none fixed z-50"
            style={
              {
                left: flight.left,
                top: flight.top,
                width: FLY_SIZE,
                height: FLY_SIZE,
                "--fly-x": `${flight.dx}px`,
                "--fly-y": `${flight.dy}px`,
                // Cart above (top bar): rush up early. Cart below (bottom bar): hop up first, then fall.
                "--fly-lift": `${flight.dy < 0 ? flight.dy * 0.75 : -56}px`,
              } as CSSProperties
            }
          >
            <span className="fly-y relative block size-full overflow-hidden rounded-t-full rounded-b-sm border border-gold bg-brand shadow-modal">
              {photo && <Image src={photo} alt="" fill unoptimized sizes="40px" className="object-cover" />}
            </span>
          </span>,
          document.body,
        )}

      {message?.kind === "ok" && (
        <p role="status" className="type-body flex items-center gap-2 text-success-ink">
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          {message.text}
          <Link href="/cart" className="type-body-medium text-brand underline-offset-4 hover:underline">
            {t("viewCart")}
          </Link>
        </p>
      )}
      {message?.kind === "error" && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {message.text}
        </p>
      )}
    </div>
  );
}
