"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, LoaderCircle, Search, ShieldAlert } from "lucide-react";
import { useLocale, useNow, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { DayBars } from "@/components/admin/day-bars";
import { listAdminShops } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/core";
import { getSubSettings, getSubSummary, listPlans, PERIODS, setSubSettings, startShopPlan, subKeys, type BillingPeriod } from "@/lib/api/subscriptions";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

export const subOutline = "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60";
export const subSolid = "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60";
export const subField = "type-body h-11 w-full rounded-sm border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";
export const subCard = "flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card md:p-5";

/** YYYY-MM-DD in Dhaka, `daysAgo` days before `now`. */
export function dhakaDay(now: Date, daysAgo = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now.getTime() - daysAgo * 86_400_000));
}

export function useSubError() {
  const t = useTranslations("AdminSubscriptions");
  return (err: unknown) => {
    if (err instanceof ApiError) {
      const code = (err.details as { code?: string } | undefined)?.code;
      if (code && ["PLAN_IN_USE", "FREE_PLAN", "PLAN_NOT_AVAILABLE", "REQUEST_PENDING", "ONLINE_NOT_AVAILABLE"].includes(code)) return t(`errors.${code}`);
      if (err.status === 0) return t("errors.network");
      if (err.status === 400) return t("errors.invalid");
      if (err.status === 404) return t("errors.gone");
      if (err.status === 409) return t("errors.conflict");
    }
    return t("errors.generic");
  };
}

