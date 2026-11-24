"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock, Trash2, XCircle } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { ApiError } from "@/lib/api/core";
import {
  approveDeletionRequest,
  deletionKeys,
  listAdminDeletionRequests,
  rejectDeletionRequest,
  type AdminDeletionRequest,
  type DeletionStatus,
} from "@/lib/api/product-deletion";
import { refreshPublicPages } from "@/lib/refresh-public";
import { cn } from "@/lib/utils";

const STATUSES: DeletionStatus[] = ["PENDING", "DONE", "REJECTED", "CANCELLED"];
const chip = (on: boolean) =>
  cn("type-body-medium h-11 shrink-0 rounded-full border px-4 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none", on ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand");
const outline = "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60";
const danger = "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm bg-error px-4 text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60";

/** Admin: shop owners' product deletion requests. Pending ones are deleted automatically when their 12 hours run out. */
export function DeletionRequests() {
  const t = useTranslations("AdminDeletion");
  const [status, setStatus] = useState<DeletionStatus>("PENDING");
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: deletionKeys.admin(status, page), queryFn: () => listAdminDeletionRequests(status, page), placeholderData: keepPreviousData, refetchInterval: 60_000 });
  const list = q.data?.data ?? [];
  const totalPages = q.data?.meta?.pagination?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-5">
      <div role="group" aria-label={t("statusLabel")} className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {STATUSES.map((s) => (
          <button key={s} type="button" aria-pressed={status === s} onClick={() => { setStatus(s); setPage(1); }} className={chip(status === s)}>
            {t(`status.${s}`)}
          </button>
        ))}
      </div>

      {q.isPending ? (
        <div className="h-64 skeleton rounded-md" aria-hidden />
      ) : q.isError ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => q.refetch()} className={outline}>{t("retry")}</button>
        </div>
      ) : list.length === 0 ? (
        <p className="type-body rounded-md border border-dashed border-line-strong p-6 text-center text-ink-secondary">{t("empty")}</p>
      ) : (
        <ul className={cn("flex flex-col gap-3", q.isPlaceholderData && "opacity-60")}>
          {list.map((r) => <Row key={r.id} r={r} />)}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} className={cn(outline, "disabled:invisible")}><ChevronLeft className="size-4" aria-hidden />{t("previous")}</button>
          <span className="type-body text-ink-secondary">{t("pageOf", { page, total: totalPages })}</span>
          <button type="button" onClick={() => setPage(page + 1)} disabled={page >= totalPages} className={cn(outline, "disabled:invisible")}>{t("next")}<ChevronRight className="size-4" aria-hidden /></button>
        </nav>
      )}
    </div>
  );
}

function Row({ r }: { r: AdminDeletionRequest }) {
  const t = useTranslations("AdminDeletion");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const uid = useId();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    setMode(null);
    setError(null);
    void queryClient.invalidateQueries({ queryKey: ["admin", "deletion-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    refreshPublicPages(["products", "catalog"]);
  };
  const onError = (err: unknown) =>
    setError(err instanceof ApiError && err.status === 409 ? t("errors.state") : err instanceof ApiError && err.status === 0 ? t("errors.network") : t("errors.generic"));
  const approve = useMutation({ mutationFn: () => approveDeletionRequest(r.id), onSuccess: done, onError });
  const reject = useMutation({ mutationFn: () => rejectDeletionRequest(r.id, note.trim()), onSuccess: done, onError });
  const busy = approve.isPending || reject.isPending;
  const noteOk = note.trim().length >= 3 && note.trim().length <= 500;

  return (
    <li className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card">
      <div className="flex flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="type-body-medium text-ink">{r.product?.title ?? r.productTitle}</span>
          <span className="type-caption rounded-full bg-highlight-soft px-2 py-0.5 text-highlight">{t(`scope.${r.scope}`)}</span>
          {r.outcome && <span className="type-caption rounded-full bg-subtle px-2 py-0.5 text-ink-secondary">{t(`outcome.${r.outcome}`)}</span>}
        </span>
        <span className="type-caption text-ink-secondary">{t("byShop", { shop: r.shop.name })} · {format.dateTime(new Date(r.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
        {r.reason && <p className="type-body text-ink">{t("reason", { reason: r.reason })}</p>}
        {r.rejectNote && <p className="type-body text-ink-secondary">{t("rejectNote", { note: r.rejectNote })}</p>}
        {r.status === "PENDING" && (
          <span className="type-caption inline-flex items-center gap-1 text-highlight">
            <Clock className="size-3.5" aria-hidden />
            {new Date(r.autoDeleteAt) > now ? t("autoIn", { when: format.relativeTime(new Date(r.autoDeleteAt), now) }) : t("autoSoon")}
          </span>
        )}
      </div>

      {r.status === "PENDING" && mode === null && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setError(null); setMode("approve"); }} className={danger}><Trash2 className="size-4" aria-hidden />{t("approve")}</button>
          <button type="button" onClick={() => { setError(null); setMode("reject"); }} className={outline}><XCircle className="size-4" aria-hidden />{t("reject")}</button>
        </div>
      )}

      {mode === "approve" && (
        <div className="flex flex-col gap-2 rounded-sm bg-error-soft p-3">
          <p className="type-body text-ink">{t(r.scope === "LISTING" ? "approveConfirmListing" : "approveConfirm")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => approve.mutate()} disabled={busy} className={danger}>{approve.isPending ? t("working") : t("approveYes")}</button>
            <button type="button" onClick={() => setMode(null)} disabled={busy} className={outline}>{t("cancel")}</button>
          </div>
        </div>
      )}

      {mode === "reject" && (
        <form onSubmit={(e) => { e.preventDefault(); if (noteOk) reject.mutate(); }} className="flex flex-col gap-2">
          <label htmlFor={`${uid}-note`} className="type-body-medium text-ink">{t("noteLabel")}</label>
          <textarea id={`${uid}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} required className="type-body w-full rounded-sm border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none" />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || !noteOk} className={outline}>{reject.isPending ? t("working") : t("rejectSend")}</button>
            <button type="button" onClick={() => setMode(null)} disabled={busy} className="type-body-medium h-11 rounded-sm px-4 text-ink-secondary hover:bg-subtle">{t("cancel")}</button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="type-body text-error">{error}</p>}
    </li>
  );
}
