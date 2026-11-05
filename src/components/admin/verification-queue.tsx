"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileText, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { ScoreBadge, StatusPill, VerificationDetail } from "@/components/admin/verification-detail";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useRouter } from "@/i18n/routing";
import {
  adminKeys,
  LEVELS,
  listVerifications,
  QUEUE_FILTERS,
  type AdminVerificationRow,
  type QueueFilter,
  type QueueQuery,
  type VerificationDoc,
} from "@/lib/api/admin";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// URL values are checked; anything unexpected is ignored.
function readQuery(params: URLSearchParams): QueueQuery {
  const status = params.get("status");
  const q = params.get("q");
  const from = params.get("from");
  const to = params.get("to");
  const page = params.get("page");
  const pageNumber = page && /^\d{1,3}$/.test(page) ? Number(page) : 1;
  const cleanQ = q ? q.replace(/\p{Cc}/gu, "").trim().slice(0, 100) : "";
  return {
    status: status && (QUEUE_FILTERS as string[]).includes(status) ? (status as QueueFilter) : "OPEN",
    q: cleanQ || undefined,
    from: from && DATE.test(from) ? from : undefined,
    to: to && DATE.test(to) ? to : undefined,
    page: pageNumber >= 1 && pageNumber <= 500 ? pageNumber : 1,
    limit: PAGE_SIZE,
  };
}

