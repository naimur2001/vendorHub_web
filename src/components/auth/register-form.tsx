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

type Translate = (key: string) => string;
type AccountRole = "CUSTOMER" | "SHOP_OWNER";

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** "+880 1712-345678", "০১৭১২৩৪৫৬৭৮" -> "01712345678" (the format the backend expects). */
export function normalizePhone(value: string): string {
  let v = value.trim().replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));
  v = v.replace(/[\s\-().]/g, "");
  if (v.startsWith("+880")) v = `0${v.slice(4)}`;
  else if (v.startsWith("880") && v.length === 13) v = `0${v.slice(3)}`;
  return v;
}

const BD_MOBILE = /^01\d{9}$/;

// Same limits as the backend's registerSchema; the password rule is a bit stricter on purpose.
function createRegisterSchema(t: Translate, tAuth: Translate, phoneRequired: boolean) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, { error: t("nameRequired") })
      .min(2, { error: t("nameShort") })
      .max(80, { error: t("nameLong") }),
    email: z
      .string()
      .trim()
      .min(1, { error: tAuth("emailRequired") })
      .max(254, { error: tAuth("emailInvalid") })
      .pipe(z.email({ error: tAuth("emailInvalid") })),
    phone: z
      .string()
      .max(25, { error: t("phoneInvalid") })
      .refine((v) => !phoneRequired || normalizePhone(v) !== "", { error: t("phoneRequired") })
      .refine(
        (v) => {
          const n = normalizePhone(v);
          return n === "" || BD_MOBILE.test(n);
        },
        { error: t("phoneInvalid") },
      ),
    password: z
      .string()
      .min(8, { error: t("passwordShort") })
      // bcrypt uses only the first 72 bytes; Bangla letters and emoji take several bytes each
      .refine((v) => new TextEncoder().encode(v).length <= 72, { error: t("passwordLong") })
      .refine((v) => /\p{L}/u.test(v) && /\p{N}/u.test(v), { error: t("passwordWeak") }),
  });
}

type RegisterValues = z.infer<ReturnType<typeof createRegisterSchema>>;

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

  const schema = useMemo(() => createRegisterSchema(t, tAuth, isOwner), [t, tAuth, isOwner]);
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
    const phone = normalizePhone(values.phone);
    try {
      await registerAccount({
        name: values.name,
        email: values.email,
        password: values.password,
        role,
        ...(phone ? { phone } : {}), // the backend wants no phone field at all when empty
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
        label={isOwner ? t("phone") : t("phoneOptional")}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={t("phonePlaceholder")}
        hint={t("phoneHint")}
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