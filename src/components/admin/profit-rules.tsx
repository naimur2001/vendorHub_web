"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle, Plus, TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/core";
import {
  createProfitRule,
  deleteProfitRule,
  deliveryKeys,
  errorCode,
  listCouriers,
  listDeliveryZones,
  listProfitRules,
  updateProfitRule,
  type ProfitRule,
  type ProfitRuleBase,
  type ProfitRuleInput,
  type ProfitRuleType,
} from "@/lib/api/delivery";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const outline = "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60";
const solid = "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60";
const field = "type-body h-11 w-full rounded-sm border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";
const card = "flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card md:p-5";

function useRuleError() {
  const t = useTranslations("AdminDelivery.profit");
  return (err: unknown) => {
    if (err instanceof ApiError) {
      const code = errorCode(err.details);
      if (code === "RULE_SCOPE_TAKEN" || code === "BAD_RULE" || code === "ZONE_NOT_FOUND" || code === "COURIER_NOT_FOUND") return t(`errors.${code}`);
      if (err.status === 0) return t("errors.network");
      if (err.status === 400) return t("errors.BAD_RULE");
    }
    return t("errors.generic");
  };
}

/** "৳25 per shipment" or "30% of the courier cost". */
function useRuleValue() {
  const t = useTranslations("AdminDelivery.profit");
  const locale = useLocale();
  return (r: { type: ProfitRuleType; value: number; percentOf: ProfitRuleBase | null }) =>
    r.type === "FIXED" ? t("valueFixed", { amount: formatTaka(r.value, locale) }) : t("valuePercent", { value: r.value, base: t(`base.${r.percentOf ?? "CUSTOMER_FEE"}`) });
}

/**
 * Admin: target profit per courier shipment, for reports only (the Delivery monitor compares the real
 * profit with it). Customers still pay the zone fee. Amounts are decided later, so rules come and go.
 */
export function ProfitRules() {
  const t = useTranslations("AdminDelivery.profit");
  const rules = useQuery({ queryKey: deliveryKeys.profitRules, queryFn: listProfitRules });
  const [adding, setAdding] = useState(false);

  return (
    <section aria-labelledby="profit-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="profit-title" className="type-h2 flex items-center gap-2 text-ink">
            <TrendingUp className="size-6 text-highlight" aria-hidden />
            {t("title")}
          </h2>
          <p className="type-body max-w-2xl text-ink-secondary">{t("text")}</p>
        </div>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className={solid}>
            <Plus className="size-4" aria-hidden />
            {t("add")}
          </button>
        )}
      </div>

      {adding && (
        <div className={card}>
          <h3 className="type-h3 text-ink">{t("newRule")}</h3>
          <RuleForm onDone={() => setAdding(false)} />
        </div>
      )}

      {rules.isPending ? (
        <div className="relative h-32 skeleton overflow-hidden rounded-md" aria-hidden />
      ) : rules.isError ? (
        <div role="alert" className="flex items-center gap-3 rounded-md border border-line bg-card p-4">
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => rules.refetch()} className={outline}>{t("retry")}</button>
        </div>
      ) : rules.data.length === 0 ? (
        !adding && <p className="type-body rounded-md border border-dashed border-line-strong p-6 text-center text-ink-secondary">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rules.data.map((r) => (
            <li key={r.id}>
              <RuleCard r={r} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RuleCard({ r }: { r: ProfitRule }) {
  const t = useTranslations("AdminDelivery.profit");
  const queryClient = useQueryClient();
  const errorText = useRuleError();
  const valueText = useRuleValue();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "delivery"] }); // rules and the reports

  const toggle = useMutation({ mutationFn: () => updateProfitRule(r.id, { isActive: !r.isActive }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: () => deleteProfitRule(r.id), onSuccess: refresh });
  const error = toggle.error ?? remove.error;

  return (
    <article className={cn(card, !r.isActive && "opacity-75")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        {/* Admin text: plain text */}
        <h3 className="type-h3 text-ink">{r.name}</h3>
        <span className={cn("type-caption rounded-full px-2.5 py-0.5", r.isActive ? "bg-success-soft text-success-ink" : "bg-subtle text-ink-secondary")}>{r.isActive ? t("active") : t("off")}</span>
      </div>
      {!editing && (
        <>
          <p className="type-price text-brand">{valueText(r)}</p>
          <p className="type-caption text-ink-secondary">{t("scope", { zone: r.zoneName ?? t("allZones"), courier: r.providerName ?? t("allCouriers") })}</p>
        </>
      )}

      {editing ? (
        <RuleForm rule={r} onDone={() => setEditing(false)} />
      ) : confirmDelete ? (
        <div className="flex flex-col gap-2 rounded-sm bg-error-soft/50 p-3">
          <p className="type-body text-ink">{t("deleteConfirm", { name: r.name })}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} aria-busy={remove.isPending} className="type-body-medium inline-flex h-11 items-center gap-1.5 rounded-sm bg-error px-4 text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none disabled:opacity-60">
              {remove.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {t("delete")}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} disabled={remove.isPending} className="type-body-medium h-11 rounded-sm px-4 text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">{t("keep")}</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing(true)} className={outline}>{t("edit")}</button>
          <button type="button" onClick={() => toggle.mutate()} disabled={toggle.isPending} aria-busy={toggle.isPending} className={outline}>
            {toggle.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {r.isActive ? t("switchOff") : t("switchOn")}
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)} className="type-body-medium h-11 rounded-sm px-4 text-error hover:bg-error-soft focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none">{t("delete")}</button>
        </div>
      )}
      {error && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {errorText(error)}
        </p>
      )}
    </article>
  );
}

