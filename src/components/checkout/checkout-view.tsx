"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Info, LoaderCircle, MapPin, ShoppingCart, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { useSession } from "@/components/app-providers";
import { VerificationSeal } from "@/components/brand/verification-seal";
import { TextField } from "@/components/ui/text-field";
import { Link, useRouter } from "@/i18n/routing";
import { cartKeys, getCart, type CartGroup } from "@/lib/api/cart";
import {
  checkoutKeys,
  DELIVERY_FEE,
  placeOrders,
  type DeliveryMethod,
  type PaymentMethod,
  type ShopChoice,
} from "@/lib/api/checkout";
import { ApiError } from "@/lib/api/core";
import { shopPlace } from "@/lib/api/storefront";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BD_MOBILE, normalizePhone } from "@/lib/validation";

type Choice = { delivery: DeliveryMethod; payment: PaymentMethod };
type Address = { line1: string; area: string; city: string; phone: string };
type AddressErrors = Partial<Record<keyof Address | "all", string>>;

// Backend rules: pay at store only with pickup, cash on delivery only with delivery, online with either.
const PAYMENTS: Record<DeliveryMethod, PaymentMethod[]> = {
  STORE_PICKUP: ["PAY_AT_STORE", "ONLINE"],
  VENDOR_DELIVERY: ["CASH_ON_DELIVERY", "ONLINE"],
};

function defaultChoice(group: CartGroup): Choice {
  const delivery: DeliveryMethod = group.shop.supportsPickup ? "STORE_PICKUP" : "VENDOR_DELIVERY";
  return { delivery, payment: PAYMENTS[delivery][0] };
}

// Same format the backend uses for saved addresses: "line1, area, city. Phone: 01…"
function composeAddress(a: Address): string {
  return `${a.line1.trim()}${a.area.trim() ? `, ${a.area.trim()}` : ""}, ${a.city.trim()}. Phone: ${normalizePhone(a.phone)}`;
}

function checkAddress(a: Address, t: (key: string) => string): AddressErrors {
  const errors: AddressErrors = {};
  const line1 = a.line1.trim();
  if (line1.length < 5) errors.line1 = t("addressErrors.line1");
  else if (line1.length > 150) errors.line1 = t("addressErrors.line1Long");
  if (a.area.trim().length > 60) errors.area = t("addressErrors.areaLong");
  if (a.city.trim().length < 2) errors.city = t("addressErrors.city");
  if (!BD_MOBILE.test(normalizePhone(a.phone))) errors.phone = t("addressErrors.phone");
  if (Object.keys(errors).length === 0 && composeAddress(a).length > 300) errors.all = t("addressErrors.tooLong");
  return errors;
}

function errorKey(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return Array.isArray(err.details) ? "errors.problems" : "errors.stock";
    if (err.status === 400) return err.message === "Your cart is empty" ? "errors.empty" : "errors.invalid";
    if (err.status === 0) return "errors.network";
  }
  return "errors.generic";
}

const panel = "flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center";
const primaryButton =
  "type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none";

