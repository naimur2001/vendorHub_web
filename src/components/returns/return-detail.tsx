"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { Link } from "@/i18n/routing";
import { ApiError } from "@/lib/api/core";
import { formatTaka } from "@/lib/format";
import {
  addReturnMessage,
  escalateReturn,
  getReturn,
  requestReturn,
  resolveReturn,
  respondReturn,
  returnKeys,
  RETURN_REASONS,
  type ReturnReason,
  type ReturnRequest,
  type ReturnStatus,
} from "@/lib/api/returns";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<ReturnStatus, string> = {
  REQUESTED: "bg-highlight-soft text-highlight",
  REJECTED: "bg-error-soft text-error",
  ESCALATED: "bg-info-soft text-verified",
  REFUNDED: "bg-success-soft text-success-ink",
  CLOSED: "bg-subtle text-ink-secondary",
};
const area = "type-body w-full rounded-md border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";
const primary = "type-body-medium flex h-11 items-center justify-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover disabled:opacity-60";

export function ReturnStatusPill({ status }: { status: ReturnStatus }) {
  const t = useTranslations("Returns");
  return <span className={cn("type-caption rounded-full px-2.5 py-0.5", STATUS_STYLE[status])}>{t(`status.${status}`)}</span>;
}

function Note({ kind, text }: { kind: "ok" | "error"; text: string }) {
  return (
    <p role={kind === "error" ? "alert" : "status"} className={cn("type-body flex items-start gap-2", kind === "error" ? "text-error" : "text-success-ink")}>
      {kind === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
      {text}
    </p>
  );
}

/** Approve/reject (shop: note required when rejecting; admin: note always required). */
function DecisionForm({ mode, onSubmit, busy }: { mode: "respond" | "resolve"; onSubmit: (d: { decision: "APPROVE" | "REJECT"; note: string; restock: boolean }) => void; busy: boolean }) {
  const t = useTranslations("Returns");
  const id = useId();
  const [decision, setDecision] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [note, setNote] = useState("");
  const [restock, setRestock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const n = note.trim();
    const needNote = mode === "resolve" || decision === "REJECT";
    if ((needNote || n) && (n.length < 5 || n.length > 500)) return setError(t("errors.note"));
    setError(null);
    onSubmit({ decision, note: n, restock: decision === "APPROVE" && restock });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-md border border-line bg-surface p-3">
      <div className="grid grid-cols-2 gap-2">
        {(["APPROVE", "REJECT"] as const).map((d) => (
          <button key={d} type="button" aria-pressed={decision === d} onClick={() => setDecision(d)} className={cn("type-body-medium h-11 rounded-md border px-2", decision === d ? (d === "APPROVE" ? "border-success-ink bg-success-soft text-success-ink" : "border-error bg-error-soft text-error") : "border-line-strong text-ink-secondary")}>
            {mode === "resolve" ? (d === "APPROVE" ? t("resolveApprove") : t("resolveReject")) : d === "APPROVE" ? t("approve") : t("reject")}
          </button>
        ))}
      </div>
      {decision === "APPROVE" && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="size-5 accent-brand" />
          <span className="type-body text-ink">{t("restock")}</span>
        </label>
      )}
      <label htmlFor={id} className="type-caption text-ink-secondary">{mode === "resolve" ? t("noteAdmin") : t("note")}</label>
      <textarea id={id} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={area} />
      {error && <Note kind="error" text={error} />}
      <button type="submit" disabled={busy} className={primary}>
        {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
        {t("confirm")}
      </button>
    </form>
  );
}

/** One return: details, thread and the actions this viewer may take (from the API's `actions`). */
export function ReturnDetail({ id }: { id: string }) {
  const t = useTranslations("Returns");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const msgId = useId();
  const [text, setText] = useState("");
  const [escalating, setEscalating] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const q = useQuery({ queryKey: returnKeys.one(id), queryFn: () => getReturn(id) });

  function done(r: ReturnRequest) {
    queryClient.setQueryData(returnKeys.one(id), r);
    void queryClient.invalidateQueries({ queryKey: ["returns"] });
    setText("");
    setReason("");
    setEscalating(false);
    setNote(null);
  }
  function failed(err: unknown) {
    if (err instanceof ApiError && err.status === 409) {
      void q.refetch();
      return setNote({ kind: "error", text: t("errors.changed") });
    }
    setNote({ kind: "error", text: t("errors.generic") });
  }

  const message = useMutation({ mutationFn: (b: string) => addReturnMessage(id, b), onSuccess: done, onError: failed });
  const respond = useMutation({ mutationFn: (d: { decision: "APPROVE" | "REJECT"; note: string; restock: boolean }) => respondReturn(id, { ...d, note: d.note || undefined }), onSuccess: done, onError: failed });
  const resolve = useMutation({ mutationFn: (d: { decision: "APPROVE" | "REJECT"; note: string; restock: boolean }) => resolveReturn(id, d), onSuccess: done, onError: failed });
  const escalate = useMutation({ mutationFn: (r: string) => escalateReturn(id, r), onSuccess: done, onError: failed });

  if (q.isPending) return <p role="status" className="type-body flex items-center gap-2 py-8 text-ink-secondary"><LoaderCircle className="size-4 animate-spin" aria-hidden />{t("loading")}</p>;
  if (q.isError) return <button type="button" onClick={() => q.refetch()} className="type-body-medium py-8 text-brand">{t("retry")}</button>;

  const r = q.data;
  const date = (iso: string) => format.dateTime(new Date(iso), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <ReturnStatusPill status={r.status} />
          <span className="type-caption text-ink-muted">{t(`reason.${r.reason}`)}</span>
        </div>
        <p className="type-caption text-ink-secondary">{t("from", { customer: r.customer.name, shop: r.shop.name })} · {formatTaka(r.order.total)}</p>
      </div>
      <section className="flex flex-col gap-1">
        <h3 className="type-caption text-ink-muted">{t("description")}</h3>
        <p className="type-body whitespace-pre-line text-ink">{r.description}</p>
      </section>
      {r.resolutionNote && (
        <section className="flex flex-col gap-1">
          <h3 className="type-caption text-ink-muted">{t("decision")}</h3>
          <p className="type-body whitespace-pre-line text-ink">{r.resolutionNote}</p>
        </section>
      )}

      <section className="flex flex-col gap-2 border-t border-line pt-3">
        <h3 className="type-body-medium text-ink">{t("thread")}</h3>
        {r.messages.length === 0 ? (
          <p className="type-caption text-ink-muted">{t("noMessages")}</p>
        ) : (
          <ol className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {r.messages.map((m) => (
              <li key={m.id} className="flex flex-col gap-0.5 rounded-md border border-line bg-card px-3 py-2">
                <span className="type-caption text-ink-muted">{t(`role.${m.authorRole}`)} · {m.author} · {date(m.createdAt)}</span>
                {/* Plain text */}
                <span className="type-body whitespace-pre-line text-ink">{m.body}</span>
              </li>
            ))}
          </ol>
        )}
        {r.actions.message && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const b = text.trim();
              if (b.length < 2 || b.length > 2000) return setNote({ kind: "error", text: t("errors.message") });
              message.mutate(b);
            }}
            className="flex flex-col gap-2"
          >
            <label htmlFor={msgId} className="sr-only">{t("message")}</label>
            <textarea id={msgId} rows={2} maxLength={2000} placeholder={t("message")} value={text} onChange={(e) => setText(e.target.value)} className={area} />
            <button type="submit" disabled={message.isPending} className={cn(primary, "self-start")}>{t("send")}</button>
          </form>
        )}
      </section>

      {note && <Note kind={note.kind} text={note.text} />}
      {r.actions.respond && <DecisionForm mode="respond" busy={respond.isPending} onSubmit={(d) => respond.mutate(d)} />}
      {r.actions.resolve && <DecisionForm mode="resolve" busy={resolve.isPending} onSubmit={(d) => resolve.mutate(d)} />}
      {r.actions.escalate &&
        (escalating ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = reason.trim();
              if (v.length < 10 || v.length > 1000) return setNote({ kind: "error", text: t("errors.reason") });
              escalate.mutate(v);
            }}
            className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3"
          >
            <p className="type-caption text-ink-secondary">{t("escalateText")}</p>
            <textarea aria-label={t("escalateReason")} rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} className={area} />
            <div className="flex gap-2">
              <button type="submit" disabled={escalate.isPending} className={primary}>{t("escalate")}</button>
              <button type="button" onClick={() => setEscalating(false)} className="type-body-medium h-11 px-3 text-ink-secondary">{t("cancel")}</button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setEscalating(true)} className="type-body-medium h-11 self-start rounded-sm border border-brand px-4 text-brand hover:bg-subtle">{t("escalate")}</button>
        ))}
    </div>
  );
}

