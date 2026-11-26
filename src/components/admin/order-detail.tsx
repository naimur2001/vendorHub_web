"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlarmClock, BellRing, EyeOff, LoaderCircle, MessageCircle, Phone, StickyNote, XCircle } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { FormModal } from "@/components/ui/form-modal";
import { Link } from "@/i18n/routing";
import { addAdminNote, adminCancelOrder, adminOrderKeys, getAdminChat, getAdminOrder, remindShop, type AdminOrderDetail } from "@/lib/api/admin-orders";
import { ApiError } from "@/lib/api/core";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const outline =
  "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60";
const danger =
  "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm bg-error px-4 text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60";
const area = "type-body w-full rounded-sm border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";
const OPEN: AdminOrderDetail["status"][] = ["PLACED", "CONFIRMED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"];

function errorText(err: unknown, t: (k: string) => string): string {
  const code = err instanceof ApiError ? (err.details as { code?: string } | undefined)?.code : undefined;
  if (code === "ORDER_NOT_LATE") return t("errors.notLate");
  if (code === "ORDER_CLOSED") return t("errors.closed");
  if (err instanceof ApiError && err.status === 429) return t("errors.remindedRecently");
  if (err instanceof ApiError && err.status === 409) return t("errors.changed");
  if (err instanceof ApiError && err.status === 0) return t("errors.network");
  return t("errors.generic");
}

