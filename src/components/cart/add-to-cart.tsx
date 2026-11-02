"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, LoaderCircle, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/app-providers";
import { Link } from "@/i18n/routing";
import { addToCart, cartKeys } from "@/lib/api/cart";
import { ApiError } from "@/lib/api/core";

type Props = {
  listingId: string;
  productSlug: string; // to come back to this product (and this shop) after login
  disabled?: boolean; // out of stock
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

export function AddToCartButton({ listingId, productSlug, disabled = false }: Props) {
  const t = useTranslations("Cart");
  const { status } = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const add = useMutation({
    // Only the listing and quantity are sent; the price is decided by the server.
    mutationFn: () => addToCart(listingId, 1),
    onMutate: () => setMessage(null),
    onSuccess: (cart) => {
      queryClient.setQueryData(cartKeys.cart, cart); // the cart badge updates without another request
      setMessage({ kind: "ok", text: t("added") });
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
        type="button"
        onClick={() => add.mutate()}
        disabled={disabled || add.isPending}
        aria-busy={add.isPending}
        className={buttonClass}
      >
        {add.isPending ? (
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
        ) : (
          <ShoppingCart className="size-5" aria-hidden />
        )}
        {add.isPending ? t("adding") : t("add")}
      </button>

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