/** The master switch (off = everything free, plans hidden from shops) and the trial/grace days. */
export function SubscriptionSwitch() {
  const t = useTranslations("AdminSubscriptions");
  const uid = useId();
  const queryClient = useQueryClient();
  const errorText = useSubError();
  const settings = useQuery({ queryKey: subKeys.settings, queryFn: getSubSettings });
  const [confirmOn, setConfirmOn] = useState(false);
  const [days, setDays] = useState<{ trial: string; grace: string } | null>(null);
  const save = useMutation({
    mutationFn: setSubSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(subKeys.settings, data);
      void queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      setConfirmOn(false);
      setDays(null);
    },
  });

  if (settings.isPending) return <div className="relative h-28 skeleton overflow-hidden rounded-md" aria-hidden />;
  if (settings.isError)
    return (
      <div role="alert" className="flex items-center gap-3 rounded-md border border-line bg-card p-4">
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => settings.refetch()} className={subOutline}>{t("retry")}</button>
      </div>
    );
  const s = settings.data;
  const d = days ?? { trial: String(s.freeTrialDays), grace: String(s.graceDays) };
  const dayOk = (x: string) => /^\d{1,3}$/.test(x) && Number(x) <= 365;

  function onDays(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dayOk(d.trial) || !dayOk(d.grace)) return;
    save.mutate({ freeTrialDays: Number(d.trial), graceDays: Number(d.grace) });
  }

  return (
    <section aria-labelledby="sub-switch" className={cn(subCard, s.subscriptionsEnabled ? "border-gold" : "")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id="sub-switch" className="type-h3 text-ink">{t("switchTitle")}</h2>
          <p className="type-body text-ink-secondary" aria-live="polite">{s.subscriptionsEnabled ? t("switchOn") : t("switchOff")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={s.subscriptionsEnabled}
          aria-labelledby="sub-switch"
          disabled={save.isPending}
          onClick={() => (s.subscriptionsEnabled ? save.mutate({ subscriptionsEnabled: false }) : setConfirmOn(true))}
          className={cn("relative inline-flex h-11 w-20 shrink-0 items-center rounded-full border-2 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60", s.subscriptionsEnabled ? "border-brand bg-brand" : "border-line-strong bg-subtle")}
        >
          <span aria-hidden className={cn("absolute size-8 rounded-full bg-card shadow-card motion-safe:transition-transform motion-safe:duration-200", s.subscriptionsEnabled ? "translate-x-10" : "translate-x-1")} />
        </button>
      </div>

      {confirmOn && (
        <div role="alertdialog" aria-labelledby={`${uid}-ct`} className="flex flex-col gap-2 rounded-sm border border-highlight bg-highlight-soft/50 p-3">
          <p id={`${uid}-ct`} className="type-body-medium flex items-start gap-2 text-ink">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
            {t("confirmOnTitle")}
          </p>
          <p className="type-body text-ink-secondary">{t("confirmOnText")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => save.mutate({ subscriptionsEnabled: true })} disabled={save.isPending} aria-busy={save.isPending} className={subSolid}>
              {save.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {t("confirmOn")}
            </button>
            <button type="button" onClick={() => setConfirmOn(false)} className="type-body-medium h-11 rounded-sm px-4 text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">{t("cancel")}</button>
          </div>
        </div>
      )}

      <form onSubmit={onDays} className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
        <label htmlFor={`${uid}-t`} className="flex w-36 flex-col gap-1">
          <span className="type-caption text-ink-secondary">{t("trialDays")}</span>
          <input id={`${uid}-t`} inputMode="numeric" value={d.trial} onChange={(e) => setDays({ ...d, trial: e.target.value.replace(/\D/g, "").slice(0, 3) })} className={subField} />
        </label>
        <label htmlFor={`${uid}-g`} className="flex w-36 flex-col gap-1">
          <span className="type-caption text-ink-secondary">{t("graceDays")}</span>
          <input id={`${uid}-g`} inputMode="numeric" value={d.grace} onChange={(e) => setDays({ ...d, grace: e.target.value.replace(/\D/g, "").slice(0, 3) })} className={subField} />
        </label>
        <button type="submit" disabled={days === null || !dayOk(d.trial) || !dayOk(d.grace) || save.isPending} className={subOutline}>{t("saveDays")}</button>
      </form>
      {save.isError && <p role="alert" className="type-body text-error">{errorText(save.error)}</p>}
    </section>
  );
}

/** Headline numbers for the last 30 days: who pays, who is on trial or free, who owes, revenue. */
export function SubscriptionSummaryTiles() {
  const t = useTranslations("AdminSubscriptions");
  const locale = useLocale();
  const now = useNow({ updateInterval: 60_000 });
  const to = dhakaDay(now);
  const from = dhakaDay(now, 29);
  const summary = useQuery({ queryKey: subKeys.summary(from, to), queryFn: () => getSubSummary(from, to) });
  const taka = (n: number) => formatTaka(n, locale);

  if (summary.isPending) return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="relative h-24 skeleton overflow-hidden rounded-md" aria-hidden />)}</div>;
  if (summary.isError)
    return (
      <div role="alert" className="flex items-center gap-3 rounded-md border border-line bg-card p-4">
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => summary.refetch()} className={subOutline}>{t("retry")}</button>
      </div>
    );
  const s = summary.data;
  const tiles: { label: string; value: string; sub?: string; alert?: boolean }[] = [
    { label: t("tileShops"), value: String(s.shops), sub: t("tileShopsSub") },
    { label: t("tilePaying"), value: String(s.counts.paying) },
    { label: t("tileTrial"), value: String(s.counts.trial) },
    { label: t("tileFree"), value: String(s.counts.free) },
    { label: t("tileUnpaid"), value: String(s.counts.unpaid), alert: s.counts.unpaid > 0 },
    { label: t("tileExpiring"), value: String(s.counts.expiringNext7Days), alert: s.counts.expiringNext7Days > 0 },
    { label: t("tileMrr"), value: taka(s.mrr), sub: t("tileMrrSub") },
    { label: t("tileRevenue"), value: taka(s.revenue.total), sub: t("tileRevenueSub", { churned: s.counts.churned }) },
  ];
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((x) => (
          <li key={x.label} className={cn("flex flex-col gap-1 rounded-md border bg-card p-4 shadow-card", x.alert ? "border-gold" : "border-line")}>
            <span className="type-caption text-ink-secondary">{x.label}</span>
            <span className="type-h2 text-ink tabular-nums">{x.value}</span>
            {x.sub && <span className="type-caption text-ink-muted">{x.sub}</span>}
          </li>
        ))}
      </ul>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DayBars
          title={t("revenuePerDay")}
          points={s.revenue.byDay.flatMap((d) => (d.day ? [{ day: d.day, value: d.amount ?? 0 }] : []))}
          format={taka}
          summary={t("revenueSummary", { total: taka(s.revenue.total) })}
        />
        <section className={subCard} aria-labelledby="by-plan">
          <h2 id="by-plan" className="type-h3 text-ink">{t("byPlan")}</h2>
          <ul className="flex flex-col gap-2">
            {s.byPlan.map((p) => (
              <li key={p.planId ?? p.code} className="type-body flex justify-between gap-3 border-t border-line pt-2 first:border-t-0 first:pt-0">
                <span className="text-ink">{p.nameEn ?? p.code}</span>
                <span className="text-ink-secondary tabular-nums">{t("shopsCount", { count: p.shops ?? 0 })}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** Start or change a shop's plan by hand (the admin records the payment afterwards). */
export function StartPlan() {
  const t = useTranslations("AdminSubscriptions");
  const tP = useTranslations("AdminSubscriptions.period");
  const uid = useId();
  const queryClient = useQueryClient();
  const errorText = useSubError();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState<string | null>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [v, setV] = useState({ planId: "", period: "MONTHLY" as BillingPeriod, trialDays: "", note: "" });
  const [done, setDone] = useState(false);
  const shops = useQuery({ queryKey: ["admin", "shops", { q: search, page: 1 }], queryFn: () => listAdminShops({ q: search ?? undefined, page: 1 }), enabled: search !== null });
  const plans = useQuery({ queryKey: subKeys.plans, queryFn: listPlans });
  const plan = plans.data?.find((p) => p.id === v.planId);
  const periods = plan ? PERIODS.filter((p) => plan.prices.some((x) => x.period === p && x.isActive)) : PERIODS;

  const start = useMutation({
    mutationFn: () => startShopPlan(shopId as string, { planId: v.planId, period: v.period, ...(v.trialDays && { trialDays: Number(v.trialDays) }), ...(v.note.trim() && { note: v.note.trim() }) }),
    onMutate: () => setDone(false),
    onSuccess: () => {
      setDone(true);
      void queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
    },
  });

  return (
    <section aria-labelledby={`${uid}-h`} className={subCard}>
      <div className="flex flex-col gap-1">
        <h2 id={`${uid}-h`} className="type-h3 text-ink">{t("startTitle")}</h2>
        <p className="type-caption text-ink-muted">{t("startText")}</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.replace(/\p{Cc}/gu, "").trim().slice(0, 100));
        }}
        className="flex gap-2"
      >
        <input type="search" aria-label={t("shopSearch")} placeholder={t("shopSearch")} maxLength={100} value={q} onChange={(e) => setQ(e.target.value)} className={subField} />
        <button type="submit" className={subOutline}><Search className="size-4" aria-hidden />{t("find")}</button>
      </form>
      {search !== null &&
        (shops.isPending ? (
          <div className="relative h-11 skeleton overflow-hidden rounded-sm" aria-hidden />
        ) : shops.isError ? (
          <p role="alert" className="type-body text-error">{t("loadError")}</p>
        ) : (shops.data.data ?? []).length === 0 ? (
          <p className="type-body text-ink-secondary">{t("noShops")}</p>
        ) : (
          <div role="radiogroup" aria-label={t("pickShop")} className="flex flex-wrap gap-2">
            {(shops.data.data ?? []).slice(0, 12).map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={shopId === s.id} onClick={() => setShopId(s.id)} className={cn("type-body h-11 rounded-full border px-4 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none", shopId === s.id ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand")}>
                {s.name}
              </button>
            ))}
          </div>
        ))}

      {shopId && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (v.planId && periods.includes(v.period)) start.mutate();
          }}
          className="flex flex-col gap-3 border-t border-line pt-3"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label htmlFor={`${uid}-p`} className="flex flex-col gap-1">
              <span className="type-body-medium text-ink">{t("plan")}</span>
              <select id={`${uid}-p`} value={v.planId} onChange={(e) => setV({ ...v, planId: e.target.value })} className={subField}>
                <option value="">{t("choose")}</option>
                {(plans.data ?? []).filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.nameEn}</option>)}
              </select>
            </label>
            <label htmlFor={`${uid}-per`} className="flex flex-col gap-1">
              <span className="type-body-medium text-ink">{t("periodLabel")}</span>
              <select id={`${uid}-per`} value={v.period} onChange={(e) => setV({ ...v, period: PERIODS.find((x) => x === e.target.value) ?? "MONTHLY" })} className={subField}>
                {periods.map((p) => <option key={p} value={p}>{tP(p)}</option>)}
              </select>
            </label>
            <label htmlFor={`${uid}-tr`} className="flex flex-col gap-1">
              <span className="type-body-medium text-ink">{t("trialDaysOptional")}</span>
              <input id={`${uid}-tr`} inputMode="numeric" value={v.trialDays} onChange={(e) => setV({ ...v, trialDays: e.target.value.replace(/\D/g, "").slice(0, 3) })} className={subField} />
            </label>
          </div>
          <label htmlFor={`${uid}-n`} className="flex flex-col gap-1">
            <span className="type-body-medium text-ink">{t("noteOptional")}</span>
            <input id={`${uid}-n`} maxLength={300} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} className={subField} />
          </label>
          {start.isError && <p role="alert" className="type-body flex items-start gap-2 text-error"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{errorText(start.error)}</p>}
          {done && <p role="status" className="type-body flex items-start gap-2 text-success-ink"><CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />{t("started")}</p>}
          <button type="submit" disabled={!v.planId || start.isPending} aria-busy={start.isPending} className={cn(subSolid, "self-start")}>
            {start.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {t("start")}
          </button>
        </form>
      )}
    </section>
  );
}
