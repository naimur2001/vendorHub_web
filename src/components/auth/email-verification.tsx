"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, LoaderCircle, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useSession } from "@/components/app-providers";
import { Link } from "@/i18n/routing";
import { refreshSession, resendVerification, verifyEmail } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/core";

function useResend() {
  return useMutation({ mutationFn: resendVerification });
}

function ResendMessage({ resend }: { resend: ReturnType<typeof useResend> }) {
  const t = useTranslations("Verify");
  if (resend.isSuccess) return <p role="status" className="type-body text-success-ink">{t("resent")}</p>;
  if (resend.isError) {
    const limited = resend.error instanceof ApiError && resend.error.status === 429;
    return <p role="alert" className="type-body text-error">{limited ? t("rateLimit") : t("error")}</p>;
  }
  return null;
}

/** /auth/verify-email: removes the token from the address bar, verifies it once, shows the result. */
export function VerifyEmailView({ token }: { token: string | null }) {
  const t = useTranslations("Verify");
  const { status } = useSession();
  const resend = useResend();
  const started = useRef(false);

  const verify = useMutation({
    mutationFn: verifyEmail,
    onSuccess: () => {
      void refreshSession().catch(() => null); // the logged-in user now shows as verified
    },
  });
  const { mutate } = verify;

  useEffect(() => {
    // The token must not stay in the address bar or browser history.
    window.history.replaceState(null, "", window.location.pathname);
    if (token && !started.current) {
      started.current = true;
      mutate(token);
    }
  }, [token, mutate]);

  const panel = "mx-auto flex max-w-md flex-col items-center gap-4 rounded-md border border-line bg-card px-6 py-10 text-center";

  if (verify.isSuccess) {
    return (
      <div className={panel}>
        <MailCheck className="size-12 text-success-ink" strokeWidth={1.5} aria-hidden />
        <h1 className="type-h2 text-ink">{t("successTitle")}</h1>
        <p className="type-body text-ink-secondary">{t("successText")}</p>
        <Link href="/" className="type-body-medium flex h-12 items-center rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover">{t("continue")}</Link>
      </div>
    );
  }

  if (token && !verify.isError) {
    return (
      <p role="status" className="type-body flex items-center justify-center gap-2 py-16 text-ink-secondary">
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
        {t("verifying")}
      </p>
    );
  }

  // No token, or the link is invalid / expired / used.
  return (
    <div className={panel}>
      <CircleAlert className="size-12 text-error" strokeWidth={1.5} aria-hidden />
      <h1 className="type-h2 text-ink">{t("invalidTitle")}</h1>
      <p className="type-body text-ink-secondary">{t("invalidText")}</p>
      {status === "authenticated" ? (
        <button type="button" onClick={() => resend.mutate()} disabled={resend.isPending || resend.isSuccess} className="type-body-medium flex h-12 items-center gap-2 rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover disabled:opacity-60">
          {resend.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {resend.isPending ? t("resending") : t("resend")}
        </button>
      ) : (
        <>
          <p className="type-body text-ink-secondary">{t("loginForNew")}</p>
          <Link href={`/auth/login?next=${encodeURIComponent("/")}`} className="type-body-medium flex h-12 items-center rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover">{t("logIn")}</Link>
        </>
      )}
      <ResendMessage resend={resend} />
    </div>
  );
}

/** Under the top bar, for logged-in users who haven't verified their email yet. */
export function VerifyBanner() {
  const t = useTranslations("Verify");
  const { status, user } = useSession();
  const resend = useResend();

  if (status !== "authenticated" || user?.emailVerified !== false) return null;

  return (
    <div className="border-b border-highlight/40 bg-highlight-soft">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between md:px-10">
        <p className="type-body flex items-start gap-2 text-ink">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
          {t("bannerText")}
        </p>
        <div className="flex items-center gap-3">
          {resend.isSuccess ? (
            <span className="type-body flex items-center gap-1 text-success-ink">
              <CircleCheck className="size-4" aria-hidden />
              {t("resent")}
            </span>
          ) : (
            <button type="button" onClick={() => resend.mutate()} disabled={resend.isPending} className="type-body-medium flex h-9 shrink-0 items-center gap-2 rounded-sm border border-highlight px-3 text-highlight hover:bg-card disabled:opacity-60">
              {resend.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {t("bannerResend")}
            </button>
          )}
          {resend.isError && <ResendMessage resend={resend} />}
        </div>
      </div>
    </div>
  );
}