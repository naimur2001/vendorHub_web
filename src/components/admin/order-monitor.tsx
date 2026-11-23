"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlarmClock, ChevronLeft, ChevronRight, MessageCircle, RotateCcw, Search, Store, Truck } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { AdminOrderDetailSheet } from "@/components/admin/order-detail";
import { adminOrderKeys, LATE_KINDS, listAdminOrders, type AdminOrderQuery, type AdminOrderRow, type LateFilter } from "@/lib/api/admin-orders";
import { ORDER_STATUSES, type DeliveryMethod, type OrderStatus, type PaymentStatus } from "@/lib/api/checkout";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const DELIVERY: DeliveryMethod[] = ["STORE_PICKUP", "RESERVE_PICKUP", "VENDOR_DELIVERY"];
const PAY: PaymentStatus[] = ["PENDING", "PAID", "FAILED", "REFUNDED"];
const select =
  "type-body h-11 rounded-sm border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";
const outline =
  "type-body-medium inline-flex h-11 items-center justify-center gap-1 rounded-sm border border-brand px-3 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none";

/** Admin: every order on the site, with late ones flagged, filters and a detail panel. */
export function OrderMonitor() {
  const t = useTranslations("AdminOrders");
  const tOrder = useTranslations("Order");
  const id = useId();
  const [query, setQuery] = useState<AdminOrderQuery>({ page: 1 });
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const orders = useQuery({ queryKey: adminOrderKeys.list(query), queryFn: () => listAdminOrders(query), placeholderData: keepPreviousData, refetchInterval: 60_000 });
  const set = (patch: Partial<AdminOrderQuery>) => setQuery((q) => ({ ...q, ...patch, page: patch.page ?? 1 }));
  const counts = orders.data?.counts;
  const list = orders.data?.data ?? [];
  const totalPages = orders.data?.meta?.pagination?.totalPages ?? 1;

  function search(e: FormEvent) {
    e.preventDefault();
    const q = term.trim().slice(0, 100);
    set({ q: q.length >= 2 ? q : undefined });
  }

  const cards: { key: LateFilter; label: string }[] = [
    { key: "any", label: t("late.any") },
    ...LATE_KINDS.map((k) => ({ key: k as LateFilter, label: t(`late.${k}`) })),
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Late summary cards: tap one to filter (tap again to clear) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => {
          const n = counts?.byLate[c.key] ?? 0;
          const on = query.late === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => set({ late: on ? undefined : c.key })}
              className={cn(
                "flex min-h-20 flex-col items-start justify-between gap-1 rounded-md border p-3 text-left shadow-card focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
                on ? "border-brand bg-brand text-primary-foreground" : n > 0 ? "border-error/40 bg-error-soft text-ink" : "border-line bg-card text-ink",
              )}
            >
              <span className={cn("font-heading text-[1.75rem] leading-none", !on && n > 0 && "text-error")}>{n}</span>
              <span className="type-caption">{c.label}</span>
            </button>
          );
        })}
      </div>
      <p className="type-caption -mt-2 text-ink-muted">{t("lateRules")}</p>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <form onSubmit={search} role="search" className="flex flex-1 gap-2">
          <label htmlFor={`${id}-q`} className="sr-only">{t("searchLabel")}</label>
          <input id={`${id}-q`} type="search" value={term} onChange={(e) => setTerm(e.target.value)} maxLength={100} placeholder={t("searchPlaceholder")} className={cn(select, "w-full")} />
          <button type="submit" aria-label={t("search")} className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-action text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none">
            <Search className="size-4" aria-hidden />
          </button>
        </form>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="sr-only" htmlFor={`${id}-s`}>{t("status")}</label>
          <select id={`${id}-s`} value={query.status ?? ""} onChange={(e) => set({ status: (e.target.value || undefined) as OrderStatus | undefined })} className={select}>
            <option value="">{t("allStatuses")}</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{tOrder(`status.${s}`)} ({counts?.byStatus[s] ?? 0})</option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`${id}-d`}>{t("delivery")}</label>
          <select id={`${id}-d`} value={query.deliveryMethod ?? ""} onChange={(e) => set({ deliveryMethod: (e.target.value || undefined) as DeliveryMethod | undefined })} className={select}>
            <option value="">{t("allDelivery")}</option>
            {DELIVERY.map((d) => (
              <option key={d} value={d}>{t(`deliveryMethod.${d}`)}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`${id}-p`}>{t("payment")}</label>
          <select id={`${id}-p`} value={query.paymentStatus ?? ""} onChange={(e) => set({ paymentStatus: (e.target.value || undefined) as PaymentStatus | undefined })} className={select}>
            <option value="">{t("allPayments")}</option>
            {PAY.map((p) => (
              <option key={p} value={p}>{t(`paymentStatus.${p}`)}</option>
            ))}
          </select>
        </div>
      </div>

      {orders.isPending ? (
        <div className="h-64 skeleton rounded-md" aria-hidden />
      ) : orders.isError ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => orders.refetch()} className={outline}>{t("retry")}</button>
        </div>
      ) : list.length === 0 ? (
        <p className="type-body rounded-md border border-dashed border-line-strong p-6 text-center text-ink-secondary">{t("empty")}</p>
      ) : (
        <>
          <p className="type-body text-ink-secondary" aria-live="polite">{t("count", { count: orders.data.meta?.pagination?.total ?? list.length })}</p>
          <ul className={cn("flex flex-col gap-2", orders.isPlaceholderData && "opacity-60")}>
            {list.map((o) => (
              <li key={o.id}>
                <Row order={o} onOpen={() => setOpen(o.id)} />
              </li>
            ))}
          </ul>
        </>
      )}

      {totalPages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => set({ page: query.page - 1 })} disabled={query.page <= 1} className={cn(outline, "disabled:invisible")}>
            <ChevronLeft className="size-4" aria-hidden />
            {t("previous")}
          </button>
          <span className="type-body text-ink-secondary">{t("pageOf", { page: query.page, total: totalPages })}</span>
          <button type="button" onClick={() => set({ page: query.page + 1 })} disabled={query.page >= totalPages} className={cn(outline, "disabled:invisible")}>
            {t("next")}
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      )}

      <AdminOrderDetailSheet orderId={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Row({ order: o, onOpen }: { order: AdminOrderRow; onOpen: () => void }) {
  const t = useTranslations("AdminOrders");
  const tOrder = useTranslations("Order");
  const locale = useLocale();
  const format = useFormatter();
  const pickup = o.delivery.method !== "VENDOR_DELIVERY";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("openLabel", { number: o.orderNumber })}
      className={cn(
        "flex w-full flex-col gap-2 rounded-md border bg-card p-3 text-left shadow-card hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none md:flex-row md:items-center md:gap-4",
        o.lateReason ? "border-error/50" : "border-line",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="type-body-medium text-ink">#{o.orderNumber}</span>
          <span className="type-caption rounded-full bg-subtle px-2 py-0.5 text-ink-secondary">{tOrder(`status.${o.status}`)}</span>
          {o.lateReason && (
            <span className="type-caption inline-flex items-center gap-1 rounded-full bg-error-soft px-2 py-0.5 text-error">
              <AlarmClock className="size-3.5" aria-hidden />
              {t(`late.${o.lateReason}`)}
            </span>
          )}
          {o.openReturn && (
            <span className="type-caption inline-flex items-center gap-1 rounded-full bg-highlight-soft px-2 py-0.5 text-highlight">
              <RotateCcw className="size-3.5" aria-hidden />
              {t("openReturn")}
            </span>
          )}
        </span>
        <span className="type-caption truncate text-ink-secondary">
          {o.shop.name} → {o.customer.name}
        </span>
        <span className="type-caption flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-muted">
          <span className="inline-flex items-center gap-1">
            {pickup ? <Store className="size-3.5" aria-hidden /> : <Truck className="size-3.5" aria-hidden />}
            {t(`deliveryMethod.${o.delivery.method}`)}
          </span>
          <span>{t(`paymentStatus.${o.payment.status}`)}</span>
          {o.messageCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-3.5" aria-hidden />
              {o.messageCount}
            </span>
          )}
          <span>{format.dateTime(new Date(o.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
        </span>
      </span>
      <span className="type-price shrink-0 text-ink">{formatTaka(o.total, locale)}</span>
    </button>
  );
}
