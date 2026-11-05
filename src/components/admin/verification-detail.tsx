"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, CircleCheck, ExternalLink, LoaderCircle, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { PrivateDocument } from "@/components/admin/private-document";
import { Link } from "@/i18n/routing";
import {
  adminKeys,
  approveVerification,
  getVerification,
  markDocumentReviewed,
  rejectVerification,
  requestCorrection,
  revokeShop,
  saveNotes,
  type AdminVerificationDetail,
  type AdminVerificationRow,
  type ScoreBand,
  type StepState,
  type VerificationStatus,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/core";
import { cn } from "@/lib/utils";

// ---------- Shared pills (also used by the queue) ----------

const STATUS_STYLE: Record<VerificationStatus, string> = {
  PENDING: "bg-info-soft text-verified",
  AUTO_FLAGGED: "bg-error-soft text-error",
  CORRECTION_REQUESTED: "bg-highlight-soft text-highlight",
  APPROVED: "bg-success-soft text-success-ink",
  REJECTED: "bg-subtle text-ink-secondary",
  REVOKED: "bg-subtle text-ink-secondary",
};

const BAND_STYLE: Record<ScoreBand, string> = {
  GREEN: "bg-success-soft text-success-ink",
  AMBER: "bg-highlight-soft text-highlight",
  RED: "bg-error-soft text-error",
};

export function StatusPill({ status }: { status: VerificationStatus }) {
  const t = useTranslations("Admin");
  return <span className={cn("type-caption rounded-full px-2.5 py-0.5 whitespace-nowrap", STATUS_STYLE[status])}>{t(`status.${status}`)}</span>;
}

export function ScoreBadge({ row }: { row: AdminVerificationRow }) {
  const t = useTranslations("Admin");
  if (row.precheckScore === null || !row.scoreBand) return <span className="type-caption text-ink-muted">{t("noScore")}</span>;
  return (
    <span className={cn("type-body-medium rounded-sm px-2 py-0.5 tabular-nums", BAND_STYLE[row.scoreBand])}>
      {t("score", { score: row.precheckScore })}
    </span>
  );
}

// ---------- Pieces of the panel ----------

const OPEN: VerificationStatus[] = ["PENDING", "AUTO_FLAGGED"];
const HISTORY_KEYS = ["submitted", "resubmitted", "approved", "correction_requested", "rejected"] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4">
      <h3 className="type-body-medium text-ink">{title}</h3>
      {children}
    </section>
  );
}

/** Spec 4.3: five levels; done = green check, requested = gold ring, rejected = red cross. */
function Stepper({ steps }: { steps: AdminVerificationDetail["stepper"] }) {
  const t = useTranslations("AdminReview");
  const tAdmin = useTranslations("Admin");
  const node: Record<StepState, string> = {
    completed: "border-success-ink bg-success-ink text-primary-foreground",
    current: "border-highlight bg-card",
    upcoming: "border-line bg-card",
    rejected: "border-error bg-error-soft text-error",
  };
  const label: Record<StepState, string> = {
    completed: "text-ink",
    current: "font-semibold text-highlight",
    upcoming: "text-ink-disabled",
    rejected: "text-error",
  };
  return (
    <ol aria-label={t("stepperLabel")} className="grid grid-cols-5 gap-1">
      {steps.map((s) => (
        <li key={s.level} aria-label={`${tAdmin(`levels.${s.level}`)}: ${t(`stepState.${s.state}`)}`} className="flex flex-col items-center gap-1 text-center">
          <span aria-hidden className={cn("flex size-7 items-center justify-center rounded-full border-2", node[s.state])}>
            {s.state === "completed" && <Check className="size-4" />}
            {s.state === "rejected" && <X className="size-4" />}
            {s.state === "current" && <span className="size-2.5 rounded-full bg-highlight" />}
          </span>
          <span aria-hidden className={cn("type-caption leading-tight", label[s.state])}>
            {tAdmin(`levels.${s.level}`)}
          </span>
        </li>
      ))}
    </ol>
  );
}

const textareaClass =
  "type-body w-full rounded-md border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";

type Mode = null | "correction" | "reject" | "revoke";