function Block({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4">
      <h3 className="type-body-medium flex items-center gap-2 text-ink">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Side panel with everything about one order, and the admin's actions. */
export function AdminOrderDetailSheet({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const t = useTranslations("AdminOrders");
  return (
    <FormModal
      open={orderId !== null}
      onClose={() => onClose()}
      title={t("detailTitle")}
      description={t("detailText")}
      srOnlyDescription
      size="sm:max-w-xl"
    >
        <div>{orderId && <Detail key={orderId} orderId={orderId} />}</div>
      </FormModal>
  );
}

function Detail({ orderId }: { orderId: string }) {
  const t = useTranslations("AdminOrders");
  const tOrder = useTranslations("Order");
  const locale = useLocale();
  const format = useFormatter();
  const id = useId();
  const queryClient = useQueryClient();
  const [showChat, setShowChat] = useState(false);
  const [note, setNote] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const order = useQuery({ queryKey: adminOrderKeys.detail(orderId), queryFn: () => getAdminOrder(orderId) });
  const chat = useQuery({ queryKey: adminOrderKeys.chat(orderId), queryFn: () => getAdminChat(orderId), enabled: showChat });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: adminOrderKeys.detail(orderId) });
    void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
  };

  const remind = useMutation({
    mutationFn: () => remindShop(orderId),
    onSuccess: (r) => {
      setNotice({ ok: true, text: t("reminded", { count: r.recipients }) });
      refresh();
    },
    onError: (e) => setNotice({ ok: false, text: errorText(e, t) }),
  });
  const addNote = useMutation({
    mutationFn: () => addAdminNote(orderId, note.trim()),
    onSuccess: () => {
      setNote("");
      refresh();
    },
    onError: (e) => setNotice({ ok: false, text: errorText(e, t) }),
  });
  const cancel = useMutation({
    mutationFn: () => adminCancelOrder(orderId, reason.trim()),
    onSuccess: (r) => {
      setCancelOpen(false);
      setNotice({ ok: true, text: r.refundNeeded ? t("cancelledRefund") : t("cancelled") });
      refresh();
    },
    onError: (e) => setNotice({ ok: false, text: errorText(e, t) }),
  });

  if (order.isPending) return <div className="h-96 skeleton rounded-md" aria-hidden />;
  if (order.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => order.refetch()} className={outline}>{t("retry")}</button>
      </div>
    );
  }

  const o = order.data;
  const money = (n: number) => formatTaka(n, locale);
  const when = (iso: string) => format.dateTime(new Date(iso), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const isOpen = OPEN.includes(o.status);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-h3 text-ink">#{o.orderNumber}</span>
        <span className="type-caption rounded-full bg-subtle px-2 py-0.5 text-ink-secondary">{tOrder(`status.${o.status}`)}</span>
        {o.lateReason && (
          <span className="type-caption inline-flex items-center gap-1 rounded-full bg-error-soft px-2 py-0.5 text-error">
            <AlarmClock className="size-3.5" aria-hidden />
            {t(`late.${o.lateReason}`)}
          </span>
        )}
      </div>
      <p className="type-caption text-ink-muted">
        {t("placed", { when: when(o.createdAt) })}
        {o.shopRemindedAt && ` · ${t("lastReminder", { when: when(o.shopRemindedAt) })}`}
      </p>

      {notice && (
        <p role={notice.ok ? "status" : "alert"} className={cn("type-body rounded-md p-3", notice.ok ? "bg-success-soft text-success-ink" : "bg-error-soft text-error")}>
          {notice.text}
        </p>
      )}

      {isOpen && (
        <div className="flex flex-wrap gap-2">
          {o.lateReason && (
            <button type="button" onClick={() => remind.mutate()} disabled={remind.isPending} className={outline}>
              {remind.isPending ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden /> : <BellRing className="size-4" aria-hidden />}
              {t("remind")}
            </button>
          )}
          {!cancelOpen && (
            <button type="button" onClick={() => setCancelOpen(true)} className={cn(outline, "border-error text-error hover:bg-error-soft")}>
              <XCircle className="size-4" aria-hidden />
              {t("cancel")}
            </button>
          )}
        </div>
      )}
      {cancelOpen && (
        <div className="flex flex-col gap-2 rounded-md border border-error/40 bg-error-soft/40 p-3">
          <label htmlFor={`${id}-reason`} className="type-body-medium text-ink">{t("cancelReason")}</label>
          <textarea id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2} className={area} />
          <p className="type-caption text-ink-muted">{t("cancelHint")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => cancel.mutate()} disabled={reason.trim().length < 3 || cancel.isPending} className={danger}>
              {cancel.isPending && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
              {t("confirmCancel")}
            </button>
            <button type="button" onClick={() => setCancelOpen(false)} className={outline}>{t("keepOrder")}</button>
          </div>
        </div>
      )}

      <Block title={t("people")} icon={<Phone className="size-4 text-highlight" aria-hidden />}>
        <dl className="type-body grid gap-2 sm:grid-cols-2">
          <div className="rounded-md bg-subtle p-3">
            <dt className="type-caption text-ink-muted">{t("customer")}</dt>
            <dd className="text-ink">{o.customer.name}</dd>
            <dd className="type-caption text-ink-secondary">{o.customer.phone ?? "—"}</dd>
            <dd className="type-caption break-all text-ink-secondary">{o.customer.email}</dd>
          </div>
          <div className="rounded-md bg-subtle p-3">
            <dt className="type-caption text-ink-muted">{t("shop")}</dt>
            <dd>
              <Link href={`/shops/${o.shop.slug}`} className="text-brand underline-offset-4 hover:underline">{o.shop.name}</Link>
            </dd>
            <dd className="type-caption text-ink-secondary">{o.shop.phone ?? "—"}</dd>
            <dd className="type-caption text-ink-secondary">{[o.shop.shopNumber, o.shop.market?.name].filter(Boolean).join(" · ")}</dd>
          </div>
        </dl>
        <p className="type-caption text-ink-secondary">
          {t(`deliveryMethod.${o.delivery.method}`)}
          {o.delivery.address && ` · ${o.delivery.address}`}
          {" · "}
          {t(`paymentStatus.${o.payment.status}`)}
        </p>
      </Block>

      <Block title={t("items")}>
        <ul className="flex flex-col gap-1">
          {o.items.map((i) => (
            <li key={i.id} className="type-body flex justify-between gap-3 text-ink-secondary">
              <span className="min-w-0">
                {i.quantity} × {i.title}
                {i.bargained && <span className="type-caption ml-1 text-highlight">🤝</span>}
                {i.flashDeal && <span className="type-caption ml-1 text-highlight">⚡</span>}
              </span>
              <span className="type-price shrink-0">{money(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="type-body flex flex-col gap-0.5 border-t border-line pt-2 text-ink-secondary">
          <div className="flex justify-between"><dt>{t("subtotal")}</dt><dd>{money(o.subtotal)}</dd></div>
          {o.discount > 0 && <div className="flex justify-between text-success-ink"><dt>{t("coupon", { code: o.couponCode ?? "" })}</dt><dd>−{money(o.discount)}</dd></div>}
          {o.creditUsed > 0 && <div className="flex justify-between text-success-ink"><dt>{t("credit")}</dt><dd>−{money(o.creditUsed)}</dd></div>}
          <div className="flex justify-between"><dt>{t("deliveryFee")}</dt><dd>{money(o.delivery.fee)}</dd></div>
          <div className="type-body-medium flex justify-between text-ink"><dt>{t("total")}</dt><dd>{money(o.total)}</dd></div>
        </dl>
      </Block>

      <Block title={t("timeline")}>
        <ol className="flex flex-col gap-2 border-l-2 border-gold pl-4">
          {o.statusEvents.map((e, i) => (
            <li key={i} className="flex flex-col">
              <span className="type-body-medium text-ink">{tOrder(`status.${e.status}`)}</span>
              <span className="type-caption text-ink-muted">
                {when(e.createdAt)} · {t(`actor.${e.actorRole ?? "SYSTEM"}`)}
                {e.actorName && ` (${e.actorName})`}
              </span>
              {e.note && <span className="type-caption text-ink-secondary">“{e.note}”</span>}
            </li>
          ))}
        </ol>
      </Block>

      {(o.payments.length > 0 || o.returns.length > 0) && (
        <Block title={t("paymentsReturns")}>
          <ul className="type-caption flex flex-col gap-1 text-ink-secondary">
            {o.payments.map((p) => (
              <li key={p.id}>{t("paymentLine", { provider: p.provider, amount: money(p.amount), status: p.status, when: when(p.createdAt) })}</li>
            ))}
            {o.returns.map((r) => (
              <li key={r.id}>{t("returnLine", { status: r.status, reason: r.reason, when: when(r.createdAt) })}</li>
            ))}
          </ul>
        </Block>
      )}

      <Block title={t("chat", { count: o.messageCount })} icon={<MessageCircle className="size-4 text-highlight" aria-hidden />}>
        {!showChat ? (
          <div className="flex flex-col items-start gap-1">
            <button type="button" onClick={() => setShowChat(true)} disabled={o.messageCount === 0} className={outline}>{t("readChat")}</button>
            <p className="type-caption text-ink-muted">{t("chatAudit")}</p>
          </div>
        ) : chat.isPending ? (
          <div className="h-24 skeleton rounded-md" aria-hidden />
        ) : chat.isError ? (
          <p role="alert" className="type-caption text-error">{t("loadError")}</p>
        ) : (
          <ol className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-md bg-subtle p-3">
            {chat.data.messages.map((m) => (
              <li key={m.id} className={cn("flex max-w-[85%] flex-col gap-0.5", m.senderRole === "SHOP" ? "self-end items-end" : "self-start items-start")}>
                <span className="type-caption text-ink-muted">{t(`actor.${m.senderRole}`)} · {when(m.createdAt)}</span>
                <p className={cn("type-body rounded-2xl px-3 py-2 break-words whitespace-pre-wrap", m.senderRole === "SHOP" ? "bg-card text-ink" : "bg-highlight-soft text-ink", m.hidden && "opacity-60")}>{m.body}</p>
                {m.hidden && <span className="type-caption inline-flex items-center gap-1 text-ink-muted"><EyeOff className="size-3" aria-hidden />{t("hiddenMessage")}</span>}
              </li>
            ))}
          </ol>
        )}
      </Block>

      <Block title={t("notes")} icon={<StickyNote className="size-4 text-highlight" aria-hidden />}>
        {o.adminNotes.length > 0 && (
          <ul className="flex flex-col gap-2">
            {o.adminNotes.map((n) => (
              <li key={n.id} className="rounded-md bg-subtle p-2">
                <p className="type-body whitespace-pre-wrap text-ink">{n.body}</p>
                <p className="type-caption text-ink-muted">{n.author?.name ?? t("admin")} · {when(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
        <label htmlFor={`${id}-note`} className="sr-only">{t("addNote")}</label>
        <textarea id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder={t("notePlaceholder")} className={area} />
        <button type="button" onClick={() => addNote.mutate()} disabled={!note.trim() || addNote.isPending} className={cn(outline, "self-start")}>
          {addNote.isPending && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
          {t("addNote")}
        </button>
      </Block>
    </div>
  );
}
