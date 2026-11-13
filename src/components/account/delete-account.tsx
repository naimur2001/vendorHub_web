"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { useSession } from "@/components/app-providers";
import { TextField } from "@/components/ui/text-field";
import { blockersOf, requestDeletion, type Blocker } from "@/lib/api/account-deletion";
import { updateSessionUser } from "@/lib/api/client";
import { ApiError } from "@/lib/api/core";

const KNOWN = ["OPEN_ORDERS", "OPEN_RETURNS", "SHOP_OPEN_ORDERS", "SHOP_OPEN_RETURNS"];

/** Profile → "Delete my account": disables now, deleted after the grace period. */
export function DeleteAccount({ graceDays = 30 }: { graceDays?: number }) {
  const t = useTranslations("Deletion");
  const { user } = useSession();
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<Blocker[] | null>(null);

  const del = useMutation({
    mutationFn: () => requestDeletion(password, reason.trim() || undefined),
    onSuccess: (r) => {
      setPassword("");
      // Opens the full-page notice right away (with "Cancel deletion").
      if (user) updateSessionUser({ ...user, deletionScheduledFor: r.deletionScheduledFor });
    },
    onError: (err) => {
      const b = blockersOf(err);
      if (b) return setBlockers(b);
      const s = err instanceof ApiError ? err.status : 0;
      setError(t(s === 400 || s === 401 ? "errors.wrongPassword" : s === 403 ? "errors.admin" : "errors.generic"));
    },
  });

  if (!user || user.role === "ADMIN") return null;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBlockers(null);
    if (!password) return setError(t("errors.password"));
    if (reason.length > 300) return setError(t("errors.reason"));
    if (!confirmed) return setError(t("errors.confirm"));
    del.mutate();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-md border border-error/40 bg-card p-4 shadow-card md:p-5">
      <h2 className="type-h3 text-error">{t("sectionTitle")}</h2>
      <p className="type-body text-ink-secondary">{t("sectionText", { days: graceDays })}</p>
      <label className="flex flex-col gap-1.5">
        <span className="type-body-medium text-ink">{t("reason")}</span>
        <textarea rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} className="type-body w-full rounded-md border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none" />
      </label>
      <TextField label={t("password")} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-5 accent-brand" />
        <span className="type-body text-ink">{t("confirm")}</span>
      </label>

      {blockers && (
        <div role="alert" className="flex flex-col gap-1 rounded-md bg-highlight-soft p-3">
          <p className="type-body-medium text-ink">{t("blockersTitle")}</p>
          <ul className="type-body list-disc pl-5 text-ink">
            {blockers.map((b, i) => <li key={i}>{KNOWN.includes(b.code) ? t(`blocker.${b.code}`, { count: b.count }) : b.text}</li>)}
          </ul>
        </div>
      )}
      {error && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <button type="submit" disabled={del.isPending} className="type-body-medium flex h-12 items-center justify-center gap-2 self-start rounded-sm bg-error px-6 text-primary-foreground hover:opacity-90 disabled:opacity-60">
        {del.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
        {del.isPending ? t("deleting") : t("button")}
      </button>
    </form>
  );
}