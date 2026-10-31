"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, LoaderCircle, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { TextField } from "@/components/ui/text-field";
import { Link } from "@/i18n/routing";
import { forgotPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/core";

type Translate = (key: string) => string;

function createForgotSchema(tAuth: Translate) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, { error: tAuth("emailRequired") })
      .max(254, { error: tAuth("emailInvalid") })
      .pipe(z.email({ error: tAuth("emailInvalid") })),
  });
}

type ForgotValues = z.infer<ReturnType<typeof createForgotSchema>>;

function errorKey(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return "errors.tooManyAttempts";
    if (err.status === 0) return "errors.network";
    if (err.status === 400) return "errors.checkFields";
  }
  return "errors.generic";
}

const linkClass =
  "type-body-medium rounded-sm text-brand underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none";

export function ForgotForm() {
  const t = useTranslations("Forgot");
  const tAuth = useTranslations("Auth");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);

  const schema = useMemo(() => createForgotSchema(tAuth), [tAuth]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
    mode: "onTouched",
  });

  // Move focus to the confirmation so screen readers announce it.
  useEffect(() => {
    if (sentTo) sentHeading.current?.focus();
  }, [sentTo]);

  async function onSubmit(values: ForgotValues) {
    setFormError(null);
    try {
      await forgotPassword(values.email);
      // The backend answers the same for every email; so do we.
      setSentTo(values.email);
    } catch (err) {
      setFormError(tAuth(errorKey(err)));
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-card p-6 text-center">
          <MailCheck className="size-8 text-success-ink" aria-hidden />
          <h2 ref={sentHeading} tabIndex={-1} className="type-h3 text-ink focus:outline-none">
            {t("sentTitle")}
          </h2>
          <p className="type-body text-ink-secondary">{t("sentText", { email: sentTo })}</p>
          <p className="type-caption text-ink-muted">{t("sentHint")}</p>
        </div>
        <div className="type-body flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => {
              reset();
              setSentTo(null);
            }}
            className={linkClass}
          >
            {t("tryAgain")}
          </button>
          <Link href="/auth/login" className={linkClass}>
            {t("backToLogin")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {formError && (
        <div role="alert" className="type-body flex gap-2 rounded-md border border-error/30 bg-error-soft p-3 text-error">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>{formError}</p>
        </div>
      )}

      <TextField
        label={tAuth("email")}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={tAuth("emailPlaceholder")}
        error={errors.email?.message}
        {...register("email")}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="type-body-medium flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-action text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-80"
      >
        {isSubmitting && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
        {isSubmitting ? t("sending") : t("sendButton")}
      </button>

      <p className="type-body border-t border-line pt-5 text-center">
        <Link href="/auth/login" className={linkClass}>
          {t("backToLogin")}
        </Link>
      </p>
    </form>
  );
}