export function CheckoutView() {
  const t = useTranslations("Checkout");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status, user } = useSession();

  const cart = useQuery({ queryKey: cartKeys.cart, queryFn: getCart, enabled: status === "authenticated" });

  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [address, setAddress] = useState<Address>({ line1: "", area: "", city: "Dhaka", phone: "" });
  const [addressErrors, setAddressErrors] = useState<AddressErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const place = useMutation({
    mutationFn: placeOrders,
    onSuccess: (result) => {
      queryClient.setQueryData(checkoutKeys.checkout(result.checkoutId), result);
      void queryClient.invalidateQueries({ queryKey: cartKeys.cart }); // the server emptied the cart
      // replace: the browser's Back button cannot send the orders again
      router.replace(`/checkout/${result.checkoutId}`);
    },
    onError: (err) => {
      setFormError(t(errorKey(err)));
      void queryClient.invalidateQueries({ queryKey: cartKeys.cart }); // show the cart as it is now
    },
  });

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
        <p className="type-body text-ink-secondary">{t("guestText")}</p>
        <Link href={`/auth/login?next=${encodeURIComponent("/checkout")}`} className={primaryButton}>
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

  if (shops.length === 0 && !place.isPending && !place.isSuccess) {
    return (
      <div className={panel}>
        <h2 className="type-h3 text-ink">{t("emptyTitle")}</h2>
        <p className="type-body text-ink-secondary">{t("emptyText")}</p>
        <Link href="/search" className={primaryButton}>
          {t("startShopping")}
        </Link>
      </div>
    );
  }

  if (!totals.checkoutReady && !place.isPending) {
    return (
      <div role="alert" className={panel}>
        <TriangleAlert className="size-10 text-error" strokeWidth={1.5} aria-hidden />
        <h2 className="type-h3 text-ink">{t("notReadyTitle")}</h2>
        <p className="type-body max-w-sm text-ink-secondary">{t("notReadyText")}</p>
        <Link href="/cart" className={primaryButton}>
          {t("backToCart")}
        </Link>
      </div>
    );
  }

  // Current choice per shop (defaults until the customer changes something)
  const choiceFor = (group: CartGroup) => choices[group.shop.id] ?? defaultChoice(group);
  const deliveringCount = shops.filter((g) => choiceFor(g).delivery === "VENDOR_DELIVERY").length;
  const deliveryFees = deliveringCount * DELIVERY_FEE;
  const total = totals.subtotal + deliveryFees;
  const phonePlaceholder = user?.phone ?? "01712345678";

  function setChoice(group: CartGroup, next: Partial<Choice>) {
    setChoices((prev) => {
      const current = prev[group.shop.id] ?? defaultChoice(group);
      const delivery = next.delivery ?? current.delivery;
      // switching delivery keeps the payment if allowed, otherwise picks the first allowed one
      const allowed = PAYMENTS[delivery];
      const wanted = next.payment ?? current.payment;
      return { ...prev, [group.shop.id]: { delivery, payment: allowed.includes(wanted) ? wanted : allowed[0] } };
    });
    setFormError(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (place.isPending) return;
    setFormError(null);

    // Use the account phone if the field was left empty.
    const filled = { ...address, phone: address.phone.trim() || user?.phone || "" };
    if (deliveringCount > 0) {
      const errors = checkAddress(filled, t);
      setAddressErrors(errors);
      if (Object.keys(errors).length > 0) return;
    }

    const deliveryAddress = deliveringCount > 0 ? composeAddress(filled) : undefined;
    const payload: ShopChoice[] = shops.map((group) => {
      const choice = choiceFor(group);
      return {
        shopId: group.shop.id,
        deliveryMethod: choice.delivery,
        paymentMethod: choice.payment,
        ...(choice.delivery === "VENDOR_DELIVERY" && { deliveryAddress }),
      };
    });
    place.mutate(payload);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-5">
        <p className="type-body flex gap-2 rounded-md bg-info-soft p-4 text-verified">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          {t("sessionNote", { count: shops.length })}
        </p>

        {shops.map((group, index) => (
          <ShopOrderCard
            key={group.shop.id}
            group={group}
            index={index}
            total={shops.length}
            choice={choiceFor(group)}
            locale={locale}
            disabled={place.isPending}
            onChange={(next) => setChoice(group, next)}
          />
        ))}

        {deliveringCount > 0 && (
          <fieldset className="flex flex-col gap-4 rounded-md border border-line bg-card p-4 md:p-5" disabled={place.isPending}>
            <legend className="type-h3 flex items-center gap-2 px-1 text-ink">
              <MapPin className="size-5 text-highlight" aria-hidden />
              {t("addressTitle")}
            </legend>
            <p className="type-caption -mt-2 text-ink-muted">{t("addressText", { count: deliveringCount })}</p>
            <TextField
              label={t("line1")}
              placeholder={t("line1Placeholder")}
              autoComplete="address-line1"
              maxLength={150}
              value={address.line1}
              onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
              error={addressErrors.line1}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={t("area")}
                placeholder={t("areaPlaceholder")}
                autoComplete="address-level3"
                maxLength={60}
                value={address.area}
                onChange={(e) => setAddress((a) => ({ ...a, area: e.target.value }))}
                error={addressErrors.area}
              />
              <TextField
                label={t("city")}
                autoComplete="address-level2"
                maxLength={40}
                value={address.city}
                onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                error={addressErrors.city}
              />
            </div>
            <TextField
              label={t("phone")}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={phonePlaceholder}
              hint={t("phoneHint")}
              maxLength={25}
              value={address.phone}
              onChange={(e) => setAddress((a) => ({ ...a, phone: e.target.value }))}
              error={addressErrors.phone}
            />
            {addressErrors.all && <p className="type-caption text-error">{addressErrors.all}</p>}
          </fieldset>
        )}

        <p className="type-body flex gap-2 rounded-sm border-l-4 border-highlight bg-warning-soft p-4 text-ink-secondary">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-highlight" aria-hidden />
          {t("fulfilmentNote")}
        </p>
      </div>

      <aside
        aria-labelledby="summary-heading"
        className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex flex-col gap-3 rounded-md border border-line bg-card p-5 shadow-modal md:bottom-6 lg:top-24 lg:bottom-auto lg:shadow-card"
      >
        <h2 id="summary-heading" className="type-h3 text-ink">
          {t("summaryTitle")}
        </h2>
        <ul className="flex flex-col gap-1.5">
          {shops.map((group) => (
            <li key={group.shop.id} className="type-body flex justify-between gap-3 text-ink-secondary">
              <span className="truncate">{group.shop.name}</span>
              <span className="type-price shrink-0">{formatTaka(group.subtotal, locale)}</span>
            </li>
          ))}
          <li className="type-body flex justify-between gap-3 text-ink-secondary">
            <span>{t("deliveryFees")}</span>
            <span className="type-price">{deliveryFees > 0 ? formatTaka(deliveryFees, locale) : t("free")}</span>
          </li>
        </ul>
        <div className="flex items-baseline justify-between border-t border-gold pt-3">
          <span className="type-h3 text-ink">{t("total")}</span>
          <span className="type-price text-[1.375rem] text-ink">{formatTaka(total, locale)}</span>
        </div>

        {formError && (
          <div role="alert" className="type-body flex flex-col gap-2 rounded-md border border-error/30 bg-error-soft p-3 text-error">
            <p className="flex gap-2">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {formError}
            </p>
            <Link href="/cart" className="type-body-medium self-start underline underline-offset-4">
              {t("backToCart")}
            </Link>
          </div>
        )}

        <button type="submit" disabled={place.isPending} aria-busy={place.isPending} className={cn(primaryButton, "w-full disabled:cursor-not-allowed disabled:opacity-80")}>
          {place.isPending && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
          {place.isPending ? t("placing") : t("place", { count: shops.length })}
        </button>
        <p className="type-caption text-ink-muted">{t("pricesNote")}</p>
      </aside>
    </form>
  );
}

type CardProps = {
  group: CartGroup;
  index: number;
  total: number;
  choice: Choice;
  locale: string;
  disabled: boolean;
  onChange: (next: Partial<Choice>) => void;
};

/** One shop's order (spec: SubOrderCard): delivery and payment choice, its own total. */
function ShopOrderCard({ group, index, total, choice, locale, disabled, onChange }: CardProps) {
  const t = useTranslations("Checkout");
  const { shop } = group;
  const fee = choice.delivery === "VENDOR_DELIVERY" ? DELIVERY_FEE : 0;
  const place = [shopPlace(shop.levelFloor, shop.shopNumber), shop.market?.name].filter(Boolean).join(" · ");
  const itemCount = group.items.reduce((n, i) => n + i.quantity, 0);

  const deliveryOptions: { value: DeliveryMethod; label: string; hint: string; offered: boolean }[] = [
    { value: "STORE_PICKUP", label: t("pickup"), hint: t("pickupHint"), offered: shop.supportsPickup },
    { value: "VENDOR_DELIVERY", label: t("delivery"), hint: `${t("deliveryHint")} ${formatTaka(DELIVERY_FEE, locale)}`, offered: shop.supportsDelivery },
  ];
  const paymentLabels: Record<PaymentMethod, { label: string; hint: string }> = {
    PAY_AT_STORE: { label: t("payAtStore"), hint: t("payAtStoreHint") },
    CASH_ON_DELIVERY: { label: t("cod"), hint: t("codHint") },
    ONLINE: { label: t("online"), hint: t("onlineHint") },
  };

  return (
    <section aria-labelledby={`order-${shop.id}`} className="flex flex-col gap-4 rounded-md border border-line bg-card p-4 shadow-card md:p-5">
      <header className="flex flex-col gap-1 border-b border-line pb-3">
        <p className="type-caption text-highlight">{t("orderOf", { n: index + 1, total })}</p>
        <div className="flex items-center gap-1.5">
          <h2 id={`order-${shop.id}`} className="type-h3 truncate text-ink">
            {shop.name}
          </h2>
          {shop.verificationLevel !== "UNVERIFIED" && <VerificationSeal level={shop.verificationLevel} size="sm" />}
        </div>
        {place && <p className="type-caption text-ink-muted">{place}</p>}
      </header>

      <ul className="flex flex-col gap-1">
        {group.items.map((item) => (
          <li key={item.id} className="type-body flex justify-between gap-3 text-ink-secondary">
            <span className="min-w-0 truncate">
              {item.quantity} × {item.product.title}
            </span>
            <span className="type-price shrink-0">{formatTaka(item.lineTotal, locale)}</span>
          </li>
        ))}
      </ul>

      <fieldset disabled={disabled} className="flex flex-col gap-2">
        <legend className="type-body-medium mb-1 text-ink">{t("deliveryMethod")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {deliveryOptions.map((option) => (
            <Option
              key={option.value}
              name={`delivery-${shop.id}`}
              checked={choice.delivery === option.value}
              disabled={!option.offered}
              label={option.label}
              hint={option.offered ? option.hint : t("notOffered")}
              onSelect={() => onChange({ delivery: option.value })}
            />
          ))}
        </div>
      </fieldset>

      <fieldset disabled={disabled} className="flex flex-col gap-2">
        <legend className="type-body-medium mb-1 text-ink">{t("paymentMethod")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PAYMENTS[choice.delivery].map((method) => (
            <Option
              key={method}
              name={`payment-${shop.id}`}
              checked={choice.payment === method}
              label={paymentLabels[method].label}
              hint={paymentLabels[method].hint}
              onSelect={() => onChange({ payment: method })}
            />
          ))}
        </div>
      </fieldset>

      <dl className="flex flex-col gap-1 border-t border-line pt-3">
        <div className="type-body flex justify-between text-ink-secondary">
          <dt>{t("items", { count: itemCount })}</dt>
          <dd className="type-price">{formatTaka(group.subtotal, locale)}</dd>
        </div>
        <div className="type-body flex justify-between text-ink-secondary">
          <dt>{t("deliveryFee")}</dt>
          <dd className="type-price">{fee > 0 ? formatTaka(fee, locale) : t("free")}</dd>
        </div>
        <div className="type-body-medium flex justify-between text-ink">
          <dt>{t("orderTotal")}</dt>
          <dd className="type-price">{formatTaka(group.subtotal + fee, locale)}</dd>
        </div>
      </dl>
    </section>
  );
}

/** A radio option styled as a card (native radio: keyboard and screen readers work as usual). */
function Option({
  name,
  checked,
  disabled = false,
  label,
  hint,
  onSelect,
}: {
  name: string;
  checked: boolean;
  disabled?: boolean;
  label: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer items-start gap-3 rounded-md border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand",
        checked ? "border-brand bg-highlight-soft/40" : "border-line-strong bg-card hover:border-brand",
        disabled && "cursor-not-allowed border-line bg-subtle opacity-70 hover:border-line",
      )}
    >
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onSelect} className="mt-1 size-4 accent-brand" />
      <span className="flex flex-col">
        <span className="type-body-medium text-ink">{label}</span>
        <span className="type-caption text-ink-muted">{hint}</span>
      </span>
    </label>
  );
}