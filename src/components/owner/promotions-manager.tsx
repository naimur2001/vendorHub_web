"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, LoaderCircle, Pause, Play, Plus, Square, TicketPercent, X, Zap } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useSession } from "@/components/app-providers";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
import { Link } from "@/i18n/routing";
import { ApiError } from "@/lib/api/core";
import { listingKeys, listOwnerListings } from "@/lib/api/listings";
import { getMyShops, shopKeys } from "@/lib/api/shops";
import {
  createCoupon,
  createDeal,
  endDeal,
  listCoupons,
  listShopDeals,
  promoKeys,
  updateCoupon,
  type Coupon,
  type ShopDeal,
} from "@/lib/api/promotions";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const HOUR = 3_600_000;
const DEAL_LENGTHS = [2, 6, 12, 24, 72, 168]; // hours (the backend allows up to 30 days)
const COUPON_LENGTHS = [1, 3, 7, 14, 30]; // days
const CODE = /^[A-Z0-9]{4,16}$/;

const box = "flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center";
const card = "flex flex-col gap-4 rounded-md border border-line bg-card p-4 shadow-card md:p-5";
const field =
  "type-body h-11 w-full rounded-sm border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";
const primary =
  "type-body-medium inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60";
const secondary =
  "type-body-medium inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60";

// "" -> undefined; otherwise a whole number (or NaN when it isn't one)
const whole = (v: string) => (v.trim() === "" ? undefined : /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN);
// <input type="datetime-local"> is in the owner's own time zone
const fromLocal = (v: string) => (v ? new Date(v) : null);

/** Error code from the backend -> message key (fixed texts; server messages are never shown as-is). */
function errorKey(err: unknown): string {
  if (!(err instanceof ApiError)) return "errors.generic";
  const code = (err.details as { code?: string } | undefined)?.code;
  if (code === "DEAL_OVERLAP") return "errors.overlap";
  if (code === "COUPON_CODE_TAKEN") return "errors.codeTaken";
  if (err.status === 400 && /lower than the listing price/i.test(err.message)) return "errors.priceNotLower";
  if (err.status === 400 && /30 days/.test(err.message)) return "errors.tooLong";
  if (err.status === 400) return "errors.invalid";
  if (err.status === 403) return "errors.forbidden";
  if (err.status === 0) return "errors.network";
  return "errors.generic";
}

export function PromotionsManager() {
  const t = useTranslations("Promotions");
  const searchParams = useSearchParams();
  const { status: session, user } = useSession();
  const isTeam = user?.role === "SHOP_OWNER" || user?.role === "SHOP_STAFF";

  // Only the user's own shops; a shop id typed into the URL is ignored otherwise.
  const shops = useQuery({ queryKey: shopKeys.mine, queryFn: getMyShops, enabled: session === "authenticated" && isTeam });
  const shop = (shops.data ?? []).find((s) => s.id === searchParams.get("shop")) ?? shops.data?.[0];

  if (session === "loading" || (isTeam && shops.isPending)) return <OwnerSkeleton label={t("loading")} />;
  if (session === "guest") {
    return (
      <div className={box}>
        <h2 className="type-h3 text-ink">{t("guestTitle")}</h2>
        <Link href={`/auth/login?next=${encodeURIComponent("/owner/promotions")}`} className={primary}>
          {t("logIn")}
        </Link>
      </div>
    );
  }
  if (!isTeam) return <div className={box}><h2 className="type-h3 text-ink">{t("notTeam")}</h2></div>;
  if (shops.isError) return <Retry onRetry={() => shops.refetch()} />;
  if (!shop) return <div className={box}><p className="type-body text-ink-secondary">{t("noShop")}</p></div>;

  return (
    <div className="flex flex-col gap-10">
      <DealsSection shopId={shop.id} />
      <CouponsSection shopId={shop.id} />
    </div>
  );
}

