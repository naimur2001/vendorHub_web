"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleCheck, LoaderCircle, Lock, UserRound, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useSyncExternalStore, type FormEvent } from "react";
import { useSession } from "@/components/app-providers";
import { refreshSession, updateProfile } from "@/lib/api/auth";
import { ApiError, type Gender } from "@/lib/api/core";
import { cn } from "@/lib/utils";

const GENDERS: Gender[] = ["FEMALE", "MALE", "OTHER", "PREFER_NOT_TO_SAY"];
const MIN_AGE = 13;
const MAX_AGE = 100;

// The current year, read only in the browser (no clock while prerendering).
const noop = () => () => {};
const thisYear = () => new Date().getFullYear();
const noYear = () => null;

type Props = { variant?: "section" | "prompt" };

/**
 * Optional, private "About you": birth year and gender. Only the user sees them; admins only get
 * anonymous totals. variant="prompt" is a one-time card on the account page that hides once filled or dismissed.
 */
export function AboutYou({ variant = "section" }: Props) {
  const t = useTranslations("AboutYou");
  const id = useId();
  const { user } = useSession();
  const year = useSyncExternalStore(noop, thisYear, noYear);
  const [birthYear, setBirthYear] = useState(user?.birthYear ? String(user.birthYear) : "");
  const [gender, setGender] = useState<Gender | "">(user?.gender ?? "");
  const [dismissed, setDismissed] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = useMutation({
    mutationFn: () => updateProfile({ birthYear: birthYear ? Number(birthYear) : null, gender: gender || null }),
    onMutate: () => setMessage(null),
    onSuccess: () => {
      setMessage({ ok: true, text: t("saved") });
      void refreshSession().catch(() => undefined); // the session user gets the new values
    },
    onError: (err) => {
      const code = err instanceof ApiError ? (err.details as { code?: string } | undefined)?.code : undefined;
      setMessage({ ok: false, text: code === "TOO_YOUNG" ? t("tooYoung", { age: MIN_AGE }) : err instanceof ApiError && err.status === 0 ? t("network") : t("error") });
    },
  });

  if (!user || user.role !== "CUSTOMER" || year === null) return null;
  // The prompt shows only while both are empty and it wasn't closed
  if (variant === "prompt" && (dismissed || user.birthYear || user.gender || (message?.ok ?? false))) {
    return message?.ok && !dismissed ? (
      <p role="status" className="type-body flex items-center gap-2 text-success-ink">
        <CircleCheck className="size-4" aria-hidden />
        {t("thanks")}
      </p>
    ) : null;
  }

  const years = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => year - MIN_AGE - i);

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <form
      onSubmit={submit}
      aria-labelledby={`${id}-t`}
      className={cn("flex flex-col gap-4 rounded-md border bg-card p-4 shadow-card md:p-5", variant === "prompt" ? "border-gold" : "border-line")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={`${id}-t`} className="type-h3 flex items-center gap-2 text-ink">
            <UserRound className="size-5 text-highlight" aria-hidden />
            {variant === "prompt" ? t("promptTitle") : t("title")}
          </h2>
          <p className="type-body text-ink-secondary">{t("text")}</p>
        </div>
        {variant === "prompt" && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label={t("dismiss")}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-y`} className="type-body-medium text-ink">{t("birthYear")}</label>
          <select id={`${id}-y`} value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className="type-body h-11 rounded-sm border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none">
            <option value="">{t("notSaying")}</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="type-body-medium mb-1.5 text-ink">{t("gender")}</legend>
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((g) => (
              <label
                key={g}
                className={cn(
                  "type-body flex h-11 cursor-pointer items-center rounded-full border px-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand",
                  gender === g ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand",
                )}
              >
                <input type="radio" name={`${id}-g`} value={g} checked={gender === g} onChange={() => setGender(g)} className="sr-only" />
                {t(`genders.${g}`)}
              </label>
            ))}
          </div>
        </fieldset>
      </fieldset>

      <p className="type-caption flex items-start gap-1.5 text-ink-muted">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t("privacy")}
      </p>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={cn("type-caption", message.ok ? "text-success-ink" : "text-error")}>{message.text}</p>
      )}
      <button type="submit" disabled={save.isPending} className="type-body-medium inline-flex h-11 items-center justify-center gap-2 self-start rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60">
        {save.isPending && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
        {t("save")}
      </button>
    </form>
  );
}