function queueHref(q: QueueQuery): string {
  const params = new URLSearchParams();
  if (q.status !== "OPEN") params.set("status", q.status);
  if (q.q) params.set("q", q.q);
  if (q.from) params.set("from", q.from);
  if (q.to) params.set("to", q.to);
  if (q.page > 1) params.set("page", String(q.page));
  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

const inputClass =
  "type-body h-11 w-full rounded-md border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";

function DocChips({ docs }: { docs: VerificationDoc[] }) {
  const t = useTranslations("Admin");
  return (
    <ul className="flex flex-wrap gap-1.5">
      {docs.map((d) => {
        const name = t(`docs.${d.type}`);
        const state = d.needsReupload ? "reupload" : d.reviewed ? "reviewed" : "open";
        return (
          <li
            key={d.id}
            aria-label={t(`docState.${state}`, { doc: name })}
            className={cn(
              "type-caption flex items-center gap-1 rounded-sm border px-1.5 py-0.5 whitespace-nowrap",
              state === "reupload" && "border-highlight bg-highlight-soft text-highlight",
              state === "reviewed" && "border-success-ink/40 bg-success-soft text-success-ink",
              state === "open" && "border-line bg-card text-ink-secondary",
            )}
          >
            <FileText className="size-3.5" aria-hidden />
            <span aria-hidden>
              {name}
              {state === "reviewed" && " ✓"}
              {state === "reupload" && " ⚠"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Five dots: done in green, the requested level outlined in gold. */
function LevelDots({ row }: { row: AdminVerificationRow }) {
  const t = useTranslations("Admin");
  const current = LEVELS.indexOf(row.currentLevel);
  const target = LEVELS.indexOf(row.targetLevel);
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1" aria-hidden>
        {LEVELS.slice(1).map((level, i) => {
          const index = i + 1;
          return (
            <span
              key={level}
              className={cn(
                "size-2.5 rounded-full border",
                index <= current && "border-success-ink bg-success-ink",
                index === target && index > current && "border-2 border-gold bg-card",
                index > current && index !== target && "border-line-strong bg-card",
              )}
            />
          );
        })}
      </span>
      <span className="type-caption text-ink-secondary">{t("queue.toLevel", { level: t(`levels.${row.targetLevel}`) })}</span>
    </div>
  );
}

function ReviewButton({ row, onOpen }: { row: AdminVerificationRow; onOpen: () => void }) {
  const t = useTranslations("AdminReview");
  const open = row.status === "PENDING" || row.status === "AUTO_FLAGGED";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("reviewLabel", { shop: row.shop.name })}
      className={cn(
        "type-body-medium flex h-10 items-center gap-1 rounded-sm px-3 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
        open ? "bg-action text-primary-foreground hover:bg-action-hover" : "border border-brand text-brand hover:bg-subtle",
      )}
    >
      {t("review")}
      <ChevronRight className="size-4" aria-hidden />
    </button>
  );
}

export function VerificationQueue() {
  const t = useTranslations("Admin.queue");
  const tReview = useTranslations("AdminReview");
  const format = useFormatter();
  // One shared "now" for "Submitted 2 days ago", refreshed every minute.
  const now = useNow({ updateInterval: 60_000 });
  const router = useRouter();
  const searchParams = useSearchParams();
  const ids = { status: useId(), q: useId(), from: useId(), to: useId() };

  const query = readQuery(new URLSearchParams(searchParams.toString()));
  const [draft, setDraft] = useState({ status: query.status, q: query.q ?? "", from: query.from ?? "", to: query.to ?? "" });
  const [openId, setOpenId] = useState<string | null>(null);

  const queue = useQuery({
    queryKey: adminKeys.queue(query),
    queryFn: () => listVerifications(query),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const go = (next: QueueQuery) => router.replace(queueHref(next), { scroll: false });

  function onApply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    go(
      readQuery(
        new URLSearchParams({
          status: draft.status,
          ...(draft.q && { q: draft.q }),
          ...(draft.from && { from: draft.from }),
          ...(draft.to && { to: draft.to }),
        }),
      ),
    );
  }

  function onClear() {
    setDraft({ status: "OPEN", q: "", from: "", to: "" });
    go(readQuery(new URLSearchParams()));
  }

  const stats = queue.data?.stats;
  const rows = queue.data?.data ?? [];
  const total = queue.data?.meta?.pagination?.total ?? rows.length;
  const totalPages = queue.data?.meta?.pagination?.totalPages ?? 1;
  const when = (iso: string) => format.relativeTime(new Date(iso), now);

  return (
    <div className="flex flex-col gap-6">
      {/* Spec: QueueStatsRow */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: t("stats.pending"), value: stats?.pendingReview },
          { label: t("stats.flagged"), value: stats?.autoFlagged },
          { label: t("stats.approved"), value: stats?.approvedThisWeek },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-1 rounded-md border border-line bg-card p-4 shadow-card">
            <span className="type-caption text-ink-muted">{s.label}</span>
            <span className="font-heading text-[2rem] leading-none text-ink">{s.value ?? "–"}</span>
          </div>
        ))}
      </div>

      {/* Spec: FilterBar */}
      <form onSubmit={onApply} aria-label={t("filtersLabel")} className="grid gap-3 rounded-md border border-line bg-card p-4 md:grid-cols-[12rem_1fr_10rem_10rem_auto] md:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.status} className="type-caption text-ink-secondary">
            {t("status")}
          </label>
          <select id={ids.status} value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as QueueFilter }))} className={inputClass}>
            {QUEUE_FILTERS.map((f) => (
              <option key={f} value={f}>
                {t(`filters.${f}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.q} className="type-caption text-ink-secondary">
            {t("search")}
          </label>
          <input id={ids.q} type="search" maxLength={100} value={draft.q} placeholder={t("searchPlaceholder")} onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.from} className="type-caption text-ink-secondary">
            {t("from")}
          </label>
          <input id={ids.from} type="date" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.to} className="type-caption text-ink-secondary">
            {t("to")}
          </label>
          <input id={ids.to} type="date" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} className={inputClass} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="type-body-medium flex h-11 items-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover">
            <Search className="size-4" aria-hidden />
            {t("apply")}
          </button>
          <button type="button" onClick={onClear} className="type-body-medium flex h-11 items-center rounded-sm px-3 text-ink-secondary hover:text-brand">
            {t("clear")}
          </button>
        </div>
      </form>

      {queue.isPending ? (
        <OwnerSkeleton label={t("title")} />
      ) : queue.isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center">
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => queue.refetch()} className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand">
            {t("retry")}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="type-body rounded-md border border-line bg-card px-6 py-12 text-center text-ink-secondary">
          {query.status === "OPEN" && !query.q && !query.from && !query.to ? t("emptyOpen") : t("empty")}
        </p>
      ) : (
        <div className={cn("flex flex-col gap-3 transition-opacity", queue.isPlaceholderData && "opacity-60")}>
          <p className="type-body text-ink-secondary" aria-live="polite">
            {t("count", { count: total })}
          </p>

          {/* Desktop: the spec's table */}
          <div className="hidden overflow-x-auto rounded-md border border-line bg-card md:block">
            <table className="w-full text-left">
              <caption className="sr-only">{t("tableCaption")}</caption>
              <thead className="type-body-medium bg-surface text-ink-secondary">
                <tr>
                  <th scope="col" className="px-4 py-3">{t("columns.business")}</th>
                  <th scope="col" className="px-4 py-3">{t("columns.address")}</th>
                  <th scope="col" className="px-4 py-3">{t("columns.documents")}</th>
                  <th scope="col" className="px-4 py-3">{t("columns.score")}</th>
                  <th scope="col" className="px-4 py-3">{t("columns.level")}</th>
                  <th scope="col" className="px-4 py-3">{t("columns.status")}</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">{tReview("columnActions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-line align-top">
                    <td className="px-4 py-4">
                      <p className="type-body-medium text-ink">{row.shop.name}</p>
                      <p className="type-caption text-ink-muted">{t("submitted", { when: when(row.submittedAt) })}</p>
                    </td>
                    <td className="type-body max-w-56 px-4 py-4 text-ink-secondary">{row.shop.addressLine}</td>
                    <td className="px-4 py-4"><DocChips docs={row.documents} /></td>
                    <td className="px-4 py-4"><ScoreBadge row={row} /></td>
                    <td className="px-4 py-4"><LevelDots row={row} /></td>
                    <td className="px-4 py-4"><StatusPill status={row.status} /></td>
                    <td className="px-4 py-4"><ReviewButton row={row} onOpen={() => setOpenId(row.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: the same as cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-2 rounded-md border border-line bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="type-body-medium text-ink">{row.shop.name}</p>
                    <p className="type-caption text-ink-muted">{t("submitted", { when: when(row.submittedAt) })}</p>
                  </div>
                  <ScoreBadge row={row} />
                </div>
                <p className="type-body text-ink-secondary">{row.shop.addressLine}</p>
                <DocChips docs={row.documents} />
                <div className="flex items-end justify-between gap-2">
                  <LevelDots row={row} />
                  <StatusPill status={row.status} />
                </div>
                <ReviewButton row={row} onOpen={() => setOpenId(row.id)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3 border-t border-gold pt-5">
          <button
            type="button"
            onClick={() => go({ ...query, page: query.page - 1 })}
            disabled={query.page <= 1}
            className="type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand hover:bg-subtle disabled:invisible"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {t("previous")}
          </button>
          <span className="type-body text-ink-secondary">{t("pageOf", { page: query.page, total: totalPages })}</span>
          <button
            type="button"
            onClick={() => go({ ...query, page: query.page + 1 })}
            disabled={query.page >= totalPages}
            className="type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand hover:bg-subtle disabled:invisible"
          >
            {t("next")}
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      )}

      {/* Spec: RowDetailDrawer (right side) */}
      <Sheet open={openId !== null} onOpenChange={(isOpen) => !isOpen && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="type-h3 text-ink">{tReview("sheetTitle")}</SheetTitle>
            <SheetDescription className="sr-only">{t("subtitle")}</SheetDescription>
          </SheetHeader>
          <div className="px-4">{openId && <VerificationDetail key={openId} id={openId} />}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}