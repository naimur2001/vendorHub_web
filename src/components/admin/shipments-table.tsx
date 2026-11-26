"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock, Search } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { FormModal } from "@/components/ui/form-modal";
import { ApiError } from "@/lib/api/core";
import {
  cancelShipment,
  deliveryKeys,
  getShipment,
  listShipments,
  markCodRemitted,
  markShopPaid,
  rebookShipment,
  SHIPMENT_STATUSES,
  type RangeFilter,
  type ShipmentQuery,
  type ShipmentStatus,
} from "@/lib/api/delivery";
import { formatTaka, signedTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const PROBLEM: ShipmentStatus[] = ["FAILED", "RETURNING", "RETURNED", "CANCELLED"];
const outline = "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60";
const field = "type-body h-11 rounded-sm border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";

function statusTone(s: ShipmentStatus) {
  if (s === "DELIVERED") return "bg-success-soft text-success-ink";
  if (PROBLEM.includes(s)) return "bg-error-soft text-error";
  if (s === "PENDING") return "bg-warning-soft text-warning";
  return "bg-highlight-soft text-highlight";
}

/** Admin: every shipment, with stuck ones flagged, and the money actions in the detail panel. */
export function ShipmentsTable({ filter }: { filter: RangeFilter }) {
  const t = useTranslations("AdminDeliveryMonitor");
  const tS = useTranslations("ShipmentStatus");
  const locale = useLocale();
  const uid = useId();
  const [status, setStatus] = useState<ShipmentStatus | "">("");
  const [stuck, setStuck] = useState(false);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const query: ShipmentQuery = { ...filter, page, ...(status && { status }), ...(stuck && { stuck: "true" as const }), ...(q && { q }) };
  const list = useQuery({ queryKey: deliveryKeys.shipments(query), queryFn: () => listShipments(query), placeholderData: keepPreviousData, refetchInterval: 60_000 });
  const rows = list.data?.data ?? [];
  const totalPages = list.data?.meta?.pagination?.totalPages ?? 1;

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setQ(text.trim().slice(0, 60));
    setPage(1);
  }

  return (
    <section aria-labelledby={`${uid}-h`} className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card md:p-5">
      <h2 id={`${uid}-h`} className="type-h3 text-ink">{t("shipments")}</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={`${uid}-s`} className="flex flex-col gap-1">
          <span className="type-caption text-ink-secondary">{t("status")}</span>
          <select id={`${uid}-s`} value={status} onChange={(e) => { setStatus(e.target.value as ShipmentStatus | ""); setPage(1); }} className={field}>
            <option value="">{t("allStatuses")}</option>
            {SHIPMENT_STATUSES.map((s) => <option key={s} value={s}>{tS(s)}</option>)}
          </select>
        </label>
        <button type="button" aria-pressed={stuck} onClick={() => { setStuck(!stuck); setPage(1); }} className={cn(outline, stuck && "border-highlight bg-highlight-soft text-highlight")}>
          <Clock className="size-4" aria-hidden />
          {t("stuckOnly")}
        </button>
        <form onSubmit={onSearch} role="search" className="flex flex-1 items-end gap-2">
          <label htmlFor={`${uid}-q`} className="flex flex-1 flex-col gap-1">
            <span className="type-caption text-ink-secondary">{t("search")}</span>
            <input id={`${uid}-q`} value={text} onChange={(e) => setText(e.target.value)} maxLength={60} placeholder={t("searchPlaceholder")} className={cn(field, "w-full min-w-40")} />
          </label>
          <button type="submit" aria-label={t("search")} className="flex size-11 items-center justify-center rounded-sm bg-action text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none">
            <Search className="size-4" aria-hidden />
          </button>
        </form>
      </div>

      {list.isPending ? (
        <div className="relative h-48 skeleton overflow-hidden rounded-sm" aria-hidden />
      ) : list.isError ? (
        <p role="alert" className="type-body text-ink-secondary">{t("loadError")}</p>
      ) : rows.length === 0 ? (
        <p className="type-body rounded-sm border border-dashed border-line-strong p-6 text-center text-ink-secondary">{t("noShipments")}</p>
      ) : (
        <ul className={cn("flex flex-col divide-y divide-line", list.isPlaceholderData && "opacity-60")}>
          {rows.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => setOpen(s.id)} className="flex w-full flex-col gap-1 py-3 text-left hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none md:flex-row md:items-center md:gap-4 md:px-2">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="type-body-medium text-ink">{s.orderNumber ?? s.id.slice(0, 8)}</span>
                    <span className={cn("type-caption rounded-full px-2 py-0.5", statusTone(s.status))}>{tS(s.status)}</span>
                    {s.stuck && <span className="type-caption inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-warning"><Clock className="size-3" aria-hidden />{t("stuck")}</span>}
                  </span>
                  <span className="type-caption text-ink-secondary">{[s.shop?.name, s.provider?.name, t(`zone.${s.zoneCode}`), t("age", { h: Math.round(s.ageHours) })].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="type-caption flex shrink-0 gap-3 text-ink-secondary tabular-nums md:flex-col md:items-end md:gap-0">
                  <span>{t("fee", { amount: formatTaka(s.customerFee, locale) })}</span>
                  {s.margin !== null && <span className={s.margin < 0 ? "text-error" : "text-success-ink"}>{t("margin", { amount: formatTaka(s.margin, locale) })}</span>}
                  {s.profitGap !== null && <span className={s.profitGap < 0 ? "text-error" : "text-ink-secondary"}>{t("gapShort", { gap: signedTaka(s.profitGap, locale) })}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} className={cn(outline, "disabled:invisible")}><ChevronLeft className="size-4" aria-hidden />{t("previous")}</button>
          <span className="type-body text-ink-secondary">{t("pageOf", { page, total: totalPages })}</span>
          <button type="button" onClick={() => setPage(page + 1)} disabled={page >= totalPages} className={cn(outline, "disabled:invisible")}>{t("next")}<ChevronRight className="size-4" aria-hidden /></button>
        </nav>
      )}

      <FormModal
        open={open !== null}
        onClose={() => setOpen(null)}
        title={t("detailTitle")}
        description={t("detailText")}
        srOnlyDescription
        size="sm:max-w-xl"
      >
          <div>{open && <Detail key={open} id={open} />}</div>
        </FormModal>
    </section>
  );
}

function Detail({ id }: { id: string }) {
  const t = useTranslations("AdminDeliveryMonitor");
  const tS = useTranslations("ShipmentStatus");
  const locale = useLocale();
  const format = useFormatter();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<"cancel" | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const q = useQuery({ queryKey: deliveryKeys.shipment(id), queryFn: () => getShipment(id) });
  const when = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");
  const taka = (n: number) => formatTaka(n, locale);

  const act = useMutation({
    mutationFn: (kind: "cancel" | "rebook" | "cod" | "paid") =>
      kind === "cancel" ? cancelShipment(id) : kind === "rebook" ? rebookShipment(id) : kind === "cod" ? markCodRemitted(id) : markShopPaid(id),
    onSuccess: () => {
      setConfirm(null);
      setNotice({ ok: true, text: t("done") });
      void queryClient.invalidateQueries({ queryKey: ["admin", "shipment", id] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "shipments"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "delivery"] });
    },
    onError: (err) => setNotice({ ok: false, text: err instanceof ApiError && err.status === 409 ? t("errors.state") : err instanceof ApiError && err.status === 502 ? t("errors.courier") : t("errors.generic") }),
  });

  if (q.isPending) return <div className="relative h-64 skeleton overflow-hidden rounded-md" aria-hidden />;
  if (q.isError) return <p role="alert" className="type-body text-ink-secondary">{t("loadError")}</p>;
  const s = q.data;
  const canCancel = ["PENDING", "BOOKED", "PICKUP_ASSIGNED"].includes(s.status);
  const canRebook = ["PENDING", "FAILED", "CANCELLED"].includes(s.status);

  const facts: [string, string][] = [
    [t("factOrder"), s.orderNumber ?? "—"],
    [t("factShop"), s.shop?.name ?? "—"],
    [t("factCourier"), s.provider?.name ?? "—"],
    [t("factConsignment"), s.consignmentId ?? "—"],
    [t("factTracking"), s.trackingCode ?? "—"],
    [t("factZone"), t(`zone.${s.zoneCode}`)],
    [t("factFee"), taka(s.customerFee)],
    [t("factCost"), s.courierCost === null ? "—" : taka(s.courierCost)],
    [t("factMargin"), s.margin === null ? "—" : taka(s.margin)],
    [t("factTarget"), s.targetProfit === null ? t("noRule") : `${taka(s.targetProfit)}${s.ruleName ? ` · ${s.ruleName}` : ""}`],
    [t("factGap"), s.profitGap === null ? "—" : signedTaka(s.profitGap, locale)],
    [t("factCod"), s.codAmount ? `${taka(s.codAmount)} · ${s.codCollected ? t("collected") : t("notCollected")}` : t("prepaid")],
    [t("factCodRemitted"), when(s.codRemittedAt)],
    [t("factShopPaid"), when(s.shopPaidAt)],
    [t("factBooked"), when(s.bookedAt)],
    [t("factPicked"), when(s.pickedUpAt)],
    [t("factDelivered"), when(s.deliveredAt)],
  ];

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("type-body-medium rounded-full px-3 py-1", statusTone(s.status))}>{tS(s.status)}</span>
        {s.stuck && <span className="type-caption rounded-full bg-warning-soft px-2 py-0.5 text-warning">{t("stuck")}</span>}
      </div>
      {s.failReason && <p className="type-body rounded-sm bg-error-soft p-3 text-ink">{t("failReason", { reason: s.failReason })}</p>}
      {s.lastError && <p className="type-caption text-error">{t("lastError", { attempts: s.bookingAttempts, error: s.lastError })}</p>}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="type-caption text-ink-muted">{k}</dt>
            <dd className="type-body text-ink tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        {canRebook && <button type="button" onClick={() => act.mutate("rebook")} disabled={act.isPending} className={outline}>{t("rebook")}</button>}
        {s.codAmount > 0 && s.codCollected && !s.codRemittedAt && <button type="button" onClick={() => act.mutate("cod")} disabled={act.isPending} className={outline}>{t("markCod")}</button>}
        {s.status === "DELIVERED" && !s.shopPaidAt && <button type="button" onClick={() => act.mutate("paid")} disabled={act.isPending} className={outline}>{t("markPaid")}</button>}
        {canCancel && confirm !== "cancel" && <button type="button" onClick={() => setConfirm("cancel")} className={cn(outline, "border-error text-error hover:bg-error-soft")}>{t("cancel")}</button>}
      </div>
      {confirm === "cancel" && (
        <div className="flex flex-col gap-2 rounded-sm bg-error-soft p-3">
          <p className="type-body text-ink">{t("cancelConfirm")}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => act.mutate("cancel")} disabled={act.isPending} className="type-body-medium h-11 rounded-sm bg-error px-4 text-primary-foreground hover:opacity-90 disabled:opacity-60">{t("cancelYes")}</button>
            <button type="button" onClick={() => setConfirm(null)} className="type-body-medium h-11 rounded-sm px-4 text-ink-secondary hover:bg-card">{t("keep")}</button>
          </div>
        </div>
      )}
      {notice && <p role={notice.ok ? "status" : "alert"} className={cn("type-body", notice.ok ? "text-success-ink" : "text-error")}>{notice.text}</p>}

      <section className="flex flex-col gap-2">
        <h3 className="type-body-medium text-ink">{t("events")}</h3>
        {s.events.length === 0 ? (
          <p className="type-caption text-ink-muted">{t("noEvents")}</p>
        ) : (
          <ol className="flex flex-col gap-2 border-l-2 border-gold pl-4">
            {s.events.map((e) => (
              <li key={e.id} className="flex flex-col">
                <span className="type-body text-ink">{e.status ? tS(e.status) : e.rawStatus}</span>
                <span className="type-caption text-ink-muted">{when(e.at)} · {t(`source.${e.source}`)}{e.status && e.rawStatus ? ` · ${e.rawStatus}` : ""}</span>
                {e.note && <span className="type-caption text-ink-secondary">{e.note}</span>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
