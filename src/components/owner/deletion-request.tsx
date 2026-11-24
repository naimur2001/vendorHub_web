"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, LoaderCircle, Trash2, Undo2 } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { ApiError } from "@/lib/api/core";
import { listingKeys } from "@/lib/api/listings";
import {
  cancelDeletionRequest,
  deletionErrorCode,
  deletionKeys,
  listShopDeletionRequests,
  requestProductDeletion,
  type DeletionRequest,
} from "@/lib/api/product-deletion";
import { cn } from "@/lib/utils";

const KNOWN = ["ALREADY_PENDING", "NOT_PENDING"];
const outline = "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60";
const danger = "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm bg-error px-4 text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60";

function useRequests(shopId: string) {
  return useQuery({ queryKey: deletionKeys.shop(shopId), queryFn: () => listShopDeletionRequests(shopId).then((r) => r.data), refetchInterval: 60_000 });
}

function useErrorText() {
  const t = useTranslations("OwnerDeletion");
  return (err: unknown) => {
    if (err instanceof ApiError) {
      const code = deletionErrorCode(err.details);
      if (err.status === 409 && code && KNOWN.includes(code)) return t(`errors.${code}`);
      if (err.status === 403) return t("errors.ownerOnly");
      if (err.status === 404) return t("errors.notListed");
      if (err.status === 0) return t("errors.network");
    }
    return t("errors.generic");
  };
}

function useRefresh(shopId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: deletionKeys.shop(shopId) });
    void queryClient.invalidateQueries({ queryKey: listingKeys.mine(shopId) });
  };
}

/** "Deletes in 11 hours" for a waiting request. */
function Countdown({ r }: { r: DeletionRequest }) {
  const t = useTranslations("OwnerDeletion");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const at = new Date(r.autoDeleteAt);
  return (
    <span className="type-caption inline-flex items-center gap-1 text-highlight">
      <Clock className="size-3.5" aria-hidden />
      {at > now ? t("autoIn", { when: format.relativeTime(at, now) }) : t("autoSoon")}
    </span>
  );
}

function CancelButton({ shopId, r }: { shopId: string; r: DeletionRequest }) {
  const t = useTranslations("OwnerDeletion");
  const errorText = useErrorText();
  const refresh = useRefresh(shopId);
  const cancel = useMutation({ mutationFn: () => cancelDeletionRequest(shopId, r.id), onSettled: refresh });
  return (
    <span className="flex flex-col gap-1">
      <button type="button" onClick={() => cancel.mutate()} disabled={cancel.isPending} className={outline}>
        {cancel.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Undo2 className="size-4" aria-hidden />}
        {t("cancel")}
      </button>
      {cancel.isError && <span role="alert" className="type-caption text-error">{errorText(cancel.error)}</span>}
    </span>
  );
}

/** Inside a product's edit panel (shop owner only): ask for deletion, or see and cancel the waiting request. */
export function DeletionRequestBox({ shopId, productId }: { shopId: string; productId: string }) {
  const t = useTranslations("OwnerDeletion");
  const uid = useId();
  const errorText = useErrorText();
  const refresh = useRefresh(shopId);
  const requests = useRequests(shopId);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const send = useMutation({
    mutationFn: () => requestProductDeletion(shopId, productId, reason.trim() || undefined),
    onSuccess: () => { setOpen(false); setReason(""); refresh(); },
  });

  const pending = requests.data?.find((r) => r.productId === productId && r.status === "PENDING");

  return (
    <section aria-labelledby={`${uid}-title`} className="flex flex-col gap-2 border-t border-line pt-4">
      <h3 id={`${uid}-title`} className="type-body-medium text-ink">{t("boxTitle")}</h3>
      {requests.isPending ? (
        <div className="h-11 skeleton rounded-sm" aria-hidden />
      ) : pending ? (
        <div className="flex flex-col gap-2 rounded-sm bg-error-soft p-3">
          <p className="type-body text-ink">{t(pending.scope === "LISTING" ? "pendingListing" : "pendingProduct")}</p>
          <Countdown r={pending} />
          <CancelButton shopId={shopId} r={pending} />
        </div>
      ) : !open ? (
        <>
          <p className="type-caption text-ink-muted">{t("boxText")}</p>
          <button type="button" onClick={() => { send.reset(); setOpen(true); }} className={cn(outline, "border-error text-error hover:bg-error-soft")}>
            <Trash2 className="size-4" aria-hidden />
            {t("request")}
          </button>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); send.mutate(); }} className="flex flex-col gap-2 rounded-sm bg-error-soft p-3">
          <p className="type-body text-ink">{t("confirmText")}</p>
          <label htmlFor={`${uid}-reason`} className="type-body-medium text-ink">{t("reasonLabel")}</label>
          <textarea id={`${uid}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} className="type-body w-full rounded-sm border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none" />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={send.isPending} className={danger}>{send.isPending ? t("sending") : t("send")}</button>
            <button type="button" onClick={() => setOpen(false)} disabled={send.isPending} className="type-body-medium h-11 rounded-sm px-4 text-ink-secondary hover:bg-card">{t("keep")}</button>
          </div>
        </form>
      )}
      {send.isError && <p role="alert" className="type-body text-error">{errorText(send.error)}</p>}
    </section>
  );
}

/** On the listings page (shop owner only): waiting and recent deletion requests. Hidden when there are none. */
export function DeletionRequestsSummary({ shopId }: { shopId: string }) {
  const t = useTranslations("OwnerDeletion");
  const requests = useRequests(shopId);
  const list = (requests.data ?? []).slice(0, 10);
  if (requests.isError) return <p role="alert" className="type-body text-ink-secondary">{t("loadError")}</p>;
  if (list.length === 0) return null;

  return (
    <section aria-labelledby="deletion-summary" className="flex flex-col gap-2 rounded-md border border-line bg-card p-4 shadow-card">
      <h2 id="deletion-summary" className="type-h3 text-ink">{t("summaryTitle")}</h2>
      <ul className="flex flex-col divide-y divide-line">
        {list.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="type-body-medium text-ink">{r.productTitle}</span>
                <span className="type-caption rounded-full bg-highlight-soft px-2 py-0.5 text-highlight">{t(`scope.${r.scope}`)}</span>
                <span className="type-caption rounded-full bg-subtle px-2 py-0.5 text-ink-secondary">
                  {r.status === "DONE" && r.outcome ? t(`outcome.${r.outcome}`) : t(`status.${r.status}`)}
                </span>
              </span>
              {r.status === "PENDING" && <Countdown r={r} />}
              {r.status === "REJECTED" && r.rejectNote && <span className="type-caption text-ink-secondary">{t("rejectNote", { note: r.rejectNote })}</span>}
            </span>
            {r.status === "PENDING" && <CancelButton shopId={shopId} r={r} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
