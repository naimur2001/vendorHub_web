"use client";

import { useMutation } from "@tanstack/react-query";
import { CalendarClock, LoaderCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useSession } from "@/components/app-providers";
import { useRouter } from "@/i18n/routing";
import { cancelDeletion } from "@/lib/api/account-deletion";
import { logout, refreshSession } from "@/lib/api/auth";
import { DELETION_EVENT } from "@/lib/api/deletion-signal";

/** Full-page notice while the account is scheduled for deletion (from the session, or from any 403). */
export function DeletionGate() {
  const t = useTranslations("Deletion");
  const format = useFormatter();
  const router = useRouter();
  const { status, user } = useSession();
  const [signalled, setSignalled] = useState<{ date: string | null } | null>(null);

  useEffect(() => {
    const on = (e: Event) => setSignalled({ date: (e as CustomEvent<string | null>).detail });
    window.addEventListener(DELETION_EVENT, on);
    return () => window.removeEventListener(DELETION_EVENT, on);
  }, []);

  const cancel = useMutation({
    mutationFn: cancelDeletion,
    onSuccess: async () => {
      setSignalled(null);
      await refreshSession().catch(() => null); // the session user no longer carries the date
    },
  });

  const date = user?.deletionScheduledFor ?? signalled?.date ?? null;
  const pending = status === "authenticated" && (Boolean(user?.deletionScheduledFor) || signalled !== null);
  if (!pending) return null;

  const when = date && !Number.isNaN(Date.parse(date)) ? format.dateTime(new Date(date), { day: "numeric", month: "long", year: "numeric" }) : "—";

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="deletion-title" className="fixed inset-0 z-90 flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-md border border-line bg-card p-6 text-center shadow-card">
        <CalendarClock className="size-12 text-error" strokeWidth={1.5} aria-hidden />
        <h1 id="deletion-title" className="type-h2 text-ink">{t("pendingTitle")}</h1>
        <p className="type-body text-ink-secondary">{t("pendingText", { date: when })}</p>
        <button type="button" onClick={() => cancel.mutate()} disabled={cancel.isPending} className="type-body-medium flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover disabled:opacity-60">
          {cancel.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {cancel.isPending ? t("cancelling") : t("cancel")}
        </button>
        <button
          type="button"
          onClick={async () => { await logout().catch(() => null); setSignalled(null); router.replace("/"); }}
          className="type-body-medium h-11 w-full rounded-sm border border-brand text-brand hover:bg-subtle"
        >
          {t("logOut")}
        </button>
        {cancel.isError && <p role="alert" className="type-body text-error">{t("cancelError")}</p>}
      </div>
    </div>
  );
}