"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { confirmToLetEmail, TOKEN } from "@/lib/api/to-let";

/** /to-let/confirm?token=…: confirms the owner's email once, then the team reviews the listing. */
export function ConfirmToLetEmail() {
  const t = useTranslations("ToLetManage");
  const searchParams = useSearchParams();
  const raw = searchParams.get("token");
  const token = raw && TOKEN.test(raw) ? raw : null;
  const confirm = useMutation({ mutationFn: (tk: string) => confirmToLetEmail(tk) });
  const started = useRef(false);

  useEffect(() => {
    if (token && !started.current) {
      started.current = true; // once, even in Strict Mode
      confirm.mutate(token);
    }
  }, [token, confirm]);

  const box = "flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center";
  if (!token || confirm.isError) {
    return (
      <div role="alert" className={box}>
        <CircleAlert className="size-10 text-error" aria-hidden />
        <p className="type-body text-ink-secondary">{t("confirmFailed")}</p>
      </div>
    );
  }
  if (confirm.isSuccess) {
    return (
      <div role="status" className={box}>
        <CircleCheck className="size-10 text-success-ink" aria-hidden />
        <p className="type-h3 text-ink">{t("confirmedTitle")}</p>
        <p className="type-body max-w-md text-ink-secondary">{t("confirmedText")}</p>
      </div>
    );
  }
  return (
    <p role="status" className="type-body flex items-center justify-center gap-2 py-12 text-ink-secondary">
      <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden />
      {t("confirming")}
    </p>
  );
}
