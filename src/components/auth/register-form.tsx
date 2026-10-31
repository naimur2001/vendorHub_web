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
import { register as registerAccount } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/core";
import { safeRedirectPath } from "@/lib/security";
import { emailField, newPasswordField, normalizePhone, phoneField } from "@/lib/validation";

type Translate = (key: string) => string;
type AccountRole = "CUSTOMER" | "SHOP_OWNER";

function createRegisterSchema(t: Translate, tAuth: Translate) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, { error: t("nameRequired") })
      .min(2, { error: t("nameShort") })
      .max(80, { error: t("nameLong") }),
    email: emailField({ required: tAuth("emailRequired"), invalid: tAuth("emailInvalid") }),
    phone: phoneField({ required: t("phoneRequired"), invalid: t("phoneInvalid") }),
    password: newPasswordField({ short: t("passwordShort"), long: t("passwordLong"), weak: t("passwordWeak") }),
  });
}

type RegisterValues = z.infer<ReturnType<typeof createRegisterSchema>>;

// Neutral texts only: the screen never says whether an email or phone is already registered.
function errorMessage(err: unknown, t: Translate, tAuth: Translate): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return t("errors.alreadyRegistered");
    if (err.status === 429) return t("errors.tooManyAttempts");
    if (err.status === 0) return tAuth("errors.network");
    if (err.status === 400) return tAuth("errors.checkFields");
  }
  return tAuth("errors.generic");
}

const linkClass =
  "type-body-medium rounded-sm text-brand underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none";

export function RegisterForm({ role }: { role: AccountRole }) {
  const t = useTranslations("Register");
  const tAuth = useTranslations("Auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [formError, setFormError] = useState<string | null>(null);

  const isOwner = role === "SHOP_OWNER";

  const nextParam = searchParams.get("next");
  const target = useMemo(() => {
    const path = safeRedirectPath(nextParam);
    return path.startsWith("/auth") ? "/" : path;
  }, [nextParam]);

  const schema = useMemo(() => createRegisterSchema(t, tAuth), [t, tAuth]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", password: "" },
    mode: "onTouched",
  });

  // Already logged in: nothing to register.
  useEffect(() => {
    if (status === "authenticated") router.replace(target);
  }, [status, router, target]);

  async function onSubmit(values: RegisterValues) {
    setFormError(null);
    try {
      await registerAccount({
        name: values.name,
        email: values.email,
        phone: normalizePhone(values.phone),
        password: values.password,
        role,
      });
      // Shop owners will go to "set up your shop" once the owner area exists.
      router.replace(target);
    } catch (err) {
      setFormError(errorMessage(err, t, tAuth));
    }
  }

  const keepNext = nextParam ? `?next=${encodeURIComponent(target)}` : "";

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {formError && (
        <div role="alert" className="type-body flex gap-2 rounded-md border border-error/30 bg-error-soft p-3 text-error">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>{formError}</p>
        </div>
      )}

      <TextField
        label={t("name")}
        autoComplete="name"
        autoCapitalize="words"
        placeholder={t("namePlaceholder")}
        maxLength={80}
        error={errors.name?.message}
        {...register("name")}
      />

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

      <TextField
        label={t("phone")}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={t("phonePlaceholder")}
        hint={isOwner ? t("phoneHintOwner") : t("phoneHint")}
        maxLength={25}
        error={errors.phone?.message}
        {...register("phone")}
      />

      <TextField
        label={tAuth("password")}
        type="password"
        autoComplete="new-password"
        hint={t("passwordHint")}
        showPasswordLabel={tAuth("showPassword")}
        hidePasswordLabel={tAuth("hidePassword")}
        error={errors.password?.message}
        {...register("password")}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="type-body-medium flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-action text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-80"
      >
        {isSubmitting && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
        {isSubmitting ? t("creating") : isOwner ? t("shopButton") : t("createButton")}
      </button>

      <div className="type-body flex flex-col gap-2 border-t border-line pt-5 text-center text-ink-secondary">
        <p>
          {t("haveAccount")}{" "}
          <Link href={`/auth/login${keepNext}`} className={linkClass}>
            {t("logIn")}
          </Link>
        </p>
        {isOwner ? (
          <p>
            {t("justShop")}{" "}
            <Link href={`/auth/register${keepNext}`} className={linkClass}>
              {t("customerAccount")}
            </Link>
          </p>
        ) : (
          <p>
            {t("ownShop")}{" "}
            <Link href="/auth/register/shop" className={linkClass}>
              {t("registerShop")}
            </Link>
          </p>
        )}
      </div>
    </form>
  );
}