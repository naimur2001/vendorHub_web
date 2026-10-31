"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useSession } from "@/components/app-providers";
import { TextField } from "@/components/ui/text-field";
import { Link, useRouter } from "@/i18n/routing";
import { login } from "@/lib/api/auth";
import { ApiError, type SessionUser } from "@/lib/api/core";
import { safeRedirectPath } from "@/lib/security";

type Translate = (key: string) => string;

function createLoginSchema(t: Translate) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, { error: t("emailRequired") })
      .max(254, { error: t("emailInvalid") })
      .pipe(z.email({ error: t("emailInvalid") })),
    password: z
      .string()
      .min(1, { error: t("passwordRequired") })
      .max(200, { error: t("passwordTooLong") }),
  });
}

type LoginValues = z.infer<ReturnType<typeof createLoginSchema>>;

// Fixed, friendly messages only: never show raw server errors.
function errorKey(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "errors.invalidCredentials";
    if (err.status === 429) return "errors.tooManyAttempts";
    if (err.status === 0) return "errors.network";
    if (err.status === 400) return "errors.checkFields";
  }
  return "errors.generic";
}

// Where a user goes when no ?next= page was given.
function homeFor(user: SessionUser | null): string {
  // Shop owners: /owner leads to the setup now and to the dashboard later.
  return user?.role === "SHOP_OWNER" ? "/owner" : "/";
}

export function LoginForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, user } = useSession();
  const [formError, setFormError] = useState<string | null>(null);

  // An explicit ?next= page wins (only same-site paths, never back into /auth).
  const nextParam = searchParams.get("next");
  const explicitNext = useMemo(() => {
    if (!nextParam) return null;
    const path = safeRedirectPath(nextParam);
    return path.startsWith("/auth") ? null : path;
  }, [nextParam]);

  const schema = useMemo(() => createLoginSchema(t), [t]);
  const {
    register,
    handleSubmit,
    resetField,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });

  // Already logged in (e.g. opened /auth/login from a bookmark): go on.
  useEffect(() => {
    if (status === "authenticated") router.replace(explicitNext ?? homeFor(user));
  }, [status, user, router, explicitNext]);

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      const loggedIn = await login({ email: values.email, password: values.password });
      router.replace(explicitNext ?? homeFor(loggedIn));
    } catch (err) {
      setFormError(t(errorKey(err)));
      resetField("password");
      setFocus("password");
    }
  }

  const registerHref = explicitNext ? `/auth/register?next=${encodeURIComponent(explicitNext)}` : "/auth/register";

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {formError && (
        <div role="alert" className="type-body flex gap-2 rounded-md border border-error/30 bg-error-soft p-3 text-error">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>{formError}</p>
        </div>
      )}

      <TextField
        label={t("email")}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={t("emailPlaceholder")}
        error={errors.email?.message}
        {...register("email")}
      />

      <div className="flex flex-col gap-2">
        <TextField
          label={t("password")}
          type="password"
          autoComplete="current-password"
          showPasswordLabel={t("showPassword")}
          hidePasswordLabel={t("hidePassword")}
          error={errors.password?.message}
          {...register("password")}
        />
        <Link
          href="/auth/forgot-password"
          className="type-body-medium self-end rounded-sm text-brand underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          {t("forgotPassword")}
        </Link>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="type-body-medium flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-action text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-80"
      >
        {isSubmitting && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
        {isSubmitting ? t("loggingIn") : t("loginButton")}
      </button>

      <p className="type-body border-t border-line pt-5 text-center text-ink-secondary">
        {t("noAccount")}{" "}
        <Link
          href={registerHref}
          className="type-body-medium rounded-sm text-brand underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          {t("createAccount")}
        </Link>
      </p>
    </form>
  );
}