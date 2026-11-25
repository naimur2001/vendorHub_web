"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CircleAlert, LoaderCircle, Search } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { subCard, subField, subOutline, subSolid, useSubError } from "@/components/admin/subscriptions-overview";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  getSubscription,
  listSubscriptions,
  PAYMENT_METHODS,
  recordPayment,
  refundPayment,
  STATUSES,
  subKeys,
  updateSubscription,
  type PaymentMethod,
  type SubscriptionQuery,
  type SubscriptionStatus,
} from "@/lib/api/subscriptions";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<SubscriptionStatus, string> = {
  ACTIVE: "bg-success-soft text-success-ink",
  TRIAL: "bg-info-soft text-ink",
  PAST_DUE: "bg-warning-soft text-ink",
  CANCELLED: "bg-subtle text-ink-secondary",
  EXPIRED: "bg-error-soft text-error",
  FREE: "bg-subtle text-ink-secondary",
};
const chip = (on: boolean) =>
  cn("type-body-medium flex h-11 items-center rounded-full border px-4 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none", on ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand");

type Quick = "all" | "unpaid" | "expiring";

/** Shops with a plan: who pays, who owes, who runs out soon. Opens one for payments and changes. */
export function SubscriptionsList() {
  const t = useTranslations("AdminSubscriptions");
  const tS = useTranslations("AdminSubscriptions.status");
  const tP = useTranslations("AdminSubscriptions.period");
  const locale = useLocale();
  const format = useFormatter();
  const [text, setText] = useState("");
  const [quick, setQuick] = useState<Quick>("all");
  const [q, setQ] = useState<SubscriptionQuery>({ page: 1 });
  const [open, setOpen] = useState<string | null>(null);
  const query: SubscriptionQuery = { ...q, ...(quick === "unpaid" && { unpaid: "true" }), ...(quick === "expiring" && { expiringInDays: 7 }) };
  const list = useQuery({ queryKey: subKeys.list(query), queryFn: () => listSubscriptions(query), placeholderData: keepPreviousData });
  const rows = list.data?.data ?? [];
  const totalPages = list.data?.meta?.pagination?.totalPages ?? 1;
  const when = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { day: "numeric", month: "short", year: "numeric" }) : "—");

  return (
    <section aria-labelledby="sub-list" className="flex flex-col gap-3">
      <h2 id="sub-list" className="type-h2 text-ink">{t("listTitle")}</h2>
      <form onSubmit={(e) => { e.preventDefault(); setQ((x) => ({ ...x, page: 1, q: text.replace(/\p{Cc}/gu, "").trim().slice(0, 100) || undefined })); }} className="flex gap-2">
        <input type="search" aria-label={t("searchShops")} placeholder={t("searchShops")} maxLength={100} value={text} onChange={(e) => setText(e.target.value)} className={subField} />
        <button type="submit" className={subOutline}><Search className="size-4" aria-hidden />{t("find")}</button>
      </form>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-2 pb-1" aria-label={t("filterLabel")}>
          {(["all", "unpaid", "expiring"] as const).map((f) => (
            <li key={f}><button type="button" aria-pressed={quick === f} onClick={() => { setQuick(f); setQ((x) => ({ ...x, page: 1 })); }} className={chip(quick === f)}>{t(`quick.${f}`)}</button></li>
          ))}
          {STATUSES.map((s) => (
            <li key={s}><button type="button" aria-pressed={q.status === s} onClick={() => setQ((x) => ({ ...x, page: 1, status: x.status === s ? undefined : s }))} className={chip(q.status === s)}>{tS(s)}</button></li>
          ))}
        </ul>
      </div>

      {list.isPending ? (
        <div className="relative h-40 skeleton overflow-hidden rounded-md" aria-hidden />
      ) : list.isError ? (
        <div role="alert" className="flex items-center gap-3 rounded-md border border-line bg-card p-4">
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => list.refetch()} className={subOutline}>{t("retry")}</button>
        </div>
      ) : rows.length === 0 ? (
        <p className="type-body rounded-md border border-dashed border-line-strong p-6 text-center text-ink-secondary">{t("listEmpty")}</p>
      ) : (
        <ul className={cn("flex flex-col gap-2 transition-opacity", list.isPlaceholderData && "opacity-60")}>
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setOpen(r.id)} className="flex w-full flex-col gap-2 rounded-md border border-line bg-card p-4 text-left shadow-card hover:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none md:flex-row md:items-center md:justify-between">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="type-body-medium text-ink">{r.shop.name}</span>
                    <span className={cn("type-caption rounded-full px-2 py-0.5", STATUS_CLASS[r.status])}>{tS(r.status)}</span>
                    {r.cancelAtPeriodEnd && <span className="type-caption rounded-full bg-warning-soft px-2 py-0.5 text-ink">{t("endsAtPeriodEnd")}</span>}
                  </span>
                  <span className="type-caption text-ink-secondary">{[r.plan.nameEn, tP(r.period), r.shop.owner?.name].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="type-caption flex shrink-0 flex-wrap gap-x-4 text-ink-secondary tabular-nums md:flex-col md:items-end">
                  <span>{t("until", { date: when(r.currentPeriodEnd) })}</span>
                  {r.amountDue > 0 ? <span className="text-error">{t("due", { amount: formatTaka(r.amountDue, locale) })}</span> : <span className="text-success-ink">{r.paidThisPeriod ? t("paid") : t("nothingDue")}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setQ((x) => ({ ...x, page: x.page - 1 }))} disabled={q.page <= 1} className={cn(subOutline, "disabled:invisible")}><ChevronLeft className="size-4" aria-hidden />{t("previous")}</button>
          <span className="type-body text-ink-secondary">{t("pageOf", { page: q.page, total: totalPages })}</span>
          <button type="button" onClick={() => setQ((x) => ({ ...x, page: x.page + 1 }))} disabled={q.page >= totalPages} className={cn(subOutline, "disabled:invisible")}>{t("next")}<ChevronRight className="size-4" aria-hidden /></button>
        </nav>
      )}

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="type-h3 text-ink">{t("detailTitle")}</SheetTitle>
            <SheetDescription className="sr-only">{t("detailText")}</SheetDescription>
          </SheetHeader>
          <div className="px-4">{open && <Detail key={open} id={open} />}</div>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function Detail({ id }: { id: string }) {
  const t = useTranslations("AdminSubscriptions");
  const tS = useTranslations("AdminSubscriptions.status");
  const tP = useTranslations("AdminSubscriptions.period");
  const tM = useTranslations("AdminSubscriptions.method");
  const locale = useLocale();
  const format = useFormatter();
  const uid = useId();
  const queryClient = useQueryClient();
  const errorText = useSubError();
  const q = useQuery({ queryKey: subKeys.detail(id), queryFn: () => getSubscription(id) });
  const [pay, setPay] = useState<{ amount: string; method: PaymentMethod; reference: string } | null>(null);
  const [extend, setExtend] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
  };
  const when = (iso: string | null | undefined) => (iso ? format.dateTime(new Date(iso), { day: "numeric", month: "short", year: "numeric" }) : "—");
  const taka = (n: number) => formatTaka(n, locale);

  const record = useMutation({
    mutationFn: (input: { amount: number; method: PaymentMethod; reference?: string }) => recordPayment(id, input),
    onMutate: () => setNotice(null),
    onSuccess: () => { setPay(null); setNotice(t("paymentRecorded")); refresh(); },
  });
  const refund = useMutation({ mutationFn: (paymentId: string) => refundPayment(paymentId), onSuccess: () => { setNotice(t("refunded")); refresh(); } });
  const change = useMutation({
    mutationFn: (patch: Parameters<typeof updateSubscription>[1]) => updateSubscription(id, patch),
    onMutate: () => setNotice(null),
    onSuccess: () => { setExtend(""); setNotice(t("saved")); refresh(); },
  });
  const error = record.error ?? refund.error ?? change.error;

  if (q.isPending) return <div className="relative h-64 skeleton overflow-hidden rounded-md" aria-hidden />;
  if (q.isError) return <p role="alert" className="type-body text-ink-secondary">{t("loadError")}</p>;
  const s = q.data;
  const facts: [string, string][] = [
    [t("factShop"), s.shop.name],
    [t("factOwner"), [s.shop.owner?.name, s.shop.owner?.email].filter(Boolean).join(" · ") || "—"],
    [t("factPlan"), `${s.plan.nameEn} · ${tP(s.period)}`],
    [t("factStatus"), tS(s.status)],
    [t("factStarted"), when(s.startsAt)],
    [t("factUntil"), when(s.currentPeriodEnd)],
    [t("factTrial"), when(s.trialEndsAt)],
    [t("factPrice"), taka(s.priceAtStart)],
    [t("factDue"), s.amountDue > 0 ? taka(s.amountDue) : t("nothingDue")],
    [t("factSource"), t(`source.${s.source}`)],
    [t("factNote"), s.note ?? "—"],
  ];

  function onPay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pay || !/^\d{1,7}$/.test(pay.amount) || Number(pay.amount) <= 0) return;
    record.mutate({ amount: Number(pay.amount), method: pay.method, ...(pay.reference.trim() && { reference: pay.reference.trim().slice(0, 100) }) });
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="type-caption text-ink-muted">{k}</dt>
            {/* Admin and shop text: plain text */}
            <dd className="type-body text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      {notice && <p role="status" className="type-body text-success-ink">{notice}</p>}
      {error && <p role="alert" className="type-body flex items-start gap-2 text-error"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{errorText(error)}</p>}

      {s.isCurrent && (
        <section aria-labelledby={`${uid}-pay`} className={subCard}>
          <h3 id={`${uid}-pay`} className="type-h3 text-ink">{t("recordTitle")}</h3>
          {pay === null ? (
            <button type="button" onClick={() => setPay({ amount: String(s.amountDue || s.priceAtStart || ""), method: "MANUAL_BKASH", reference: "" })} className={cn(subSolid, "self-start")}>{t("recordPayment")}</button>
          ) : (
            <form onSubmit={onPay} className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label htmlFor={`${uid}-a`} className="flex flex-col gap-1">
                  <span className="type-body-medium text-ink">{t("amount")}</span>
                  <input id={`${uid}-a`} inputMode="numeric" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value.replace(/\D/g, "").slice(0, 7) })} className={subField} />
                </label>
                <label htmlFor={`${uid}-m`} className="flex flex-col gap-1">
                  <span className="type-body-medium text-ink">{t("methodLabel")}</span>
                  <select id={`${uid}-m`} value={pay.method} onChange={(e) => setPay({ ...pay, method: PAYMENT_METHODS.find((m) => m === e.target.value) ?? "CASH" })} className={subField}>
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{tM(m)}</option>)}
                  </select>
                </label>
              </div>
              <label htmlFor={`${uid}-r`} className="flex flex-col gap-1">
                <span className="type-body-medium text-ink">{t("reference")}</span>
                <input id={`${uid}-r`} maxLength={100} value={pay.reference} placeholder={t("referencePlaceholder")} onChange={(e) => setPay({ ...pay, reference: e.target.value })} className={subField} />
              </label>
              <p className="type-caption text-ink-muted">{t("recordHint", { period: tP(s.period) })}</p>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={record.isPending} aria-busy={record.isPending} className={subSolid}>
                  {record.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                  {t("savePayment")}
                </button>
                <button type="button" onClick={() => setPay(null)} className="type-body-medium h-11 rounded-sm px-4 text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">{t("cancel")}</button>
              </div>
            </form>
          )}
        </section>
      )}

      {s.isCurrent && (
        <section aria-labelledby={`${uid}-ch`} className={subCard}>
          <h3 id={`${uid}-ch`} className="type-h3 text-ink">{t("changeTitle")}</h3>
          <form onSubmit={(e) => { e.preventDefault(); if (/^\d{1,3}$/.test(extend) && Number(extend) > 0) change.mutate({ extendDays: Number(extend) }); }} className="flex flex-wrap items-end gap-2">
            <label htmlFor={`${uid}-x`} className="flex w-40 flex-col gap-1">
              <span className="type-caption text-ink-secondary">{t("extendDays")}</span>
              <input id={`${uid}-x`} inputMode="numeric" value={extend} onChange={(e) => setExtend(e.target.value.replace(/\D/g, "").slice(0, 3))} className={subField} />
            </label>
            <button type="submit" disabled={!extend || change.isPending} className={subOutline}>{t("extend")}</button>
          </form>
          <button type="button" onClick={() => change.mutate({ cancelAtPeriodEnd: !s.cancelAtPeriodEnd })} disabled={change.isPending} className={cn(subOutline, "self-start", !s.cancelAtPeriodEnd && "border-error text-error hover:bg-error-soft")}>
            {s.cancelAtPeriodEnd ? t("keepRenewing") : t("cancelAtEnd")}
          </button>
        </section>
      )}

      <section aria-labelledby={`${uid}-ph`} className="flex flex-col gap-2">
        <h3 id={`${uid}-ph`} className="type-h3 text-ink">{t("paymentsTitle")}</h3>
        {s.payments.length === 0 ? (
          <p className="type-body text-ink-secondary">{t("noPayments")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {s.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-line p-3">
                <span className="flex flex-col">
                  <span className={cn("type-body-medium tabular-nums", p.status === "REFUNDED" ? "text-ink-muted line-through" : "text-ink")}>{taka(p.amount)} · {tM(p.method)}</span>
                  <span className="type-caption text-ink-secondary">{t("paymentLine", { paid: when(p.paidAt), from: when(p.periodStart), to: when(p.periodEnd) })}{p.reference ? ` · ${p.reference}` : ""}</span>
                </span>
                {p.status === "RECORDED" ? (
                  <button type="button" onClick={() => refund.mutate(p.id)} disabled={refund.isPending} className="type-body-medium h-11 rounded-sm px-3 text-error hover:bg-error-soft focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none">{t("refund")}</button>
                ) : (
                  <span className="type-caption rounded-full bg-subtle px-2 py-0.5 text-ink-secondary">{t("refundedBadge")}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