/** The admin's review panel for one verification request (spec: RowDetailDrawer). */
export function VerificationDetail({ id }: { id: string }) {
  const t = useTranslations("AdminReview");
  const tAdmin = useTranslations("Admin");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const notesId = useId();
  const textId = useId();

  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const [flagged, setFlagged] = useState<string[]>([]);
  const [notes, setNotes] = useState<string | null>(null); // null = not edited yet: show the saved notes
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const detail = useQuery({ queryKey: adminKeys.verification(id), queryFn: () => getVerification(id) });

  function stored(d: AdminVerificationDetail) {
    queryClient.setQueryData(adminKeys.verification(id), d);
    void queryClient.invalidateQueries({ queryKey: ["admin", "verifications"] });
  }

  function decided(d: AdminVerificationDetail, done: "approved" | "correction" | "rejected") {
    stored(d);
    setMode(null);
    setText("");
    setFlagged([]);
    setMessage({ kind: "ok", text: t(`done.${done}`) });
  }

  function failed(err: unknown) {
    if (err instanceof ApiError && err.status === 409) {
      void detail.refetch(); // another admin acted first, or the request changed: show the real state
      setMessage({ kind: "error", text: t("errors.conflict") });
      return;
    }
    let key = "errors.generic";
    if (err instanceof ApiError && err.status === 400) key = "errors.invalid";
    if (err instanceof ApiError && err.status === 0) key = "errors.network";
    setMessage({ kind: "error", text: t(key) });
  }

  const review = useMutation({
    mutationFn: ({ docId, reviewed }: { docId: string; reviewed: boolean }) => markDocumentReviewed(id, docId, reviewed),
    onMutate: () => setMessage(null),
    onSuccess: stored,
    onError: failed,
  });
  const notesSave = useMutation({
    mutationFn: (value: string) => saveNotes(id, value),
    onSuccess: (r) => {
      queryClient.setQueryData<AdminVerificationDetail>(adminKeys.verification(id), (old) => (old ? { ...old, internalNotes: r.internalNotes } : old));
      setNotes(null);
      setMessage({ kind: "ok", text: t("notesSaved") });
    },
    onError: failed,
  });
  const approve = useMutation({ mutationFn: () => approveVerification(id), onSuccess: (d) => decided(d, "approved"), onError: failed });
  const correct = useMutation({
    mutationFn: ({ note, documentIds }: { note: string; documentIds: string[] }) => requestCorrection(id, note, documentIds),
    onSuccess: (d) => decided(d, "correction"),
    onError: failed,
  });
  const reject = useMutation({ mutationFn: (reason: string) => rejectVerification(id, reason), onSuccess: (d) => decided(d, "rejected"), onError: failed });
  const revoke = useMutation({
    mutationFn: ({ shopId, reason }: { shopId: string; reason: string }) => revokeShop(shopId, reason),
    onSuccess: () => {
      void detail.refetch();
      void queryClient.invalidateQueries({ queryKey: ["admin", "verifications"] });
      setMode(null);
      setText("");
      setMessage({ kind: "ok", text: t("done.revoked") });
    },
    onError: failed,
  });

  const busy = review.isPending || notesSave.isPending || approve.isPending || correct.isPending || reject.isPending || revoke.isPending;

  if (detail.isPending) {
    return (
      <p role="status" className="type-body flex items-center gap-2 py-8 text-ink-secondary">
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
        {t("loading")}
      </p>
    );
  }
  if (detail.isError) {
    const notFound = detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <div role="alert" className="flex flex-col items-start gap-2 py-8">
        <p className="type-body text-ink-secondary">{notFound ? t("notFound") : t("loadError")}</p>
        {!notFound && (
          <button type="button" onClick={() => detail.refetch()} className="type-body-medium text-brand underline-offset-4 hover:underline">
            {t("retry")}
          </button>
        )}
      </div>
    );
  }

  const d = detail.data;
  const isOpen = OPEN.includes(d.status);
  const date = (iso: string) => format.dateTime(new Date(iso), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  const place = [d.shopDetails.levelFloor, d.shopDetails.shopNumber, d.shopDetails.market].filter(Boolean).join(" · ");
  const currentNotes = notes ?? d.internalNotes ?? "";
  const textOk = text.trim().length >= 5 && text.trim().length <= 1000;

  function confirm() {
    setMessage(null);
    if (!textOk) {
      setMessage({ kind: "error", text: t("errors.textLength") });
      return;
    }
    if (mode === "correction") {
      if (flagged.length === 0) {
        setMessage({ kind: "error", text: t("errors.pickDocs") });
        return;
      }
      correct.mutate({ note: text.trim(), documentIds: flagged });
    } else if (mode === "reject") {
      reject.mutate(text.trim());
    } else if (mode === "revoke") {
      revoke.mutate({ shopId: d.shop.id, reason: text.trim() });
    }
  }

  function historyLabel(action: string): string {
    const key = action.replace(/^verification\./, "");
    return (HISTORY_KEYS as readonly string[]).includes(key) ? t(`history.${key as (typeof HISTORY_KEYS)[number]}`) : t("history.other");
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Shop and owner */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="type-h3 text-ink">{d.shop.name}</h3>
          <StatusPill status={d.status} />
        </div>
        <p className="type-body text-ink-secondary">{d.shop.addressLine}</p>
        {place && <p className="type-caption text-ink-muted">{place}</p>}
        <p className="type-caption text-ink-muted">
          {t("owner")}: {d.owner.name} · {d.owner.email}
        </p>
        <p className="type-caption text-ink-muted">
          {t("submitted", { date: date(d.submittedAt) })}
          {d.reviewedAt && ` · ${t("decided", { date: date(d.reviewedAt) })}`}
          {d.shopDetails.lastAuditedAt && ` · ${t("audited", { date: date(d.shopDetails.lastAuditedAt) })}`}
        </p>
        <Link href={`/shops/${d.shop.slug}`} className="type-body-medium flex items-center gap-1 self-start text-brand underline-offset-4 hover:underline">
          {t("storefront")}
          <ExternalLink className="size-4" aria-hidden />
        </Link>
      </div>

      <Stepper steps={d.stepper} />

      <Section title={t("precheckTitle")}>
        <div className="flex items-center gap-2">
          <ScoreBadge row={d} />
        </div>
        {d.precheck.details && (
          <ul className="type-body flex flex-col gap-1">
            {Object.entries(d.precheck.details).map(([key, value]) => {
              const ok = value === true;
              const known = ["tradeLicenseOcr", "nidUploaded", "nidFaceMatch", "shopPhotoUploaded", "addressGeoMatch", "marketLinked"].includes(key);
              if (!known) return null;
              return (
                <li key={key} className="flex items-center gap-2 text-ink-secondary">
                  {typeof value === "string" ? (
                    <span className="size-4 rounded-full border-2 border-highlight" aria-hidden />
                  ) : ok ? (
                    <Check className="size-4 text-success-ink" aria-hidden />
                  ) : (
                    <X className="size-4 text-error" aria-hidden />
                  )}
                  {key === "nidFaceMatch" ? t("checks.nidFaceMatch", { value: String(value) }) : t(`checks.${key}`)}
                </li>
              );
            })}
          </ul>
        )}
        <p className="type-caption text-ink-muted">{t("precheckNote")}</p>
      </Section>

      <Section title={t("documentsTitle")}>
        <ul className="flex flex-col gap-3">
          {d.documents.map((doc) => {
            const name = tAdmin(`docs.${doc.type}`);
            return (
              <li key={doc.id} className={cn("flex flex-col gap-2 rounded-md border p-3", doc.needsReupload ? "border-highlight bg-highlight-soft/40" : "border-line")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="type-body-medium text-ink">{name}</span>
                  {doc.needsReupload ? (
                    <span className="type-caption rounded-full bg-highlight-soft px-2 py-0.5 text-highlight">{t("flag")}</span>
                  ) : doc.reviewed ? (
                    <span className="type-caption rounded-full bg-success-soft px-2 py-0.5 text-success-ink">✓</span>
                  ) : null}
                </div>

                <PrivateDocument fileUrl={doc.fileUrl} label={name} fileName={`${d.shop.slug}-${doc.type.toLowerCase()}`} />

                {isOpen && mode !== "correction" && (
                  <button
                    type="button"
                    onClick={() => review.mutate({ docId: doc.id, reviewed: !doc.reviewed })}
                    disabled={busy}
                    aria-pressed={doc.reviewed}
                    className={cn(
                      "type-body-medium flex h-10 items-center gap-2 self-start rounded-sm px-3 disabled:opacity-60",
                      doc.reviewed ? "text-success-ink hover:bg-success-soft" : "border border-ink text-ink hover:bg-subtle",
                    )}
                  >
                    {doc.reviewed ? t("reviewedUndo") : t("markReviewed")}
                  </button>
                )}

                {mode === "correction" && (
                  <label className="type-body-medium flex cursor-pointer items-center gap-2 text-ink">
                    <input
                      type="checkbox"
                      checked={flagged.includes(doc.id)}
                      onChange={(e) => setFlagged((f) => (e.target.checked ? [...f, doc.id] : f.filter((x) => x !== doc.id)))}
                      className="size-5 accent-brand"
                    />
                    {t("flag")}
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title={t("notesTitle")}>
        <label htmlFor={notesId} className="type-caption text-ink-muted">
          {t("notesHint")}
        </label>
        <textarea id={notesId} value={currentNotes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3} className={textareaClass} />
        <button
          type="button"
          onClick={() => notesSave.mutate(currentNotes.trim())}
          disabled={busy || notes === null}
          className="type-body-medium flex h-10 items-center gap-2 self-start rounded-sm border border-brand px-3 text-brand hover:bg-subtle disabled:opacity-50"
        >
          {notesSave.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {t("saveNotes")}
        </button>
      </Section>

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={cn("type-body flex items-start gap-2", message.kind === "error" ? "text-error" : "text-success-ink")}
        >
          {message.kind === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {message.text}
        </p>
      )}

      {/* Decision: only the buttons the backend allows for this request */}
      {(d.actions.approve || d.actions.requestCorrection || d.actions.reject || d.actions.revoke || isOpen) && (
        <Section title={t("decisionTitle")}>
          {mode === null ? (
            <div className="flex flex-col gap-2">
              {isOpen && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMessage(null);
                      approve.mutate();
                    }}
                    disabled={busy || !d.actions.approve}
                    aria-describedby={!d.actions.approve ? `${textId}-approve` : undefined}
                    className="type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-success-ink px-4 text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {approve.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                    {t("approve")}
                  </button>
                  {!d.actions.approve && (
                    <p id={`${textId}-approve`} className="type-caption text-ink-muted">
                      {t("approveHint")}
                    </p>
                  )}
                </>
              )}
              {d.actions.requestCorrection && (
                <button type="button" onClick={() => setMode("correction")} disabled={busy} className="type-body-medium flex h-12 items-center justify-center rounded-sm border border-highlight px-4 text-highlight hover:bg-highlight-soft disabled:opacity-60">
                  {t("requestCorrection")}
                </button>
              )}
              {d.actions.reject && (
                <button type="button" onClick={() => setMode("reject")} disabled={busy} className="type-body-medium flex h-12 items-center justify-center rounded-sm border border-error px-4 text-error hover:bg-error-soft disabled:opacity-60">
                  {t("reject")}
                </button>
              )}
              {d.actions.revoke && (
                <button type="button" onClick={() => setMode("revoke")} disabled={busy} className="type-body-medium flex h-11 items-center justify-center rounded-sm px-4 text-ink-secondary hover:bg-subtle disabled:opacity-60">
                  {t("revoke")}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-3">
              <p className="type-body-medium text-ink">
                {mode === "correction" ? t("correctionTitle") : mode === "reject" ? t("rejectTitle") : t("revokeTitle")}
              </p>
              {mode === "correction" && <p className="type-caption text-ink-secondary">{t("correctionDocs")}</p>}
              {mode === "revoke" && <p className="type-caption text-error">{t("revokeText")}</p>}
              <label htmlFor={textId} className="type-body-medium text-ink">
                {mode === "correction" ? t("correctionNote") : mode === "reject" ? t("rejectReason") : t("revokeReason")}
              </label>
              <textarea
                id={textId}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder={mode === "correction" ? t("correctionPlaceholder") : undefined}
                className={textareaClass}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode(null);
                    setText("");
                    setFlagged([]);
                    setMessage(null);
                  }}
                  disabled={busy}
                  className="type-body-medium flex h-12 items-center justify-center rounded-sm border border-ink px-4 text-ink hover:bg-subtle"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={busy}
                  className={cn(
                    "type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm px-4 text-primary-foreground hover:opacity-90 disabled:opacity-60",
                    mode === "correction" ? "bg-highlight" : "bg-error",
                  )}
                >
                  {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                  {mode === "correction" ? t("confirmCorrection") : mode === "reject" ? t("confirmReject") : t("confirmRevoke")}
                </button>
              </div>
            </div>
          )}
        </Section>
      )}

      <Section title={t("historyTitle")}>
        {d.history.length === 0 ? (
          <p className="type-body text-ink-muted">{t("historyEmpty")}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {d.history.map((h) => {
              const note = typeof h.meta?.note === "string" ? h.meta.note : typeof h.meta?.reason === "string" ? h.meta.reason : null;
              return (
                <li key={h.id} className="flex flex-col gap-0.5 border-l-2 border-gold pl-3">
                  <span className="type-body-medium text-ink">{historyLabel(h.action)}</span>
                  <span className="type-caption text-ink-muted">
                    {date(h.createdAt)}
                    {h.actor && ` · ${t("by", { name: h.actor })}`}
                  </span>
                  {/* Text from an admin: plain text, React escapes it */}
                  {note && <span className="type-caption whitespace-pre-line text-ink-secondary">{note}</span>}
                </li>
              );
            })}
          </ol>
        )}
      </Section>
    </div>
  );
}