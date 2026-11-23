"use client";

import { useMutation } from "@tanstack/react-query";
import { MessageSquareText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/app-providers";
import { updateProfile } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/core";
import { cn } from "@/lib/utils";

/** Order status SMS / WhatsApp on or off (sent when the shop confirms, readies, sends out or completes an order). */
export function SmsPreference() {
  const t = useTranslations("SmsPref");
  const { user } = useSession();
  const [on, setOn] = useState(!(user?.smsOptOut ?? false));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = useMutation({
    mutationFn: (next: boolean) => updateProfile({ smsOptOut: !next }),
    onMutate: (next) => {
      setOn(next); // switch at once
      setMessage(null);
    },
    onSuccess: (_, next) => setMessage({ ok: true, text: next ? t("onSaved") : t("offSaved") }),
    onError: (err, next) => {
      setOn(!next); // put it back
      setMessage({ ok: false, text: err instanceof ApiError && err.status === 0 ? t("network") : t("error") });
    },
  });

  return (
    <section className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="sms-pref" className="type-h3 flex items-center gap-2 text-ink">
            <MessageSquareText className="size-5 text-highlight" aria-hidden />
            {t("title")}
          </h2>
          <p className="type-body text-ink-secondary">{t("text")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="sms-pref"
          disabled={save.isPending}
          onClick={() => save.mutate(!on)}
          className="flex h-11 w-16 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60"
        >
          <span className={cn("relative h-7 w-12 rounded-full transition-colors", on ? "bg-brand" : "bg-line-strong")}>
            <span className={cn("absolute top-1 left-1 size-5 rounded-full bg-card shadow-card motion-safe:transition-transform motion-safe:duration-200", on && "translate-x-5")} />
          </span>
        </button>
      </div>
      <p className="type-caption text-ink-muted">{t("note")}</p>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={cn("type-caption", message.ok ? "text-success-ink" : "text-error")}>
          {message.text}
        </p>
      )}
    </section>
  );
}
