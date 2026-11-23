"use client";

import { useMutation } from "@tanstack/react-query";
import { Flag, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { useSession } from "@/components/app-providers";
import { ApiError } from "@/lib/api/core";
import { FLAG_REASONS, reportContent, type FlagReason, type FlagTarget } from "@/lib/api/moderation";
import { cn } from "@/lib/utils";

/** Small "Report" button (opens a short form below it) for a review, a review photo or a chat message (logged-in users only). */
export function ReportButton({ targetType, targetId, className }: { targetType: FlagTarget; targetId: string; className?: string }) {
  const t = useTranslations("Report");
  const id = useId();
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FlagReason>("SPAM");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sent" | string>("idle");

  const send = useMutation({
    mutationFn: () => reportContent({ targetType, targetId, reason, ...(note.trim() && { note: note.trim() }) }),
    onSuccess: () => setState("sent"),
    onError: (err) =>
      setState(err instanceof ApiError && err.status === 429 ? t("tooMany") : err instanceof ApiError && err.status === 0 ? t("network") : t("error")),
  });

  if (status !== "authenticated") return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    send.mutate();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t("label")}
        className={cn(
          "type-caption inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 text-ink-muted hover:bg-subtle hover:text-error focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
          className,
        )}
      >
        <Flag className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">{t("short")}</span>
      </button>
      {open && (
      <div className="w-72 max-w-full rounded-md border border-line bg-card p-3 shadow-card">
        {state === "sent" ? (
          <p role="status" className="type-body text-success-ink">{t("thanks")}</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <p className="type-body-medium text-ink">{t("title")}</p>
            <label htmlFor={`${id}-r`} className="sr-only">{t("reasonLabel")}</label>
            <select id={`${id}-r`} value={reason} onChange={(e) => setReason(e.target.value as FlagReason)} className="type-body h-11 rounded-sm border border-input bg-card px-3 text-ink focus:border-brand focus:outline-none">
              {FLAG_REASONS.map((r) => (
                <option key={r} value={r}>{t(`reasons.${r}`)}</option>
              ))}
            </select>
            <label htmlFor={`${id}-n`} className="type-caption text-ink-secondary">{t("noteLabel")}</label>
            <textarea id={`${id}-n`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className="type-body rounded-sm border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:outline-none" />
            {state !== "idle" && <p role="alert" className="type-caption text-error">{state}</p>}
            <button type="submit" disabled={send.isPending} className="type-body-medium inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60">
              {send.isPending && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
              {t("send")}
            </button>
          </form>
        )}
      </div>
      )}
    </div>
  );
}
