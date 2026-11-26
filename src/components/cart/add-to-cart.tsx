"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, CircleCheck, LoaderCircle, ShoppingCart, Zap } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSession } from "@/components/app-providers";
import { CART_LANDED_EVENT } from "@/components/cart/cart-badge";
import { Link, useRouter } from "@/i18n/routing";
import { addToCart, cartKeys, type Cart } from "@/lib/api/cart";
import { ApiError } from "@/lib/api/core";
import { safeMediaUrl } from "@/lib/api/storefront";
import { cn } from "@/lib/utils";

type Props = {
  listingId: string;
  productSlug: string; // to come back to this product (and this shop) after login
  disabled?: boolean; // out of stock
  image?: string | null; // product photo: a tiny copy flies to the cart icon
  buyNow?: boolean; // add, then go straight to checkout
  options?: Record<string, string>; // the chosen variation (size, colour)
  needsChoice?: boolean; // a variation is still missing: the button waits (guests can still tap to log in)
  outline?: boolean; // outlined look (when "Buy now" is the main button)
  compact?: boolean; // smaller button for product cards (no "Added" line under it)
  iconOnly?: boolean; // round cart icon only (product cards); the label is read by screen readers
  chooseHref?: string; // when the listing needs a size / colour: go here to choose it
};

// Fixed, friendly messages only; the server never reveals stock numbers anyway.
function errorKey(err: unknown): string {
  if (err instanceof ApiError) {
    const code = (err.details as { code?: string } | undefined)?.code;
    if (code === "OPTIONS_REQUIRED") return "errors.chooseOptions";
    if (code === "OPTION_OUT_OF_STOCK") return "errors.optionSoldOut";
    if (code === "OPTION_INVALID") return "errors.optionGone";
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

const outlineClass =
  "type-body-medium flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-brand bg-card px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

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

// Card size: a rounded pill, still a 44px touch target; gold icon on the bordeaux button.
const compactClass =
  "h-11 min-w-0 gap-1.5 rounded-full px-3 text-sm whitespace-nowrap shadow-card motion-safe:transition-transform motion-safe:duration-150 active:scale-95 [&_svg]:size-4 [&_svg]:shrink-0";
const compactSolid = "[&_svg]:text-gold";
// Card cart button: a round icon button with a gold ring.
const iconClass =
  "flex size-11 shrink-0 items-center justify-center rounded-full border border-gold bg-card text-brand shadow-card hover:bg-brand hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 motion-safe:transition motion-safe:duration-150 active:scale-95 [&_svg]:size-5";

export function AddToCartButton({
  listingId,
  productSlug,
  disabled = false,
  image = null,
  buyNow = false,
  outline = false,
  options,
  needsChoice = false,
  compact: compactProp = false,
  iconOnly = false,
  chooseHref,
}: Props) {
  const compact = compactProp || iconOnly;
  const t = useTranslations("Cart");
  const { status } = useSession();
  const queryClient = useQueryClient();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [done, setDone] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const photo = safeMediaUrl(image);
  const router = useRouter();
  const look = iconOnly ? iconClass : cn(outline ? outlineClass : buttonClass, compact && compactClass, compact && !outline && compactSolid);
  const label = buyNow ? t("buyNow") : t("add");

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
    mutationFn: () => addToCart(listingId, 1, options),
    onMutate: () => setMessage(null),
    onSuccess: (cart) => {
      if (buyNow) {
        queryClient.setQueryData(cartKeys.cart, cart);
        router.push("/checkout");
        return;
      }
      if (!compact) setMessage({ kind: "ok", text: t("added") });
      celebrate(cart);
    },
    onError: (err) => {
      // A size / colour is needed: open the product page to choose it.
      if (chooseHref && errorKey(err) === "errors.chooseOptions") {
        router.push(chooseHref);
        return;
      }
      setMessage({ kind: "error", text: t(errorKey(err)) });
    },
  });

  // Guests see the same button; tapping it goes to login and comes back to this product.
  if (status !== "authenticated") {
    const next = `/products/${productSlug}?listing=${listingId}`;
    return (
      <Link
        href={`/auth/login?next=${encodeURIComponent(next)}`}
        aria-disabled={status === "loading" || disabled}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        className={cn(look, disabled && "pointer-events-none opacity-50")}
      >
        {buyNow ? <Zap className="size-5" aria-hidden /> : <ShoppingCart className="size-5" aria-hidden />}
        {!iconOnly && <span className="truncate">{label}</span>}
      </Link>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", compact && "relative min-w-0", compact && !iconOnly && "flex-1")}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => add.mutate()}
        disabled={disabled || needsChoice || add.isPending}
        aria-busy={add.isPending}
        aria-label={iconOnly ? (done ? t("added") : label) : undefined}
        title={iconOnly ? label : undefined}
        className={look}
      >
        {add.isPending ? (
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
        ) : done ? (
          // Checkmark pops in with a small gold ring burst
          <span className="cart-burst flex">
            <Check className="pop-in size-5" strokeWidth={2.5} aria-hidden />
          </span>
        ) : buyNow ? (
          <Zap className="size-5" aria-hidden />
        ) : (
          <ShoppingCart className="size-5" aria-hidden />
        )}
        {!iconOnly && (
          <span className="truncate">{buyNow ? (add.isPending ? t("buying") : t("buyNow")) : add.isPending ? t("adding") : done ? t("added") : t("add")}</span>
        )}
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
        <p
          role="alert"
          className={cn(
            "flex items-start gap-2 text-error",
            // On cards: a small note floating under the buttons, so the card does not change size
            compact ? "type-caption absolute top-full right-0 z-20 mt-1 w-44 rounded-sm border border-error/40 bg-card p-2 shadow-modal" : "type-body",
          )}
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {message.text}
        </p>
      )}
    </div>
  );
}
