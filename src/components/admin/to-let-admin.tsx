"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, FileText, Handshake, LoaderCircle, MessageSquareWarning, RefreshCw, Send, StickyNote, XCircle } from "lucide-react";
import Image from "next/image";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { PrivateDocument } from "@/components/admin/private-document";
import { ToLetThread } from "@/components/to-let/to-let-thread";
import { FormModal } from "@/components/ui/form-modal";
import { Link } from "@/i18n/routing";
import { ApiError } from "@/lib/api/core";
import { safeMediaUrl } from "@/lib/api/storefront";
import {
  addToLetNote,
  adminToLetKeys,
  getAdminToLet,
  listAdminToLet,
  markToLetRented,
  publishToLet,
  rejectToLet,
  renewToLet,
  replyToInquiry,
  replyToOwner,
  requestToLetInfo,
  setInquiryStatus,
  shareInquiryContacts,
  type AdminInquiry,
  type AdminToLetDetail,
  type ToLetStatus,
} from "@/lib/api/to-let";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import { refreshPublicPages } from "@/lib/refresh-public";

const STATUSES: ToLetStatus[] = ["SUBMITTED", "NEEDS_INFO", "PUBLISHED", "PENDING_EMAIL", "RENTED", "REJECTED", "EXPIRED", "WITHDRAWN"];
const INQ: AdminInquiry["status"][] = ["NEW", "IN_TALKS", "CONNECTED", "CLOSED"];
const chip = (on: boolean) =>
  cn("type-body-medium h-11 shrink-0 rounded-full border px-4 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none", on ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand");
const solid = "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60";
const outline = "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60";
const area = "type-body w-full rounded-sm border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";

const errText = (err: unknown, t: (k: string) => string) =>
  err instanceof ApiError && err.status === 409 ? t("errors.state") : err instanceof ApiError && err.status === 0 ? t("errors.network") : t("errors.generic");

/** Admin: verify shops to let, publish them, and handle the owner and renter conversations as the middleman. */
export function ToLetAdmin() {
  const t = useTranslations("AdminToLet");
  const tStatus = useTranslations("ToLetManage.status");
  const locale = useLocale();
  const format = useFormatter();
  const [status, setStatus] = useState<ToLetStatus | undefined>("SUBMITTED");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: adminToLetKeys.list(status, page), queryFn: () => listAdminToLet(status, page), placeholderData: keepPreviousData, refetchInterval: 60_000 });
  const list = q.data?.data ?? [];
  const totalPages = q.data?.meta?.pagination?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-5">
      <div role="group" aria-label={t("statusLabel")} className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        <button type="button" aria-pressed={!status} onClick={() => { setStatus(undefined); setPage(1); }} className={chip(!status)}>{t("all")}</button>
        {STATUSES.map((s) => (
          <button key={s} type="button" aria-pressed={status === s} onClick={() => { setStatus(s); setPage(1); }} className={chip(status === s)}>
            {tStatus(s)}
            {(q.data?.counts?.[s] ?? 0) > 0 && <span className="type-caption ml-1.5 rounded-full bg-highlight-soft px-2 text-highlight">{q.data?.counts?.[s]}</span>}
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
        <ul className={cn("flex flex-col gap-2", q.isPlaceholderData && "opacity-60")}>
          {list.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => setOpen(l.id)} className="flex w-full flex-col gap-1 rounded-md border border-line bg-card p-3 text-left shadow-card hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none md:flex-row md:items-center md:gap-4">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="type-body-medium text-ink">{l.title}</span>
                    <span className="type-caption rounded-full bg-subtle px-2 py-0.5 text-ink-secondary">{tStatus(l.status)}</span>
                    {l.guest && <span className="type-caption rounded-full bg-info-soft px-2 py-0.5 text-verified">{t("guest")}</span>}
                  </span>
                  <span className="type-caption text-ink-secondary">{l.contactName} · {l.contactPhone}</span>
                  <span className="type-caption text-ink-muted">
                    {t("rowMeta", { photos: l.photoCount, docs: l.documentCount, inquiries: l.inquiryCount })} · {format.dateTime(new Date(l.updatedAt), { day: "numeric", month: "short" })}
                  </span>
                </span>
                <span className="type-price shrink-0 text-ink">{formatTaka(l.monthlyRent, locale)}</span>
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
        size="sm:max-w-2xl"
      >
          <div>{open && <Detail key={open} id={open} />}</div>
        </FormModal>
    </div>
  );
}

function Detail({ id }: { id: string }) {
  const t = useTranslations("AdminToLet");
  const tStatus = useTranslations("ToLetManage.status");
  const locale = useLocale();
  const format = useFormatter();
  const uid = useId();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [mode, setMode] = useState<"info" | "reject" | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");

  const q = useQuery({ queryKey: adminToLetKeys.detail(id), queryFn: () => getAdminToLet(id) });
  const refresh = () => {
    refreshPublicPages(["to-let"]);
    void queryClient.invalidateQueries({ queryKey: adminToLetKeys.detail(id) });
    void queryClient.invalidateQueries({ queryKey: ["admin", "to-let"] });
  };
  const act = useMutation({
    mutationFn: (a: () => Promise<unknown>) => a(),
    onSuccess: () => {
      setMode(null);
      setText("");
      refresh();
    },
    onError: (e) => setNotice({ ok: false, text: errText(e, t) }),
  });
  const run = (fn: () => Promise<unknown>, ok: string) => {
    setNotice(null);
    act.mutate(fn, { onSuccess: () => setNotice({ ok: true, text: ok }) });
  };

  if (q.isPending) return <div className="h-96 skeleton rounded-md" aria-hidden />;
  if (q.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => q.refetch()} className={outline}>{t("retry")}</button>
      </div>
    );
  }
  const l: AdminToLetDetail = q.data;
  const when = (iso: string) => format.dateTime(new Date(iso), { day: "numeric", month: "short", year: "numeric" });
  const canPublish = l.status === "SUBMITTED" || l.status === "NEEDS_INFO";
  const canInfo = l.status === "SUBMITTED" || l.status === "PUBLISHED";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="type-h3 text-ink">{l.title}</h3>
          <span className="type-caption rounded-full bg-subtle px-2 py-0.5 text-ink-secondary">{tStatus(l.status)}</span>
        </div>
        <p className="type-caption text-ink-muted">
          {[l.shopNumber, l.levelFloor, l.addressLine].filter(Boolean).join(" · ")}
        </p>
        <p className="type-body text-ink">
          {t("terms", { rent: formatTaka(l.monthlyRent, locale), advance: formatTaka(l.advance, locale), size: format.number(l.sizeSqft) })}
          {l.availableFrom && ` · ${t("availableFrom", { date: l.availableFrom })}`}
        </p>
        {l.expiresAt && l.status === "PUBLISHED" && <p className="type-caption text-ink-muted">{t("expires", { date: when(l.expiresAt) })}</p>}
        {l.status === "PUBLISHED" && l.slug && <Link href={`/to-let/${l.slug}`} className="type-body-medium self-start text-brand underline-offset-4 hover:underline">{t("viewPublic")}</Link>}
      </div>

      {notice && <p role={notice.ok ? "status" : "alert"} className={cn("type-body rounded-md p-3", notice.ok ? "bg-success-soft text-success-ink" : "bg-error-soft text-error")}>{notice.text}</p>}

      <div className="flex flex-wrap gap-2">
        {canPublish && (
          <button type="button" onClick={() => run(() => publishToLet(id), t("published"))} disabled={act.isPending} className={solid}>
            {act.isPending ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
            {t("publish")}
          </button>
        )}
        {canInfo && <button type="button" onClick={() => setMode("info")} className={outline}><MessageSquareWarning className="size-4" aria-hidden />{t("requestInfo")}</button>}
        {(canPublish || l.status === "PUBLISHED") && <button type="button" onClick={() => setMode("reject")} className={cn(outline, "border-error text-error hover:bg-error-soft")}><XCircle className="size-4" aria-hidden />{t("reject")}</button>}
        {l.status === "PUBLISHED" && <button type="button" onClick={() => window.confirm(t("confirmRented")) && run(() => markToLetRented(id), t("rented"))} disabled={act.isPending} className={outline}><Handshake className="size-4" aria-hidden />{t("markRented")}</button>}
        {(l.status === "PUBLISHED" || l.status === "EXPIRED") && <button type="button" onClick={() => run(() => renewToLet(id), t("renewed"))} disabled={act.isPending} className={outline}><RefreshCw className="size-4" aria-hidden />{t("renew")}</button>}
      </div>
      {mode && (
        <div className="flex flex-col gap-2 rounded-md border border-line bg-subtle p-3">
          <label htmlFor={`${uid}-m`} className="type-body-medium text-ink">{mode === "info" ? t("infoLabel") : t("rejectLabel")}</label>
          <textarea id={`${uid}-m`} value={text} onChange={(e) => setText(e.target.value)} maxLength={mode === "info" ? 1000 : 500} rows={3} className={area} />
          <p className="type-caption text-ink-muted">{t("ownerSees")}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={text.trim().length < 3 || act.isPending}
              onClick={() => run(() => (mode === "info" ? requestToLetInfo(id, text.trim()) : rejectToLet(id, text.trim())), mode === "info" ? t("infoSent") : t("rejected"))}
              className={solid}
            >
              {t(mode === "info" ? "sendInfo" : "confirmReject")}
            </button>
            <button type="button" onClick={() => setMode(null)} className={outline}>{t("cancel")}</button>
          </div>
        </div>
      )}

      <section className="flex flex-col gap-2 border-t border-line pt-4">
        <h4 className="type-body-medium text-ink">{t("owner")}</h4>
        <dl className="type-body grid gap-1 rounded-md bg-subtle p-3 text-ink-secondary">
          <div>{l.contactName} · {l.contactPhone}</div>
          <div className="break-all">{l.contactEmail}</div>
          <div className="type-caption">{l.guest ? t("guestOwner") : t("accountOwner", { name: l.submitter?.name ?? "" })}</div>
        </dl>
      </section>

      {l.photos.length > 0 && (
        <section className="flex flex-col gap-2 border-t border-line pt-4">
          <h4 className="type-body-medium text-ink">{t("photos", { count: l.photos.length })}</h4>
          <ul className="flex flex-wrap gap-2">
            {l.photos.map((p, i) => safeMediaUrl(p.thumbUrl) && (
              <li key={p.id} className="relative size-24 overflow-hidden rounded-md bg-subtle">
                <Image src={safeMediaUrl(p.thumbUrl)!} alt={t("photoN", { n: i + 1 })} fill unoptimized sizes="96px" className="object-cover" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2 border-t border-line pt-4">
        <h4 className="type-body-medium flex items-center gap-2 text-ink"><FileText className="size-4 text-highlight" aria-hidden />{t("documents", { count: l.documents.length })}</h4>
        {l.documents.length === 0 ? (
          <p className="type-caption text-ink-muted">{t("noDocuments")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {l.documents.map((d) => (
              <li key={d.id}>
                <PrivateDocument fileUrl={d.url} label={d.originalName} fileName={d.originalName} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 border-t border-line pt-4">
        <h4 className="type-body-medium text-ink">{t("description")}</h4>
        <p className="type-body whitespace-pre-line text-ink-secondary">{l.description}</p>
      </section>

      <ToLetThread
        queryKey={[...adminToLetKeys.detail(id), "owner-thread"]}
        load={async () => (await getAdminToLet(id)).ownerThread.messages}
        send={(body) => replyToOwner(id, body)}
        title={t("ownerThread")}
        intro={t("ownerThreadIntro")}
        pollMs={30_000}
      />

      <section className="flex flex-col gap-3 border-t border-line pt-4">
        <h4 className="type-h3 text-ink">{t("inquiries", { count: l.inquiries.length })}</h4>
        {l.inquiries.length === 0 && <p className="type-caption text-ink-muted">{t("noInquiries")}</p>}
        {l.inquiries.map((i) => (
          <InquiryCard key={i.id} inquiry={i} onChanged={refresh} />
        ))}
      </section>

      <section className="flex flex-col gap-2 border-t border-line pt-4">
        <h4 className="type-body-medium flex items-center gap-2 text-ink"><StickyNote className="size-4 text-highlight" aria-hidden />{t("notes")}</h4>
        {l.notes.map((n) => (
          <div key={n.id} className="rounded-md bg-subtle p-2">
            <p className="type-body whitespace-pre-wrap text-ink">{n.body}</p>
            <p className="type-caption text-ink-muted">{n.author?.name ?? t("admin")} · {when(n.createdAt)}</p>
          </div>
        ))}
        <label htmlFor={`${uid}-n`} className="sr-only">{t("addNote")}</label>
        <textarea id={`${uid}-n`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder={t("notePlaceholder")} className={area} />
        <button
          type="button"
          disabled={!note.trim() || act.isPending}
          onClick={() => {
            const body = note.trim();
            setNote("");
            run(() => addToLetNote(id, body), t("noteAdded"));
          }}
          className={cn(outline, "self-start")}
        >
          {t("addNote")}
        </button>
      </section>
    </div>
  );
}

function InquiryCard({ inquiry: i, onChanged }: { inquiry: AdminInquiry; onChanged: () => void }) {
  const t = useTranslations("AdminToLet");
  const format = useFormatter();
  const uid = useId();
  const [reply, setReply] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const send = useMutation({ mutationFn: () => replyToInquiry(i.id, reply.trim()), onSuccess: () => { setReply(""); onChanged(); }, onError: (e) => setErr(errText(e, t)) });
  const status = useMutation({ mutationFn: (s: AdminInquiry["status"]) => setInquiryStatus(i.id, s), onSuccess: onChanged, onError: (e) => setErr(errText(e, t)) });
  const share = useMutation({ mutationFn: () => shareInquiryContacts(i.id), onSuccess: onChanged, onError: (e) => setErr(errText(e, t)) });

  return (
    <article className="flex flex-col gap-2 rounded-md border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-body-medium text-ink">{i.name}</span>
        <span className="type-caption text-ink-secondary">{i.phone}{i.email ? ` · ${i.email}` : ""}</span>
        {i.guest && <span className="type-caption rounded-full bg-info-soft px-2 py-0.5 text-verified">{t("guest")}</span>}
        <label className="ml-auto">
          <span className="sr-only">{t("inquiryStatus")}</span>
          <select value={i.status} onChange={(e) => status.mutate(e.target.value as AdminInquiry["status"])} disabled={status.isPending} className="type-caption h-11 rounded-sm border border-input bg-card px-2 text-ink">
            {INQ.map((s) => <option key={s} value={s}>{t(`inq.${s}`)}</option>)}
          </select>
        </label>
      </div>
      <p className="type-body rounded-md bg-subtle p-2 whitespace-pre-wrap text-ink">{i.message}</p>
      {i.messages.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {i.messages.map((m) => (
            <li key={m.id} className={cn("type-body max-w-[85%] rounded-2xl px-3 py-1.5 break-words whitespace-pre-wrap", m.mine ? "self-end bg-brand text-primary-foreground" : "self-start bg-subtle text-ink")}>
              {m.body}
              <span className="type-caption block opacity-75">{format.dateTime(new Date(m.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="flex items-end gap-2">
        <label htmlFor={`${uid}-r`} className="sr-only">{t("replyLabel", { name: i.name })}</label>
        <textarea id={`${uid}-r`} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={1000} rows={2} placeholder={t("replyPlaceholder")} className={area} />
        <button type="button" onClick={() => send.mutate()} disabled={!reply.trim() || send.isPending} aria-label={t("reply")} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-action text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50">
          {send.isPending ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {i.contactsSharedAt ? (
          <span className="type-caption text-success-ink">{t("shared", { date: format.dateTime(new Date(i.contactsSharedAt), { day: "numeric", month: "short" }) })}</span>
        ) : (
          <button type="button" onClick={() => window.confirm(t("confirmShare")) && share.mutate()} disabled={share.isPending} className={outline}>
            <Handshake className="size-4" aria-hidden />
            {t("shareContacts")}
          </button>
        )}
      </div>
      {err && <p role="alert" className="type-caption text-error">{err}</p>}
    </article>
  );
}
