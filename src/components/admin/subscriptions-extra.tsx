"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { subCard, subField, subOutline, subSolid, useSubError } from "@/components/admin/subscriptions-overview";
import { Link } from "@/i18n/routing";
import { approveRequest, getSubUsage, listRequests, rejectRequest, subKeys, type SubscriptionRequest } from "@/lib/api/subscriptions";
import { cn } from "@/lib/utils";

/** Plan requests from shop owners (only once subscriptions are on): approve after payment, or reject. */
export function SubscriptionRequests() {
  const t = useTranslations("AdminSubscriptions.requests");
  const requests = useQuery({ queryKey: subKeys.requests, queryFn: listRequests });
  const pending = (requests.data ?? []).filter((r) => r.status === "PENDING");

  return (
    <section aria-labelledby="sub-requests" className={subCard}>
      <div className="flex flex-col gap-1">
        <h2 id="sub-requests" className="type-h3 text-ink">{t("title")}</h2>
        <p className="type-caption text-ink-muted">{t("text")}</p>
      </div>
      {requests.isPending ? (
        <div className="relative h-20 skeleton overflow-hidden rounded-sm" aria-hidden />
      ) : requests.isError ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => requests.refetch()} className={subOutline}>{t("retry")}</button>
        </div>
      ) : pending.length === 0 ? (
        <p className="type-body text-ink-secondary">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.map((r) => <RequestRow key={r.id} r={r} />)}
        </ul>
      )}
    </section>
  );
}

function RequestRow({ r }: { r: SubscriptionRequest }) {
  const t = useTranslations("AdminSubscriptions.requests");
  const tP = useTranslations("AdminSubscriptions.period");
  const format = useFormatter();
  const uid = useId();
  const queryClient = useQueryClient();
  const errorText = useSubError();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [trial, setTrial] = useState("");
  const [note, setNote] = useState("");
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
  const approve = useMutation({ mutationFn: () => approveRequest(r.id, { ...(trial && { trialDays: Number(trial) }), ...(note.trim() && { note: note.trim() }) }), onSuccess: refresh });
  const reject = useMutation({ mutationFn: () => rejectRequest(r.id, note.trim()), onSuccess: refresh });
  const error = approve.error ?? reject.error;
  const busy = approve.isPending || reject.isPending;

  return (
    <li className="flex flex-col gap-2 rounded-sm border border-line p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {/* Shop and plan names: plain text */}
        <span className="type-body-medium text-ink">{r.shop?.name ?? "—"}</span>
        <span className="type-caption text-ink-muted">{format.dateTime(new Date(r.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
      </div>
      <p className="type-caption text-ink-secondary">{t("wants", { plan: r.plan.nameEn ?? r.plan.code ?? "—", period: tP(r.period) })}</p>
      {mode === null ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode("approve")} className={subSolid}>{t("approve")}</button>
          <button type="button" onClick={() => setMode("reject")} className={cn(subOutline, "border-error text-error hover:bg-error-soft")}>{t("reject")}</button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "approve") approve.mutate();
            else if (note.trim().length >= 3) reject.mutate();
          }}
          className="flex flex-col gap-2"
        >
          {mode === "approve" && (
            <label htmlFor={`${uid}-t`} className="flex w-40 flex-col gap-1">
              <span className="type-caption text-ink-secondary">{t("trialDays")}</span>
              <input id={`${uid}-t`} inputMode="numeric" value={trial} onChange={(e) => setTrial(e.target.value.replace(/\D/g, "").slice(0, 3))} className={subField} />
            </label>
          )}
          <label htmlFor={`${uid}-n`} className="flex flex-col gap-1">
            <span className="type-caption text-ink-secondary">{mode === "approve" ? t("noteOptional") : t("reason")}</span>
            <input id={`${uid}-n`} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className={subField} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || (mode === "reject" && note.trim().length < 3)} aria-busy={busy} className={mode === "approve" ? subSolid : "type-body-medium inline-flex h-11 items-center gap-1.5 rounded-sm bg-error px-4 text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none disabled:opacity-60"}>
              {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {mode === "approve" ? t("confirmApprove") : t("confirmReject")}
            </button>
            <button type="button" onClick={() => setMode(null)} disabled={busy} className="type-body-medium h-11 rounded-sm px-4 text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">{t("cancel")}</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="type-body flex items-start gap-2 text-error"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{errorText(error)}</p>}
    </li>
  );
}

/** Which shops use each module today, to help choose what goes in which plan before prices are set. */
export function ModuleUsageTable() {
  const t = useTranslations("AdminSubscriptions.usage");
  const tM = useTranslations("AdminSubscriptions.module");
  const usage = useQuery({ queryKey: subKeys.usage, queryFn: getSubUsage });

  return (
    <section aria-labelledby="sub-usage" className={subCard}>
      <div className="flex flex-col gap-1">
        <h2 id="sub-usage" className="type-h3 text-ink">{t("title")}</h2>
        <p className="type-caption text-ink-muted">{t("text")}</p>
      </div>
      {usage.isPending ? (
        <div className="relative h-40 skeleton overflow-hidden rounded-sm" aria-hidden />
      ) : usage.isError ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => usage.refetch()} className={subOutline}>{t("retry")}</button>
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <table className="w-full min-w-[40rem] text-left">
            <thead>
              <tr className="type-caption text-ink-muted">
                <th scope="col" className="py-2 font-medium">{t("colModule")}</th>
                <th scope="col" className="py-2 font-medium">{t("colMeasure")}</th>
                <th scope="col" className="py-2 text-right font-medium">{t("colShops")}</th>
                <th scope="col" className="py-2 text-right font-medium">{t("colTotal")}</th>
                <th scope="col" className="py-2 font-medium">{t("colTop")}</th>
              </tr>
            </thead>
            <tbody>
              {usage.data.modules.map((m) => (
                <tr key={m.module} className="type-body border-t border-line align-top text-ink">
                  <td className="py-2 pr-3">{tM(m.module)}</td>
                  <td className="type-caption py-2 pr-3 text-ink-secondary">{m.metric ?? t("notTracked")}</td>
                  <td className="py-2 text-right tabular-nums">{m.metric ? m.shopCount : "—"}</td>
                  <td className="py-2 text-right tabular-nums">{m.metric ? m.total : "—"}</td>
                  <td className="type-caption py-2 pl-3 text-ink-secondary">
                    {m.top.length === 0
                      ? "—"
                      : m.top.slice(0, 3).map((s, i) => (
                          <span key={s.shopId ?? i}>
                            {i > 0 && ", "}
                            {s.slug ? <Link href={`/shops/${s.slug}`} className="text-brand underline-offset-4 hover:underline">{s.name}</Link> : s.name}
                            {typeof s.count === "number" && ` (${s.count})`}
                          </span>
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
