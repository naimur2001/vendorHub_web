"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Check, CircleAlert, Clock, Gift, LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/app-providers";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
import { ApiError } from "@/lib/api/core";
import { getMyShops, shopKeys } from "@/lib/api/shops";
import { getShopSubscription, PERIODS, requestPlan, subKeys, type BillingPeriod, type SubscriptionPlan } from "@/lib/api/subscriptions";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const panel = "flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center";
const card = "flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card md:p-5";
const LIMITS = ["maxProducts", "maxStaff", "maxActiveDeals"] as const;

/** Owner → My plan: the shop's plan, what it includes, limits used, and the plans to ask for. */
export function OwnerPlan() {
  const t = useTranslations("OwnerPlan");
  const tS = useTranslations("OwnerPlan.status");
  const tP = useTranslations("OwnerPlan.period");
  const tM = useTranslations("OwnerPlan.module");
  const locale = useLocale();
  const format = useFormatter();
  const searchParams = useSearchParams();
  const { status, user } = useSession();
  const isTeam = user?.role === "SHOP_OWNER" || user?.role === "SHOP_STAFF";
  const isOwner = user?.role === "SHOP_OWNER";
  const shops = useQuery({ queryKey: shopKeys.mine, queryFn: getMyShops, enabled: status === "authenticated" && isTeam });
  const shopList = shops.data ?? [];
  const shop = shopList.find((s) => s.id === searchParams.get("shop")) ?? shopList[0];
  const sub = useQuery({ queryKey: subKeys.shopPlan(shop?.id ?? ""), queryFn: () => getShopSubscription(shop?.id ?? ""), enabled: Boolean(shop) });
  const when = (iso: string | null | undefined) => (iso ? format.dateTime(new Date(iso), { day: "numeric", month: "long", year: "numeric" }) : "—");
  const taka = (n: number) => formatTaka(n, locale);
  const bn = locale === "bn";

  if (status === "loading" || shops.isPending || (shop && sub.isPending)) return <OwnerSkeleton label={t("loading")} variant="dashboard" />;
  if (!isTeam || !shop) return <div className={panel}><p className="type-body text-ink-secondary">{t("noShop")}</p></div>;
  if (shops.isError || sub.isError)
    return (
      <div role="alert" className={panel}>
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => (shops.isError ? shops.refetch() : sub.refetch())} className="type-body-medium h-11 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">{t("retry")}</button>
      </div>
    );

  const v = sub.data;
  // Subscriptions switched off: everything is free, nothing to choose.
  if (!v?.enabled)
    return (
      <div className={panel}>
        <Gift className="size-10 text-highlight" strokeWidth={1.5} aria-hidden />
        <h2 className="type-h3 text-ink">{t("freeTitle")}</h2>
        <p className="type-body max-w-md text-ink-secondary">{t("freeText")}</p>
      </div>
    );

  const s = v.subscription;
  const plan = v.plan;
  const planName = (p: { nameEn?: string; nameBn?: string } | null | undefined) => (p ? (bn && p.nameBn) || p.nameEn || "" : "");

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="my-plan" className={cn(card, "border-gold")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="type-caption text-highlight">{t("current")}</p>
            {/* Plan names come from the admin: plain text */}
            <h2 id="my-plan" className="type-h2 flex items-center gap-2 text-ink">
              <BadgeCheck className="size-6 text-highlight" aria-hidden />
              {planName(plan) || t("freePlan")}
            </h2>
          </div>
          {s?.status && <span className="type-caption rounded-full bg-highlight-soft px-2.5 py-0.5 text-highlight">{tS(s.status)}</span>}
        </div>
        {s && (
          <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {s.period && <div className="flex justify-between gap-3 sm:block"><dt className="type-caption text-ink-muted">{t("periodName")}</dt><dd className="type-body text-ink">{tP(s.period)}</dd></div>}
            {s.currentPeriodEnd && <div className="flex justify-between gap-3 sm:block"><dt className="type-caption text-ink-muted">{t("until")}</dt><dd className="type-body text-ink">{when(s.currentPeriodEnd)}</dd></div>}
            {s.trialEndsAt && <div className="flex justify-between gap-3 sm:block"><dt className="type-caption text-ink-muted">{t("trialEnds")}</dt><dd className="type-body text-ink">{when(s.trialEndsAt)}</dd></div>}
            {typeof s.price === "number" && s.price > 0 && <div className="flex justify-between gap-3 sm:block"><dt className="type-caption text-ink-muted">{t("price")}</dt><dd className="type-price text-ink">{taka(s.price)}</dd></div>}
          </dl>
        )}
        {s && (s.amountDue ?? 0) > 0 && (
          <p role="status" className="type-body flex items-start gap-2 rounded-sm bg-warning-soft p-3 text-ink">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
            {t("due", { amount: taka(s.amountDue ?? 0) })}
          </p>
        )}
        {s?.cancelAtPeriodEnd && <p className="type-body text-ink-secondary">{t("endsAtPeriodEnd", { date: when(s.currentPeriodEnd) })}</p>}

        {v.limits && Object.keys(v.limits).length > 0 && (
          <ul className="flex flex-col gap-2 border-t border-line pt-3">
            {LIMITS.filter((k) => v.limits?.[k]).map((k) => {
              const l = v.limits?.[k];
              const used = l?.used ?? 0;
              const max = l?.limit ?? null;
              const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
              return (
                <li key={k} className="flex flex-col gap-1">
                  <span className="type-body flex justify-between gap-3 text-ink">
                    <span>{t(`limit.${k}`)}</span>
                    <span className="tabular-nums text-ink-secondary">{max === null ? t("usedUnlimited", { used }) : t("usedOf", { used, max })}</span>
                  </span>
                  {max !== null && (
                    <span className="h-2 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-label={t(`limit.${k}`)} aria-valuemin={0} aria-valuemax={max} aria-valuenow={used}>
                      <span className={cn("block h-full rounded-full", pct >= 100 ? "bg-error" : pct >= 80 ? "bg-highlight" : "bg-brand")} style={{ width: `${pct}%` }} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {v.modules && v.modules.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 border-t border-line pt-3" aria-label={t("included")}>
            {v.modules.map((m) => <li key={m} className="type-caption inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-success-ink"><Check className="size-3" aria-hidden />{tM(m)}</li>)}
          </ul>
        )}
      </section>

      {v.pendingRequest && (
        <p role="status" className="type-body flex items-start gap-2 rounded-md border border-highlight bg-highlight-soft/40 p-4 text-ink">
          <Clock className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
          {t("pending", { plan: planName(v.pendingRequest.plan), period: tP(v.pendingRequest.period) })}
        </p>
      )}

      {(v.plans ?? []).length > 0 && (
        <section aria-labelledby="plans-title" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="plans-title" className="type-h2 text-ink">{t("plansTitle")}</h2>
            <p className="type-body text-ink-secondary">{t("plansText")}</p>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {(v.plans ?? []).map((p) => (
              <li key={p.id}>
                <PlanOffer p={p} shopId={shop.id} current={p.id === plan?.id} canRequest={isOwner && !v.pendingRequest} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PlanOffer({ p, shopId, current, canRequest }: { p: SubscriptionPlan; shopId: string; current: boolean; canRequest: boolean }) {
  const t = useTranslations("OwnerPlan");
  const tP = useTranslations("OwnerPlan.period");
  const tM = useTranslations("OwnerPlan.module");
  const locale = useLocale();
  const bn = locale === "bn";
  const queryClient = useQueryClient();
  const prices = PERIODS.map((period) => p.prices.find((x) => x.period === period && x.isActive)).filter((x) => x !== undefined);
  const [period, setPeriod] = useState<BillingPeriod | null>(prices[0]?.period ?? null);
  const ask = useMutation({
    mutationFn: () => requestPlan(shopId, p.id, period as BillingPeriod),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: subKeys.shopPlan(shopId) }),
  });
  const code = ask.error instanceof ApiError ? (ask.error.details as { code?: string } | undefined)?.code : undefined;
  const name = (bn && p.nameBn) || p.nameEn;
  const description = (bn && p.descriptionBn) || p.descriptionEn;
  const limit = (n: number | null) => (n === null ? t("unlimited") : String(n));

  return (
    <article className={cn(card, current && "border-brand")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="type-h3 text-ink">{name}</h3>
        {current && <span className="type-caption rounded-full bg-brand px-2.5 py-0.5 text-primary-foreground">{t("yourPlan")}</span>}
      </div>
      {description && <p className="type-body text-ink-secondary">{description}</p>}
      <ul className="flex flex-col gap-1">
        {p.modules.map((m) => <li key={m} className="type-body flex items-center gap-2 text-ink"><Check className="size-4 shrink-0 text-success-ink" aria-hidden />{tM(m)}</li>)}
      </ul>
      <p className="type-caption text-ink-secondary">{t("limitsLine", { products: limit(p.maxProducts), staff: limit(p.maxStaff), deals: limit(p.maxActiveDeals) })}</p>

      {prices.length > 0 && (
        <fieldset className="flex flex-col gap-2 border-t border-line pt-3" disabled={!canRequest || current || ask.isPending}>
          <legend className="sr-only">{t("choosePeriod", { plan: name })}</legend>
          {prices.map((x) => (
            <label key={x.period} className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 has-focus-visible:ring-2 has-focus-visible:ring-brand", period === x.period ? "border-brand bg-highlight-soft/40" : "border-line-strong")}>
              <input type="radio" name={`period-${p.id}`} checked={period === x.period} onChange={() => setPeriod(x.period)} className="size-4 accent-brand" />
              <span className="flex flex-1 flex-wrap items-baseline justify-between gap-2">
                <span className="type-body-medium text-ink">{tP(x.period)}</span>
                <span className="type-price text-ink">
                  {formatTaka(x.amount, locale)}
                  {x.months > 1 && <span className="type-caption text-ink-muted"> · {t("perMonth", { amount: formatTaka(x.monthlyEquivalent, locale) })}</span>}
                  {x.savingPercent ? <span className="type-caption text-success-ink"> · {t("saving", { percent: Math.round(x.savingPercent) })}</span> : null}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {ask.isSuccess ? (
        <p role="status" className="type-body text-success-ink">{t("requested")}</p>
      ) : (
        canRequest &&
        !current &&
        period && (
          <button type="button" onClick={() => ask.mutate()} disabled={ask.isPending} aria-busy={ask.isPending} className="type-body-medium inline-flex h-11 items-center justify-center gap-1.5 self-start rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60">
            {ask.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {t("request")}
          </button>
        )
      )}
      {ask.isError && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {code === "REQUEST_PENDING" ? t("errors.pending") : code === "PLAN_NOT_AVAILABLE" ? t("errors.notAvailable") : ask.error instanceof ApiError && ask.error.status === 0 ? t("errors.network") : t("errors.generic")}
        </p>
      )}
    </article>
  );
}