/** On a completed order: ask for a return (reason + description). */
export function RequestReturn({ orderId }: { orderId: string }) {
  const t = useTranslations("Returns");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReturnReason>("DEFECTIVE");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const send = useMutation({
    mutationFn: () => requestReturn(orderId, { reason, description: description.trim() }),
    onSuccess: () => setNote({ kind: "ok", text: t("requested") }),
    onError: (err) => {
      const m = err instanceof ApiError ? err.message : "";
      if (err instanceof ApiError && err.status === 409) {
        if (/already/i.test(m)) return setNote({ kind: "error", text: t("already") });
        if (/does not accept/i.test(m)) return setNote({ kind: "error", text: t("noReturns") });
        if (/window/i.test(m)) return setNote({ kind: "error", text: t("windowPassed") });
      }
      setNote({ kind: "error", text: t("errors.generic") });
    },
  });

  if (send.isSuccess) {
    return (
      <div className="flex flex-col gap-1">
        <Note kind="ok" text={t("requested")} />
        <Link href="/account/returns" className="type-body-medium text-brand underline-offset-4 hover:underline">{t("viewReturns")}</Link>
      </div>
    );
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="type-body-medium h-10 self-start rounded-sm px-2 text-ink-secondary underline-offset-4 hover:text-brand hover:underline">{t("request")}</button>;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const d = description.trim();
        if (d.length < 10 || d.length > 1000) return setNote({ kind: "error", text: t("errors.description") });
        setNote(null);
        send.mutate();
      }}
      className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3"
    >
      <p className="type-body-medium text-ink">{t("requestTitle")}</p>
      <label className="flex flex-col gap-1">
        <span className="type-caption text-ink-secondary">{t("requestReason")}</span>
        <select value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)} className="type-body h-11 rounded-md border border-input bg-card px-3 text-ink">
          {RETURN_REASONS.map((r) => <option key={r} value={r}>{t(`reason.${r}`)}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="type-caption text-ink-secondary">{t("requestDescription")}</span>
        <textarea rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} className={area} />
      </label>
      {note && <Note kind={note.kind} text={note.text} />}
      <div className="flex gap-2">
        <button type="submit" disabled={send.isPending} className={primary}>{send.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}{t("requestSend")}</button>
        <button type="button" onClick={() => setOpen(false)} className="type-body-medium h-11 px-3 text-ink-secondary">{t("cancel")}</button>
      </div>
    </form>
  );
}