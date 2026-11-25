"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, LoaderCircle, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { subCard, subField, subOutline, subSolid, useSubError } from "@/components/admin/subscriptions-overview";
import {
  createPlan,
  deletePlan,
  listPlans,
  MODULES,
  PERIODS,
  setPlanPrices,
  subKeys,
  updatePlan,
  type BillingPeriod,
  type PlanInput,
  type SubscriptionModule,
  type SubscriptionPlan,
} from "@/lib/api/subscriptions";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

type Plan = SubscriptionPlan & { currentShops?: number };

/** Admin: plans (which modules and limits they unlock) and their prices per billing period. */
export function SubscriptionPlans() {
  const t = useTranslations("AdminSubscriptions.plans");
  const plans = useQuery({ queryKey: subKeys.plans, queryFn: listPlans });
  const [editing, setEditing] = useState<Plan | "new" | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="type-body max-w-2xl text-ink-secondary">{t("text")}</p>
        {editing === null && (
          <button type="button" onClick={() => setEditing("new")} className={subSolid}>
            <Plus className="size-4" aria-hidden />
            {t("add")}
          </button>
        )}
      </div>

      {editing !== null && (
        <div className={subCard}>
          <h2 className="type-h3 text-ink">{editing === "new" ? t("newTitle") : t("editTitle", { name: editing.nameEn })}</h2>
          <PlanForm key={editing === "new" ? "new" : editing.id} plan={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
        </div>
      )}

      {plans.isPending ? (
        <div className="relative h-40 skeleton overflow-hidden rounded-md" aria-hidden />
      ) : plans.isError ? (
        <div role="alert" className="flex items-center gap-3 rounded-md border border-line bg-card p-4">
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => plans.refetch()} className={subOutline}>{t("retry")}</button>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {plans.data.map((p) => (
            <li key={p.id}>
              <PlanCard p={p} onEdit={() => setEditing(p)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlanCard({ p, onEdit }: { p: Plan; onEdit: () => void }) {
  const t = useTranslations("AdminSubscriptions.plans");
  const tM = useTranslations("AdminSubscriptions.module");
  const tP = useTranslations("AdminSubscriptions.period");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorText = useSubError();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
  const toggle = useMutation({ mutationFn: () => updatePlan(p.id, { isActive: !p.isActive }), onSuccess: refresh });
  const publish = useMutation({ mutationFn: () => updatePlan(p.id, { isPublished: !p.isPublished }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: () => deletePlan(p.id), onSuccess: refresh, onError: () => setConfirmDelete(false) });
  const error = toggle.error ?? publish.error ?? remove.error;
  const isFree = p.code === "FREE";
  const limit = (n: number | null) => (n === null ? t("unlimited") : String(n));

  return (
    <article className={cn(subCard, !p.isActive && "opacity-75")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col">
          {/* Admin text: plain text */}
          <h3 className="type-h3 text-ink">{p.nameEn}</h3>
          <span className="type-caption text-ink-muted">{p.code}{p.nameBn ? ` · ${p.nameBn}` : ""}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={cn("type-caption rounded-full px-2 py-0.5", p.isActive ? "bg-success-soft text-success-ink" : "bg-subtle text-ink-secondary")}>{p.isActive ? t("active") : t("off")}</span>
          <span className={cn("type-caption rounded-full px-2 py-0.5", p.isPublished ? "bg-info-soft text-ink" : "bg-subtle text-ink-secondary")}>{p.isPublished ? t("published") : t("hidden")}</span>
        </div>
      </div>
      {p.descriptionEn && <p className="type-body text-ink-secondary">{p.descriptionEn}</p>}

      <ul className="flex flex-wrap gap-1.5" aria-label={t("modules")}>
        {p.modules.map((m) => <li key={m} className="type-caption rounded-full bg-highlight-soft px-2 py-0.5 text-highlight">{tM(m)}</li>)}
        {p.modules.length === 0 && <li className="type-caption text-ink-muted">{t("noModules")}</li>}
      </ul>
      <p className="type-caption text-ink-secondary">{t("limitsLine", { products: limit(p.maxProducts), staff: limit(p.maxStaff), deals: limit(p.maxActiveDeals) })}</p>

      <ul className="flex flex-col gap-1 border-t border-line pt-2">
        {p.prices.length === 0 && <li className="type-caption text-ink-muted">{t("noPrices")}</li>}
        {p.prices.map((x) => (
          <li key={x.period} className={cn("type-body flex flex-wrap justify-between gap-2", !x.isActive && "text-ink-muted line-through")}>
            <span>{tP(x.period)}</span>
            <span className="tabular-nums">
              {formatTaka(x.amount, locale)}
              {x.months > 1 && <span className="type-caption text-ink-muted"> · {t("perMonth", { amount: formatTaka(x.monthlyEquivalent, locale) })}</span>}
              {x.savingPercent ? <span className="type-caption text-success-ink"> · {t("saving", { percent: x.savingPercent })}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="type-caption text-ink-muted">{t("currentShops", { count: p.currentShops ?? 0 })}</p>

      {confirmDelete ? (
        <div className="flex flex-col gap-2 rounded-sm bg-error-soft/50 p-3">
          <p className="type-body text-ink">{t("deleteConfirm", { name: p.nameEn })}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} aria-busy={remove.isPending} className="type-body-medium inline-flex h-11 items-center gap-1.5 rounded-sm bg-error px-4 text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none disabled:opacity-60">
              {remove.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {t("delete")}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="type-body-medium h-11 rounded-sm px-4 text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">{t("keep")}</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onEdit} className={subOutline}>{t("edit")}</button>
          <button type="button" onClick={() => publish.mutate()} disabled={publish.isPending} className={subOutline}>{p.isPublished ? t("unpublish") : t("publish")}</button>
          {!isFree && (
            <>
              <button type="button" onClick={() => toggle.mutate()} disabled={toggle.isPending} className={subOutline}>{p.isActive ? t("switchOff") : t("switchOn")}</button>
              <button type="button" onClick={() => setConfirmDelete(true)} className="type-body-medium h-11 rounded-sm px-3 text-error hover:bg-error-soft focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none">{t("delete")}</button>
            </>
          )}
        </div>
      )}
      {error && <p role="alert" className="type-body flex items-start gap-2 text-error"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{errorText(error)}</p>}
    </article>
  );
}

type PriceRow = { amount: string; isActive: boolean; on: boolean };

/** Plan details, then its prices (saved together: the plan first, then the prices). */
function PlanForm({ plan, onDone }: { plan: Plan | null; onDone: () => void }) {
  const t = useTranslations("AdminSubscriptions.plans");
  const tM = useTranslations("AdminSubscriptions.module");
  const tP = useTranslations("AdminSubscriptions.period");
  const locale = useLocale();
  const uid = useId();
  const queryClient = useQueryClient();
  const errorText = useSubError();
  const isFree = plan?.code === "FREE";
  const [v, setV] = useState({
    code: plan?.code ?? "",
    nameEn: plan?.nameEn ?? "",
    nameBn: plan?.nameBn ?? "",
    descriptionEn: plan?.descriptionEn ?? "",
    descriptionBn: plan?.descriptionBn ?? "",
    modules: plan?.modules ?? ([] as SubscriptionModule[]),
    maxProducts: plan?.maxProducts === null || plan?.maxProducts === undefined ? "" : String(plan.maxProducts),
    maxStaff: plan?.maxStaff === null || plan?.maxStaff === undefined ? "" : String(plan.maxStaff),
    maxActiveDeals: plan?.maxActiveDeals === null || plan?.maxActiveDeals === undefined ? "" : String(plan.maxActiveDeals),
    isPublished: plan?.isPublished ?? false,
    isActive: plan?.isActive ?? true,
    sortOrder: String(plan?.sortOrder ?? 10),
  });
  const [prices, setPrices] = useState<Record<BillingPeriod, PriceRow>>(() =>
    Object.fromEntries(
      PERIODS.map((p) => {
        const x = plan?.prices.find((y) => y.period === p);
        return [p, { amount: x ? String(x.amount) : "", isActive: x?.isActive ?? true, on: Boolean(x) }];
      }),
    ) as Record<BillingPeriod, PriceRow>,
  );
  const [problem, setProblem] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const lim = (s: string) => (s === "" ? null : Number(s));
      const input: PlanInput = {
        code: v.code.trim().toUpperCase(),
        nameEn: v.nameEn.trim(),
        nameBn: v.nameBn.trim(),
        descriptionEn: v.descriptionEn.trim() || null,
        descriptionBn: v.descriptionBn.trim() || null,
        modules: v.modules,
        maxProducts: lim(v.maxProducts),
        maxStaff: lim(v.maxStaff),
        maxActiveDeals: lim(v.maxActiveDeals),
        isPublished: v.isPublished,
        isActive: v.isActive,
        sortOrder: Number(v.sortOrder) || 0,
      };
      const saved = plan ? await updatePlan(plan.id, isFree ? { ...input, code: undefined, isActive: undefined } : input) : await createPlan(input);
      const list = PERIODS.filter((p) => prices[p].on).map((p) => ({ period: p, amount: Number(prices[p].amount), isActive: prices[p].isActive }));
      return setPlanPrices(saved.id, list);
    },
    onMutate: () => setProblem(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      onDone();
    },
    onError: (err) => setProblem(errorText(err)),
  });

  const limitOk = (s: string) => s === "" || /^\d{1,6}$/.test(s);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!/^[A-Z0-9_]{2,30}$/.test(v.code.trim().toUpperCase())) return setProblem(t("errors.code"));
    if (v.nameEn.trim().length < 2 || v.nameBn.trim().length < 2) return setProblem(t("errors.names"));
    if (![v.maxProducts, v.maxStaff, v.maxActiveDeals].every(limitOk)) return setProblem(t("errors.limits"));
    const on = PERIODS.filter((p) => prices[p].on);
    if (on.length === 0) return setProblem(t("errors.noPrice"));
    if (!on.every((p) => /^\d{1,7}$/.test(prices[p].amount))) return setProblem(t("errors.price"));
    save.mutate();
  }

  // Monthly price for comparing longer periods (as the server does)
  const monthly = prices.MONTHLY.on && /^\d+$/.test(prices.MONTHLY.amount) ? Number(prices.MONTHLY.amount) : null;
  const MONTHS: Record<BillingPeriod, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 };
  const input = (key: "code" | "nameEn" | "nameBn" | "sortOrder", label: string, max: number, disabled = false) => (
    <label htmlFor={`${uid}-${key}`} className="flex flex-col gap-1">
      <span className="type-body-medium text-ink">{label}</span>
      <input id={`${uid}-${key}`} maxLength={max} disabled={disabled} value={v[key]} onChange={(e) => setV({ ...v, [key]: key === "sortOrder" ? e.target.value.replace(/\D/g, "").slice(0, 4) : e.target.value })} className={cn(subField, "disabled:bg-subtle")} />
    </label>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {input("code", t("code"), 30, isFree)}
        {input("nameEn", t("nameEn"), 60)}
        {input("nameBn", t("nameBn"), 60)}
        {input("sortOrder", t("sortOrder"), 4)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["descriptionEn", "descriptionBn"] as const).map((key) => (
          <label key={key} htmlFor={`${uid}-${key}`} className="flex flex-col gap-1">
            <span className="type-body-medium text-ink">{t(key)}</span>
            <textarea id={`${uid}-${key}`} rows={2} maxLength={300} value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} className="type-body w-full rounded-sm border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none" />
          </label>
        ))}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="type-body-medium mb-1 text-ink">{t("modules")}</legend>
        <div className="flex flex-wrap gap-2">
          {MODULES.map((m) => {
            const on = v.modules.includes(m);
            return (
              <button key={m} type="button" aria-pressed={on} onClick={() => setV({ ...v, modules: on ? v.modules.filter((x) => x !== m) : [...v.modules, m] })} className={cn("type-body inline-flex h-11 items-center gap-1 rounded-full border px-3 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none", on ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand")}>
                {on && <Check className="size-4" aria-hidden />}
                {tM(m)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        {(["maxProducts", "maxStaff", "maxActiveDeals"] as const).map((key) => (
          <label key={key} htmlFor={`${uid}-${key}`} className="flex flex-col gap-1">
            <span className="type-body-medium text-ink">{t(key)}</span>
            <input id={`${uid}-${key}`} inputMode="numeric" placeholder={t("unlimited")} value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value.replace(/\D/g, "").slice(0, 6) })} className={subField} />
          </label>
        ))}
      </div>
      <p className="-mt-2 type-caption text-ink-muted">{t("limitsHint")}</p>

      <fieldset className="flex flex-col gap-2">
        <legend className="type-body-medium mb-1 text-ink">{t("prices")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PERIODS.map((p) => {
            const row = prices[p];
            const amount = /^\d+$/.test(row.amount) ? Number(row.amount) : null;
            const saving = monthly && amount !== null && p !== "MONTHLY" && monthly * MONTHS[p] > 0 ? Math.round((1 - amount / (monthly * MONTHS[p])) * 100) : null;
            return (
              <div key={p} className={cn("flex flex-col gap-2 rounded-sm border p-3", row.on ? "border-line-strong" : "border-line bg-subtle")}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={row.on} onChange={(e) => setPrices({ ...prices, [p]: { ...row, on: e.target.checked } })} className="size-5 accent-brand" />
                  <span className="type-body-medium text-ink">{tP(p)}</span>
                </label>
                {row.on && (
                  <>
                    <label htmlFor={`${uid}-${p}`} className="flex flex-col gap-1">
                      <span className="type-caption text-ink-secondary">{t("amount")}</span>
                      <input id={`${uid}-${p}`} inputMode="numeric" value={row.amount} onChange={(e) => setPrices({ ...prices, [p]: { ...row, amount: e.target.value.replace(/\D/g, "").slice(0, 7) } })} className={subField} />
                    </label>
                    {amount !== null && MONTHS[p] > 1 && (
                      <p className="type-caption text-ink-muted">
                        {t("perMonth", { amount: formatTaka(amount / MONTHS[p], locale) })}
                        {saving !== null && saving > 0 && <span className="text-success-ink"> · {t("saving", { percent: saving })}</span>}
                      </p>
                    )}
                    <label className="flex min-h-11 cursor-pointer items-center gap-3">
                      <input type="checkbox" checked={row.isActive} onChange={(e) => setPrices({ ...prices, [p]: { ...row, isActive: e.target.checked } })} className="size-5 accent-brand" />
                      <span className="type-caption text-ink">{t("priceOffered")}</span>
                    </label>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-x-6">
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" checked={v.isPublished} onChange={(e) => setV({ ...v, isPublished: e.target.checked })} className="size-5 accent-brand" />
          <span className="type-body text-ink">{t("publishedLabel")}</span>
        </label>
        {!isFree && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} className="size-5 accent-brand" />
            <span className="type-body text-ink">{t("activeLabel")}</span>
          </label>
        )}
      </div>

      {problem && <p role="alert" className="type-body flex items-start gap-2 text-error"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{problem}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={save.isPending} aria-busy={save.isPending} className={subSolid}>
          {save.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {save.isPending ? t("saving") : t("save")}
        </button>
        <button type="button" onClick={onDone} disabled={save.isPending} className="type-body-medium h-11 rounded-sm px-4 text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">{t("cancel")}</button>
      </div>
    </form>
  );
}
