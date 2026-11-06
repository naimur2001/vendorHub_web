"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
import { listAuditLogs, type AuditQuery } from "@/lib/api/admin";
import { cn } from "@/lib/utils";

const inputClass =
  "type-body h-11 w-full rounded-md border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Read-only list of audit entries; meta is shown as plain text (never as HTML). */
export function AuditLog() {
  const t = useTranslations("AdminAudit");
  const format = useFormatter();
  const ids = { action: useId(), from: useId(), to: useId() };
  const [draft, setDraft] = useState({ action: "", from: "", to: "" });
  const [query, setQuery] = useState<AuditQuery>({ page: 1, limit: 30 });
  const [open, setOpen] = useState<string | null>(null);

  const logs = useQuery({ queryKey: ["admin", "audit", query], queryFn: () => listAuditLogs(query), placeholderData: keepPreviousData });

  function onApply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const action = draft.action.replace(/\p{Cc}/gu, "").trim().slice(0, 100);
    setQuery({
      page: 1,
      limit: 30,
      ...(action && { action }),
      ...(DATE.test(draft.from) && { from: draft.from }),
      ...(DATE.test(draft.to) && { to: draft.to }),
    });
  }

  const rows = logs.data?.data ?? [];
  const total = logs.data?.meta?.pagination?.total ?? rows.length;
  const totalPages = logs.data?.meta?.pagination?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onApply} className="grid gap-3 rounded-md border border-line bg-card p-4 md:grid-cols-[1fr_10rem_10rem_auto] md:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.action} className="type-caption text-ink-secondary">{t("searchLabel")}</label>
          <input id={ids.action} type="search" maxLength={100} value={draft.action} placeholder={t("searchPlaceholder")} onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.from} className="type-caption text-ink-secondary">{t("from")}</label>
          <input id={ids.from} type="date" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.to} className="type-caption text-ink-secondary">{t("to")}</label>
          <input id={ids.to} type="date" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} className={inputClass} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="type-body-medium h-11 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover">{t("apply")}</button>
          <button
            type="button"
            onClick={() => {
              setDraft({ action: "", from: "", to: "" });
              setQuery({ page: 1, limit: 30 });
            }}
            className="type-body-medium h-11 rounded-sm px-3 text-ink-secondary hover:text-brand"
          >
            {t("clear")}
          </button>
        </div>
      </form>

      {logs.isPending ? (
        <OwnerSkeleton label={t("loading")} />
      ) : logs.isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center">
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => logs.refetch()} className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand">{t("retry")}</button>
        </div>
      ) : rows.length === 0 ? (
        <p className="type-body rounded-md border border-line bg-card px-6 py-12 text-center text-ink-secondary">{t("empty")}</p>
      ) : (
        <>
          <p className="type-body text-ink-secondary">{t("count", { count: total })}</p>
          <ol className={cn("flex flex-col rounded-md border border-line bg-card transition-opacity", logs.isPlaceholderData && "opacity-60")}>
            {rows.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 border-t border-line p-4 first:border-t-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <code className="type-body-medium rounded-sm bg-surface px-1.5 text-ink">{e.action}</code>
                  <span className="type-caption text-ink-muted">
                    {format.dateTime(new Date(e.createdAt), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
                <p className="type-caption text-ink-secondary">
                  {e.actor ? `${e.actor.name} · ${e.actor.email}` : t("system")} · {e.entityType}
                  {e.entityId && ` · ${e.entityId.slice(0, 8)}…`}
                </p>
                {e.meta && Object.keys(e.meta).length > 0 && (
                  <>
                    <button type="button" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)} className="type-caption self-start text-brand underline-offset-4 hover:underline">
                      {t("details")}
                    </button>
                    {open === e.id && (
                      <pre className="type-caption max-h-60 overflow-auto rounded-sm bg-surface p-2 whitespace-pre-wrap text-ink-secondary">{JSON.stringify(e.meta, null, 2)}</pre>
                    )}
                  </>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3 border-t border-gold pt-5">
          <button type="button" onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))} disabled={query.page <= 1} className="type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand disabled:invisible">
            <ChevronLeft className="size-4" aria-hidden />
            {t("previous")}
          </button>
          <span className="type-body text-ink-secondary">{t("pageOf", { page: query.page, total: totalPages })}</span>
          <button type="button" onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))} disabled={query.page >= totalPages} className="type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand disabled:invisible">
            {t("next")}
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      )}
    </div>
  );
}