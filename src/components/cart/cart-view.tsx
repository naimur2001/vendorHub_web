"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle, MapPin, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/app-providers";
import { VerificationSeal } from "@/components/brand/verification-seal";
import { AvailabilityBadge } from "@/components/catalog/availability-badge";
import { CategoryIcon } from "@/components/catalog/product-card";
import { Link } from "@/i18n/routing";
import {
  cartKeys,
  clearCart,
  getCart,
  MAX_QTY_PER_ITEM,
  removeCartItem,
  updateCartItem,
  type Cart,
  type CartGroup,
  type CartItem,
} from "@/lib/api/cart";
import { ApiError } from "@/lib/api/core";
import { safeMediaUrl, shopPlace } from "@/lib/api/storefront";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

type ItemError = { itemId: string | null; text: string } | null;

function errorKey(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400) return "updateErrors.limit";
    if (err.status === 409) return "updateErrors.stock";
    if (err.status === 0) return "updateErrors.network";
  }
  return "updateErrors.generic";
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

const panel = "flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center";
const primaryButton =
  "type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none";

export function CartView() {
  const t = useTranslations("Cart");
  const locale = useLocale();
  const { status } = useSession();
  const queryClient = useQueryClient();
  const [error, setError] = useState<ItemError>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const cart = useQuery({ queryKey: cartKeys.cart, queryFn: getCart, enabled: status === "authenticated" });

  // The server's answer is always the truth: totals and prices are never computed here.
  function showCart(data: Cart) {
    queryClient.setQueryData(cartKeys.cart, data);
    setError(null);
  }

  function showError(err: unknown, itemId: string | null) {
    if (err instanceof ApiError && err.status === 404) {
      // Item already removed (e.g. in another tab): just refresh quietly.
      void queryClient.invalidateQueries({ queryKey: cartKeys.cart });
      return;
    }
    setError({ itemId, text: t(errorKey(err)) });
  }

  const update = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => updateCartItem(itemId, quantity),
    onSuccess: showCart,
    onError: (err, vars) => showError(err, vars.itemId),
  });
  const remove = useMutation({
    mutationFn: (itemId: string) => removeCartItem(itemId),
    onSuccess: showCart,
    onError: (err, itemId) => showError(err, itemId),
  });
  const clear = useMutation({
    mutationFn: clearCart,
    onSuccess: (data) => {
      showCart(data);
      setConfirmClear(false);
    },
    onError: (err) => showError(err, null),
  });

  const busyItemId = update.isPending ? update.variables?.itemId : remove.isPending ? remove.variables : undefined;

  if (status === "loading" || (status === "authenticated" && cart.isPending)) {
    return (
      <p role="status" className="type-body flex items-center justify-center gap-2 py-12 text-ink-secondary">
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
        {t("loading")}
      </p>
    );
  }

  if (status === "guest") {
    return (
      <div className={panel}>
        <ShoppingCart className="size-10 text-highlight" strokeWidth={1.5} aria-hidden />
        <h2 className="type-h3 text-ink">{t("guestTitle")}</h2>
        <p className="type-body max-w-sm text-ink-secondary">{t("guestText")}</p>
        <Link href={`/auth/login?next=${encodeURIComponent("/cart")}`} className={primaryButton}>
          {t("logIn")}
        </Link>
      </div>
    );
  }

  if (cart.isError || !cart.data) {
    return (
      <div role="alert" className={panel}>
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => cart.refetch()} className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand hover:bg-subtle">
          {t("retry")}
        </button>
      </div>
    );
  }

  const { shops, totals } = cart.data;

  if (shops.length === 0) {
    return (
      <div className={cn(panel, "rise-stagger")}>
        {/* Empty cart: the icon pops in with one gold ring, the lines rise in after it */}
        <span className="ring-burst flex">
          <ShoppingCart className="pop-in size-10 text-highlight" strokeWidth={1.5} aria-hidden />
        </span>
        <h2 className="type-h3 text-ink">{t("emptyTitle")}</h2>
        <p className="type-body text-ink-secondary">{t("emptyText")}</p>
        <Link href="/search" className={primaryButton}>
          {t("startShopping")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
      {/* Shop cards rise in one after another */}
      <div className="rise-stagger flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="type-body-medium text-ink">{t("summaryLine", { items: totals.itemCount, shops: totals.shopCount })}</p>
          <p className="type-caption text-ink-muted">{t("independentNote")}</p>
        </div>

        {shops.map((group) => (
          <ShopGroup
            key={group.shop.id}
            group={group}
            locale={locale}
            busyItemId={busyItemId}
            error={error}
            onQuantity={(item, quantity) => update.mutate({ itemId: item.id, quantity })}
            onRemove={(item) => remove.mutate(item.id)}
            removingItemId={remove.isPending ? remove.variables : undefined}
          />
        ))}

        {error && error.itemId === null && (
          <p role="alert" className="type-body flex items-center gap-2 text-error">
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            {error.text}
          </p>
        )}

        <button
          type="button"
          onClick={() => (confirmClear ? clear.mutate() : setConfirmClear(true))}
          onBlur={() => setConfirmClear(false)}
          disabled={clear.isPending}
          className={cn(
            "type-body-medium flex h-11 items-center gap-2 self-start rounded-sm px-3 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
            confirmClear ? "bg-error-soft text-error" : "text-ink-secondary hover:text-error",
          )}
        >
          {clear.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
          {confirmClear ? t("clearConfirm") : t("clearCart")}
        </button>
      </div>

      <aside
        aria-labelledby="summary-heading"
        className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 hero-after flex flex-col gap-3 rounded-md border border-line bg-card p-5 shadow-modal md:bottom-6 lg:top-24 lg:bottom-auto lg:shadow-card"
      >
        <h2 id="summary-heading" className="type-h3 text-ink">
          {t("orderSummary")}
        </h2>
        <div className="type-body flex justify-between text-ink-secondary">
          <span>{t("itemsTotal", { count: totals.itemCount })}</span>
          <FlipNumber value={formatTaka(totals.subtotal, locale)} className="type-price" />
        </div>
        <p className="type-caption text-ink-muted">{t("deliveryLater")}</p>
        <div className="flex items-baseline justify-between border-t border-gold pt-3">
          <span className="type-h3 text-ink">{t("total")}</span>
          <FlipNumber value={formatTaka(totals.subtotal, locale)} className="type-price text-[1.375rem] text-ink" />
        </div>
        {totals.checkoutReady ? (
          <Link href="/checkout" className={cn(primaryButton, "w-full")}>
            {t("checkout")}
          </Link>
        ) : (
          <>
            <button type="button" disabled aria-describedby="checkout-blocked" className={cn(primaryButton, "w-full cursor-not-allowed opacity-50")}>
              {t("checkout")}
            </button>
            <p id="checkout-blocked" className="type-caption text-error">
              {t("checkoutBlocked")}
            </p>
          </>
        )}
      </aside>
    </div>
  );
}

/** A number that flips up like a counter each time it changes (CSS: .badge-flip; still with "reduce motion"). */
function FlipNumber({ value, className }: { value: string | number; className?: string }) {
  return (
    <span key={value} className={cn("badge-flip inline-block", className)}>
      {value}
    </span>
  );
}

type GroupProps = {
  group: CartGroup;
  locale: string;
  busyItemId: string | undefined;
  error: ItemError;
  onQuantity: (item: CartItem, quantity: number) => void;
  onRemove: (item: CartItem) => void;
  removingItemId: string | undefined;
};

/** One shop = one future order (spec: VendorSubOrderContainer). */
function ShopGroup({ group, locale, busyItemId, error, onQuantity, onRemove, removingItemId }: GroupProps) {
  const t = useTranslations("Cart");
  const { shop } = group;
  const place = [shopPlace(shop.levelFloor, shop.shopNumber), shop.market?.name].filter(Boolean).join(" · ");
  const options = [shop.supportsDelivery && t("optionDelivery"), shop.supportsPickup && t("optionPickup")].filter(Boolean).join(", ");

  return (
    <section aria-labelledby={`shop-${shop.id}`} className="flex flex-col rounded-md border border-line bg-card p-4 shadow-card md:p-5">
      <header className="flex items-start gap-3 border-b border-line pb-3">
        <span aria-hidden className="flex h-10 w-8 shrink-0 items-end justify-center rounded-t-full rounded-b-sm bg-brand pb-1 font-heading text-[0.8125rem] text-primary-foreground">
          {initials(shop.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 id={`shop-${shop.id}`} className="type-h3 truncate text-ink">
              <Link href={`/shops/${shop.slug}`} className="hover:text-brand">
                {shop.name}
              </Link>
            </h2>
            {shop.verificationLevel !== "UNVERIFIED" && <VerificationSeal level={shop.verificationLevel} size="sm" />}
          </div>
          {place && (
            <p className="type-caption flex items-center gap-1 text-ink-muted">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {place}
            </p>
          )}
        </div>
      </header>

      <ul>
        {group.items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            locale={locale}
            busy={busyItemId === item.id}
            removing={removingItemId === item.id}
            error={error?.itemId === item.id ? error.text : null}
            onQuantity={(q) => onQuantity(item, q)}
            onRemove={() => onRemove(item)}
          />
        ))}
      </ul>

      <div className="flex flex-col gap-1 border-t border-line pt-3">
        <div className="flex items-baseline justify-between">
          <span className="type-body-medium text-ink">{t("subtotal")}</span>
          <FlipNumber value={formatTaka(group.subtotal, locale)} className="type-price text-ink" />
        </div>
        {options && <p className="type-caption text-ink-muted">{t("options", { options })}</p>}
      </div>
    </section>
  );
}

type ItemProps = {
  item: CartItem;
  locale: string;
  busy: boolean;
  removing: boolean; // being removed: the row fades and slides away a little
  error: string | null;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
};

function ItemRow({ item, locale, busy, removing, error, onQuantity, onRemove }: ItemProps) {
  const t = useTranslations("Cart");
  const image = safeMediaUrl(item.product.image);
  const title = item.product.title;
  const blocked = item.problem === "UNAVAILABLE" || item.problem === "OUT_OF_STOCK";
  const canIncrease = !busy && !blocked && !item.bargainApplied && item.quantity < MAX_QTY_PER_ITEM;
  const stepButton =
    "flex size-11 items-center justify-center text-ink-secondary hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none disabled:text-ink-disabled disabled:hover:bg-transparent";

  return (
    <li
      className={cn(
        "group flex gap-3 border-t border-line py-4 first:border-t-0 motion-safe:transition-[opacity,translate] motion-safe:duration-300",
        removing && "translate-x-3 opacity-40",
      )}
    >
      <Link
        href={`/products/${item.product.slug}?listing=${item.listingId}`}
        className="relative h-20 w-16 shrink-0 overflow-hidden rounded-t-full rounded-b-sm bg-highlight-soft"
        aria-hidden
        tabIndex={-1}
      >
        {image ? (
          <Image src={image} alt="" fill unoptimized sizes="64px" className="object-cover transition-transform duration-300 ease-out motion-safe:group-hover:scale-110" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-highlight">
            <CategoryIcon categorySlug="" className="size-7" strokeWidth={1.25} />
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link href={`/products/${item.product.slug}?listing=${item.listingId}`} className="type-body-medium line-clamp-2 text-ink hover:text-brand">
          {title}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <AvailabilityBadge value={item.availability} />
          {item.bargainApplied && (
            <span className="type-caption rounded-sm bg-highlight-soft px-2 py-0.5 text-highlight">🤝 {t("bargainApplied")}</span>
          )}
        </div>
        {item.problem && (
          <p className="type-caption flex items-start gap-1 text-error">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t(`problems.${item.problem}`)}
          </p>
        )}

        <div className="mt-1 flex items-center justify-between gap-3">
          <div role="group" aria-label={t("quantity")} className="flex items-center rounded-sm border border-line-strong">
            <button
              type="button"
              aria-label={t("decrease", { product: title })}
              disabled={busy || item.quantity <= 1}
              onClick={() => onQuantity(item.quantity - 1)}
              className={stepButton}
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <span className="type-body-medium flex w-8 justify-center overflow-hidden tabular-nums text-ink" aria-live="polite">
              {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <FlipNumber value={item.quantity} />}
            </span>
            <button
              type="button"
              aria-label={t("increase", { product: title })}
              disabled={!canIncrease}
              onClick={() => onQuantity(item.quantity + 1)}
              className={stepButton}
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>

          <div className="text-right">
            <p className={cn("type-price", item.problem ? "text-ink-muted line-through" : "text-ink")}>
              <FlipNumber value={formatTaka(item.lineTotal, locale)} />
            </p>
            {item.quantity > 1 && (
              <p className="type-caption text-ink-muted">{t("each", { price: formatTaka(item.unitPrice, locale) })}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label={t("removeLabel", { product: title })}
          className="type-caption flex h-9 items-center gap-1 self-start text-ink-muted hover:text-error focus-visible:text-error focus-visible:outline-none disabled:opacity-50"
        >
          <Trash2 className="size-3.5" aria-hidden />
          {t("remove")}
        </button>

        {error && (
          <p role="alert" className="type-caption flex items-start gap-1 text-error">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </div>
    </li>
  );
}