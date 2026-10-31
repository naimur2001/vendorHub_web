"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, CircleCheck, LinkIcon, LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { TextField } from "@/components/ui/text-field";
import { Link } from "@/i18n/routing";
import { resetPassword } from "@/lib/api/auth";
import { setSession } from "@/lib/api/client";
import { ApiError } from "@/lib/api/core";
import { newPasswordField } from "@/lib/validation";

type Translate = (key: string) => string;
type Stage = "form" | "done" | "invalid";

// The backend issues 96 hex characters and accepts 20-200; anything else is a broken link.
const TOKEN_FORMAT = /^[A-Za-z0-9]{20,200}$/;

function createResetSchema(tReg: Translate) {
  return z.object({
    newPassword: newPasswordField({
      short: tReg("passwordShort"),
      long: tReg("passwordLong"),
      weak: tReg("passwordWeak"),
    }),
  });
}

type ResetValues = z.infer<ReturnType<typeof createResetSchema>>;

const buttonClass =
  "type-body-medium flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-action text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-80";

export function ResetForm() {
  const t = useTranslations("Reset");
  const tReg = useTranslations("Register");
  const tAuth = useTranslations("Auth");
  const searchParams = useSearchParams();

  // Read the token once and keep it in memory only.
  const [token] = useState(() => searchParams.get("token"));
  const [stage, setStage] = useState<Stage>(() => (token && TOKEN_FORMAT.test(token) ? "form" : "invalid"));
  const [formError, setFormError] = useState<string | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  // Remove the token from the address bar (history, screenshots, shoulder surfing).
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  // Announce the result to screen readers.
  useEffect(() => {
    if (stage !== "form") resultHeading.current?.focus();
  }, [stage]);

  const schema = useMemo(() => createResetSchema(tReg), [tReg]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "" },
    mode: "onTouched",
  });

  async function onSubmit(values: ResetValues) {
    if (!token) return;
    setFormError(null);
    try {
      await resetPassword({ token, newPassword: values.newPassword });
      // The backend has logged out every device; forget any session in this tab too.
      setSession(null);
      setStage("done");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && !err.details) {
        setStage("invalid"); // used, expired or unknown link
      } else if (err instanceof ApiError && err.status === 400) {
        setFormError(tAuth("errors.checkFields"));
      } else if (err instanceof ApiError && err.status === 429) {
        setFormError(tAuth("errors.tooManyAttempts"));
      } else if (err instanceof ApiError && err.status === 0) {
        setFormError(tAuth("errors.network"));
      } else {
        setFormError(tAuth("errors.generic"));
      }
    }
  }

  if (stage === "done") {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-card p-6 text-center">
          <CircleCheck className="size-8 text-success-ink" aria-hidden />
          <h2 ref={resultHeading} tabIndex={-1} className="type-h3 text-ink focus:outline-none">
            {t("doneTitle")}
          </h2>
          <p className="type-body text-ink-secondary">{t("doneText")}</p>
        </div>
        <Link href="/auth/login" className={buttonClass}>
          {t("logIn")}
        </Link>
      </div>
    );
  }

  if (stage === "invalid") {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-card p-6 text-center">
          <LinkIcon className="size-8 text-highlight" aria-hidden />
          <h2 ref={resultHeading} tabIndex={-1} className="type-h3 text-ink focus:outline-none">
            {t("invalidTitle")}
          </h2>
          <p className="type-body text-ink-secondary">{t("invalidText")}</p>
        </div>
        <Link href="/auth/forgot-password" className={buttonClass}>
          {t("newLink")}
        </Link>
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
        label={t("newPassword")}
        type="password"
        autoComplete="new-password"
        hint={tReg("passwordHint")}
        showPasswordLabel={tAuth("showPassword")}
        hidePasswordLabel={tAuth("hidePassword")}
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />

      <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className={buttonClass}>
        {isSubmitting && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
        {isSubmitting ? t("saving") : t("saveButton")}
      </button>
    </form>
  );
}