function Retry({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("Promotions");
  return (
    <div role="alert" className={box}>
      <p className="type-body text-ink-secondary">{t("loadError")}</p>
      <button type="button" onClick={onRetry} className={secondary}>
        {t("retry")}
      </button>
    </div>
  );
}

function SectionHead({ id, icon, title, text, action }: { id: string; icon: ReactNode; title: string; text: string; action: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="type-h2 flex items-center gap-2 text-ink">
          {icon}
          {title}
        </h2>
        <p className="type-body text-ink-secondary">{text}</p>
      </div>
      {action}
    </div>
  );
}

function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="type-body-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="type-caption text-ink-muted">{hint}</p>}
    </div>
  );
}

// ---------- Flash deals ----------

const STATUS_STYLE: Record<ShopDeal["status"], string> = {
  ACTIVE: "bg-success-soft text-success-ink",
  SCHEDULED: "bg-info-soft text-verified",
  SOLD_OUT: "bg-highlight-soft text-highlight",
  ENDED: "bg-subtle text-ink-muted",
};

function DealsSection({ shopId }: { shopId: string }) {
  const t = useTranslations("Promotions");
  const format = useFormatter();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const deals = useQuery({ queryKey: promoKeys.deals(shopId), queryFn: () => listShopDeals(shopId) });
  const end = useMutation({
    mutationFn: (dealId: string) => endDeal(shopId, dealId),
    onSuccess: () => {
      setNotice(t("dealEnded"));
      void queryClient.invalidateQueries({ queryKey: promoKeys.deals(shopId) });
    },
    onError: (err) => setNotice(t(errorKey(err))),
  });

  const when = (iso: string) => format.dateTime(new Date(iso), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  return (
    <section aria-labelledby="deals-h" className="flex flex-col gap-4">
      <SectionHead
        id="deals-h"
        icon={<Zap className="size-6 text-gold" aria-hidden />}
        title={t("dealsTitle")}
        text={t("dealsText")}
        action={
          !open && (
            <button type="button" onClick={() => setOpen(true)} className={primary}>
              <Plus className="size-4" aria-hidden />
              {t("newDeal")}
            </button>
          )
        }
      />
      {open && (
        <DealForm
          shopId={shopId}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            setNotice(t("dealSaved"));
          }}
        />
      )}
      {notice && (
        <p role="status" className="type-body rounded-md bg-subtle p-3 text-ink-secondary">
          {notice}
        </p>
      )}

      {deals.isPending ? (
        <div className="h-32 skeleton rounded-md" aria-hidden />
      ) : deals.isError ? (
        <Retry onRetry={() => deals.refetch()} />
      ) : deals.data.length === 0 ? (
        <p className="type-body rounded-md border border-dashed border-line-strong p-6 text-center text-ink-secondary">{t("noDeals")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {deals.data.map((d) => {
            const running = d.status === "ACTIVE" || d.status === "SOLD_OUT";
            return (
              <li key={d.id} className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card md:flex-row md:items-center md:gap-6">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="type-body-medium truncate text-ink">{d.productTitle ?? t("unknownProduct")}</h3>
                    <span className={cn("type-caption rounded-full px-2 py-0.5", STATUS_STYLE[d.status])}>{t(`status.${d.status}`)}</span>
                  </div>
                  <p className="type-body flex flex-wrap items-baseline gap-2">
                    <span className="type-price text-brand">{formatTaka(d.dealPrice, locale)}</span>
                    {d.listPrice !== null && <del className="type-caption text-ink-muted">{formatTaka(d.listPrice, locale)}</del>}
                  </p>
                  <p className="type-caption text-ink-muted">
                    {t("window", { from: when(d.startsAt), to: when(d.endsAt) })}
                    {" · "}
                    {d.maxQty === null ? t("soldNoLimit", { sold: d.soldQty }) : t("soldOf", { sold: d.soldQty, max: d.maxQty })}
                  </p>
                </div>
                {(running || d.status === "SCHEDULED") && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(d.status === "SCHEDULED" ? t("confirmCancel") : t("confirmEnd"))) end.mutate(d.id);
                    }}
                    disabled={end.isPending && end.variables === d.id}
                    className={secondary}
                  >
                    {end.isPending && end.variables === d.id ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden /> : <Square className="size-4" aria-hidden />}
                    {d.status === "SCHEDULED" ? t("cancelDeal") : t("endDeal")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function DealForm({ shopId, onClose, onSaved }: { shopId: string; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("Promotions");
  const locale = useLocale();
  const id = useId();
  const queryClient = useQueryClient();
  const listings = useQuery({ queryKey: listingKeys.mine(shopId), queryFn: () => listOwnerListings(shopId) });
  const active = (listings.data ?? []).filter((l) => l.isActive);

  const [listingId, setListingId] = useState("");
  const [price, setPrice] = useState("");
  const [starts, setStarts] = useState(""); // empty = now
  const [hours, setHours] = useState(24);
  const [maxQty, setMaxQty] = useState("");
  const [error, setError] = useState<string | null>(null);

  const listing = active.find((l) => l.id === listingId);

  const save = useMutation({
    mutationFn: () => {
      const start = fromLocal(starts);
      const endsAt = new Date((start ?? new Date()).getTime() + hours * HOUR).toISOString();
      const qty = whole(maxQty);
      return createDeal(shopId, {
        listingId,
        dealPrice: Number(price),
        ...(start && { startsAt: start.toISOString() }),
        endsAt,
        ...(qty !== undefined && { maxQty: qty }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: promoKeys.deals(shopId) });
      onSaved();
    },
    onError: (err) => setError(t(errorKey(err))),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const p = whole(price);
    const q = whole(maxQty);
    if (!listing) return setError(t("errors.pickListing"));
    if (p === undefined || Number.isNaN(p) || p < 1) return setError(t("errors.price"));
    if (p >= listing.price) return setError(t("errors.priceNotLower"));
    if (q !== undefined && (Number.isNaN(q) || q < 1)) return setError(t("errors.qty"));
    const start = fromLocal(starts);
    if (start && Number.isNaN(start.getTime())) return setError(t("errors.invalid"));
    save.mutate();
  }

  const percent = listing && whole(price) && !Number.isNaN(whole(price)) ? Math.round((1 - Number(price) / listing.price) * 100) : null;

  return (
    <form onSubmit={submit} noValidate className={card} aria-labelledby={`${id}-t`}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={`${id}-t`} className="type-h3 text-ink">{t("newDeal")}</h3>
        <button type="button" onClick={onClose} aria-label={t("close")} className="flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label={t("listing")} htmlFor={`${id}-l`}>
            <select id={`${id}-l`} value={listingId} onChange={(e) => setListingId(e.target.value)} className={field} disabled={listings.isPending}>
              <option value="">{listings.isPending ? t("loading") : t("pickListing")}</option>
              {active.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.product.title} · {formatTaka(l.price, locale)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={t("dealPrice")} htmlFor={`${id}-p`} hint={percent !== null && percent > 0 ? t("percentOff", { percent }) : t("dealPriceHint")}>
          <input id={`${id}-p`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").slice(0, 9))} className={field} />
        </Field>
        <Field label={t("maxQty")} htmlFor={`${id}-q`} hint={t("maxQtyHint")}>
          <input id={`${id}-q`} inputMode="numeric" value={maxQty} onChange={(e) => setMaxQty(e.target.value.replace(/\D/g, "").slice(0, 6))} className={field} />
        </Field>
        <Field label={t("starts")} htmlFor={`${id}-s`} hint={t("startsHint")}>
          <input id={`${id}-s`} type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} className={field} />
        </Field>
        <Field label={t("lasts")} htmlFor={`${id}-h`}>
          <select id={`${id}-h`} value={hours} onChange={(e) => setHours(Number(e.target.value))} className={field}>
            {DEAL_LENGTHS.map((h) => (
              <option key={h} value={h}>
                {h < 24 ? t("hours", { count: h }) : t("days", { count: h / 24 })}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>
      {error && <p role="alert" className="type-body text-error">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={save.isPending} className={primary}>
          {save.isPending && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
          {t("startDeal")}
        </button>
        <button type="button" onClick={onClose} className={secondary}>{t("cancel")}</button>
      </div>
    </form>
  );
}

// ---------- Coupons ----------

function CouponsSection({ shopId }: { shopId: string }) {
  const t = useTranslations("Promotions");
  const format = useFormatter();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const coupons = useQuery({ queryKey: promoKeys.coupons(shopId), queryFn: () => listCoupons(shopId) });
  const toggle = useMutation({
    mutationFn: (c: Coupon) => updateCoupon(shopId, c.id, { isActive: !c.isActive }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Coupon[]>(promoKeys.coupons(shopId), (old) => old?.map((c) => (c.id === updated.id ? updated : c)));
      setNotice(updated.isActive ? t("couponResumed") : t("couponPaused"));
    },
    onError: (err) => setNotice(t(errorKey(err))),
  });

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(t("copied", { code }));
    } catch {
      setNotice(t("copyFailed"));
    }
  }

  const day = (iso: string) => format.dateTime(new Date(iso), { day: "numeric", month: "short", year: "numeric" });

  return (
    <section aria-labelledby="coupons-h" className="flex flex-col gap-4">
      <SectionHead
        id="coupons-h"
        icon={<TicketPercent className="size-6 text-gold" aria-hidden />}
        title={t("couponsTitle")}
        text={t("couponsText")}
        action={
          !open && (
            <button type="button" onClick={() => setOpen(true)} className={primary}>
              <Plus className="size-4" aria-hidden />
              {t("newCoupon")}
            </button>
          )
        }
      />
      {open && (
        <CouponForm
          shopId={shopId}
          onClose={() => setOpen(false)}
          onSaved={(code) => {
            setOpen(false);
            setNotice(t("couponSaved", { code }));
          }}
        />
      )}
      {notice && (
        <p role="status" className="type-body rounded-md bg-subtle p-3 text-ink-secondary">
          {notice}
        </p>
      )}

      {coupons.isPending ? (
        <div className="h-32 skeleton rounded-md" aria-hidden />
      ) : coupons.isError ? (
        <Retry onRetry={() => coupons.refetch()} />
      ) : coupons.data.length === 0 ? (
        <p className="type-body rounded-md border border-dashed border-line-strong p-6 text-center text-ink-secondary">{t("noCoupons")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {coupons.data.map((c) => (
            <li key={c.id} className={cn("flex flex-col gap-3 rounded-md border border-dashed bg-card p-4 shadow-card", c.isActive ? "border-gold" : "border-line-strong opacity-80")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="font-heading text-[1.375rem] leading-none tracking-[0.12em] text-brand">{c.code}</p>
                  <p className="type-body-medium text-ink">
                    {c.percentOff !== null ? t("percentOff", { percent: c.percentOff }) : t("amountOffLabel", { amount: formatTaka(c.amountOff ?? 0, locale) })}
                    {c.minOrder > 0 && <span className="type-caption ml-2 text-ink-muted">{t("minOrderLabel", { amount: formatTaka(c.minOrder, locale) })}</span>}
                  </p>
                </div>
                <button type="button" onClick={() => copy(c.code)} aria-label={t("copy", { code: c.code })} className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-subtle hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                  <Copy className="size-4" aria-hidden />
                </button>
              </div>
              <p className="type-caption text-ink-muted">
                {t("couponWindow", { from: day(c.startsAt), to: day(c.endsAt) })}
                {" · "}
                {c.maxUses === null ? t("usedNoLimit", { used: c.usedCount }) : t("usedOf", { used: c.usedCount, max: c.maxUses })}
                {" · "}
                {t("perCustomerLabel", { count: c.perCustomer })}
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className={cn("type-caption rounded-full px-2 py-0.5", c.isActive ? "bg-success-soft text-success-ink" : "bg-subtle text-ink-muted")}>
                  {c.isActive ? t("on") : t("paused")}
                </span>
                <button type="button" onClick={() => toggle.mutate(c)} disabled={toggle.isPending && toggle.variables?.id === c.id} className={secondary}>
                  {c.isActive ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                  {c.isActive ? t("pause") : t("resume")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CouponForm({ shopId, onClose, onSaved }: { shopId: string; onClose: () => void; onSaved: (code: string) => void }) {
  const t = useTranslations("Promotions");
  const id = useId();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [days, setDays] = useState(7);
  const [maxUses, setMaxUses] = useState("");
  const [perCustomer, setPerCustomer] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const v = Number(value);
      const min = whole(minOrder);
      const uses = whole(maxUses);
      return createCoupon(shopId, {
        code,
        ...(kind === "percent" ? { percentOff: v } : { amountOff: v }),
        ...(min !== undefined && { minOrder: min }),
        endsAt: new Date(Date.now() + days * 24 * HOUR).toISOString(),
        ...(uses !== undefined && { maxUses: uses }),
        perCustomer,
      });
    },
    onSuccess: (c) => {
      void queryClient.invalidateQueries({ queryKey: promoKeys.coupons(shopId) });
      onSaved(c.code);
    },
    onError: (err) => setError(t(errorKey(err))),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const v = whole(value);
    const min = whole(minOrder);
    const uses = whole(maxUses);
    if (!CODE.test(code)) return setError(t("errors.code"));
    if (v === undefined || Number.isNaN(v) || v < 1 || (kind === "percent" && v > 90)) return setError(t(kind === "percent" ? "errors.percent" : "errors.amount"));
    if (min !== undefined && Number.isNaN(min)) return setError(t("errors.minOrder"));
    if (uses !== undefined && (Number.isNaN(uses) || uses < 1)) return setError(t("errors.qty"));
    save.mutate();
  }

  return (
    <form onSubmit={submit} noValidate className={card} aria-labelledby={`${id}-t`}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={`${id}-t`} className="type-h3 text-ink">{t("newCoupon")}</h3>
        <button type="button" onClick={onClose} aria-label={t("close")} className="flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2">
        <Field label={t("code")} htmlFor={`${id}-c`} hint={t("codeHint")}>
          <input
            id={`${id}-c`}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))}
            autoComplete="off"
            spellCheck={false}
            placeholder="EID20"
            className={cn(field, "tracking-[0.12em] uppercase")}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="type-body-medium text-ink" id={`${id}-k`}>{t("discount")}</span>
          <div className="flex gap-2">
            <div role="radiogroup" aria-labelledby={`${id}-k`} className="flex shrink-0 overflow-hidden rounded-sm border border-input">
              {(["percent", "amount"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={cn("type-body-medium h-11 min-w-11 px-3 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none focus-visible:ring-inset", kind === k ? "bg-brand text-primary-foreground" : "bg-card text-ink hover:bg-subtle")}
                >
                  {k === "percent" ? "%" : "৳"}
                  <span className="sr-only"> {t(k === "percent" ? "kindPercent" : "kindAmount")}</span>
                </button>
              ))}
            </div>
            <input
              aria-labelledby={`${id}-k`}
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, kind === "percent" ? 2 : 7))}
              className={field}
            />
          </div>
          <p className="type-caption text-ink-muted">{kind === "percent" ? t("percentHint") : t("amountHint")}</p>
        </div>
        <Field label={t("minOrder")} htmlFor={`${id}-m`} hint={t("minOrderHint")}>
          <input id={`${id}-m`} inputMode="numeric" value={minOrder} onChange={(e) => setMinOrder(e.target.value.replace(/\D/g, "").slice(0, 8))} className={field} />
        </Field>
        <Field label={t("lasts")} htmlFor={`${id}-d`}>
          <select id={`${id}-d`} value={days} onChange={(e) => setDays(Number(e.target.value))} className={field}>
            {COUPON_LENGTHS.map((d) => (
              <option key={d} value={d}>{t("days", { count: d })}</option>
            ))}
          </select>
        </Field>
        <Field label={t("maxUses")} htmlFor={`${id}-u`} hint={t("maxUsesHint")}>
          <input id={`${id}-u`} inputMode="numeric" value={maxUses} onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, "").slice(0, 7))} className={field} />
        </Field>
        <Field label={t("perCustomer")} htmlFor={`${id}-pc`}>
          <select id={`${id}-pc`} value={perCustomer} onChange={(e) => setPerCustomer(Number(e.target.value))} className={field}>
            {[1, 2, 3, 5, 10].map((n) => (
              <option key={n} value={n}>{t("perCustomerLabel", { count: n })}</option>
            ))}
          </select>
        </Field>
      </fieldset>
      {error && <p role="alert" className="type-body text-error">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={save.isPending} className={primary}>
          {save.isPending && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
          {t("createCoupon")}
        </button>
        <button type="button" onClick={onClose} className={secondary}>{t("cancel")}</button>
      </div>
    </form>
  );
}