/** Add or edit one rule. The server checks everything again (value range, scope taken). */
function RuleForm({ rule, onDone }: { rule?: ProfitRule; onDone: () => void }) {
  const t = useTranslations("AdminDelivery.profit");
  const uid = useId();
  const queryClient = useQueryClient();
  const errorText = useRuleError();
  const valueText = useRuleValue();
  const zones = useQuery({ queryKey: deliveryKeys.zones, queryFn: listDeliveryZones });
  const couriers = useQuery({ queryKey: deliveryKeys.couriers, queryFn: listCouriers });
  const [v, setV] = useState({
    name: rule?.name ?? "",
    type: rule?.type ?? ("FIXED" as ProfitRuleType),
    value: rule ? String(rule.value) : "",
    percentOf: rule?.percentOf ?? ("COURIER_COST" as ProfitRuleBase),
    zoneId: rule?.zoneId ?? "",
    providerId: rule?.providerId ?? "",
    isActive: rule?.isActive ?? true,
  });
  const [problem, setProblem] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (input: ProfitRuleInput) => (rule ? updateProfitRule(rule.id, input) : createProfitRule(input)),
    onMutate: () => setProblem(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "delivery"] });
      onDone();
    },
    onError: (err) => setProblem(errorText(err)),
  });

  const num = Number(v.value);
  const valueOk =
    v.value.trim() !== "" &&
    (v.type === "FIXED" ? /^\d{1,4}$/.test(v.value) && num <= 5000 : /^\d{1,3}(\.\d{1,2})?$/.test(v.value) && num <= 100);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = v.name.replace(/\p{Cc}/gu, "").trim();
    if (name.length < 2 || name.length > 60) return setProblem(t("errors.name"));
    if (!valueOk) return setProblem(v.type === "FIXED" ? t("errors.fixed") : t("errors.percent"));
    save.mutate({
      name,
      type: v.type,
      value: num,
      percentOf: v.type === "PERCENT" ? v.percentOf : null,
      zoneId: v.zoneId || null,
      providerId: v.providerId || null,
      isActive: v.isActive,
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <label htmlFor={`${uid}-n`} className="flex flex-col gap-1">
        <span className="type-body-medium text-ink">{t("name")}</span>
        <input id={`${uid}-n`} value={v.name} maxLength={60} placeholder={t("namePlaceholder")} onChange={(e) => setV({ ...v, name: e.target.value })} className={field} />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="type-body-medium mb-1 text-ink">{t("type")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["FIXED", "PERCENT"] as const).map((type) => (
            <label key={type} className={cn("type-body flex h-11 cursor-pointer items-center gap-2 rounded-full border px-4 has-focus-visible:ring-2 has-focus-visible:ring-brand", v.type === type ? "border-brand bg-highlight-soft/40 text-ink" : "border-line-strong bg-card text-ink hover:border-brand")}>
              <input type="radio" name={`${uid}-type`} checked={v.type === type} onChange={() => setV({ ...v, type, value: "" })} className="size-4 accent-brand" />
              {t(`types.${type}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={`${uid}-v`} className="flex flex-col gap-1">
          <span className="type-body-medium text-ink">{v.type === "FIXED" ? t("valueTaka") : t("valuePct")}</span>
          <input
            id={`${uid}-v`}
            value={v.value}
            inputMode={v.type === "FIXED" ? "numeric" : "decimal"}
            onChange={(e) => setV({ ...v, value: v.type === "FIXED" ? e.target.value.replace(/\D/g, "").slice(0, 4) : e.target.value.replace(/[^\d.]/g, "").slice(0, 6) })}
            aria-describedby={`${uid}-vh`}
            className={field}
          />
          <span id={`${uid}-vh`} className="type-caption text-ink-muted">{v.type === "FIXED" ? t("fixedHint") : t("percentHint")}</span>
        </label>
        {v.type === "PERCENT" && (
          <label htmlFor={`${uid}-b`} className="flex flex-col gap-1">
            <span className="type-body-medium text-ink">{t("percentOf")}</span>
            <select id={`${uid}-b`} value={v.percentOf} onChange={(e) => setV({ ...v, percentOf: e.target.value === "CUSTOMER_FEE" ? "CUSTOMER_FEE" : "COURIER_COST" })} className={field}>
              <option value="COURIER_COST">{t("base.COURIER_COST")}</option>
              <option value="CUSTOMER_FEE">{t("base.CUSTOMER_FEE")}</option>
            </select>
          </label>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={`${uid}-z`} className="flex flex-col gap-1">
          <span className="type-body-medium text-ink">{t("zone")}</span>
          <select id={`${uid}-z`} value={v.zoneId} disabled={zones.isPending} onChange={(e) => setV({ ...v, zoneId: e.target.value })} className={field}>
            <option value="">{t("allZones")}</option>
            {(zones.data ?? []).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </label>
        <label htmlFor={`${uid}-c`} className="flex flex-col gap-1">
          <span className="type-body-medium text-ink">{t("courier")}</span>
          <select id={`${uid}-c`} value={v.providerId} disabled={couriers.isPending} onChange={(e) => setV({ ...v, providerId: e.target.value })} className={field}>
            <option value="">{t("allCouriers")}</option>
            {(couriers.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>
      {(zones.isError || couriers.isError) && <p role="alert" className="type-caption text-error">{t("listsError")}</p>}

      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input type="checkbox" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} className="size-5 accent-brand" />
        <span className="type-body text-ink">{t("activeLabel")}</span>
      </label>

      {valueOk && <p className="type-caption text-ink-secondary" aria-live="polite">{t("preview", { value: valueText({ type: v.type, value: num, percentOf: v.type === "PERCENT" ? v.percentOf : null }) })}</p>}

      {problem && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {problem}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={save.isPending} aria-busy={save.isPending} className={solid}>
          {save.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {save.isPending ? t("saving") : t("save")}
        </button>
        <button type="button" onClick={onDone} disabled={save.isPending} className="type-body-medium h-11 rounded-sm px-4 text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">{t("cancel")}</button>
      </div>
    </form>
  );
}
