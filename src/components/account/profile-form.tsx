"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { useSession } from "@/components/app-providers";
import { TextField } from "@/components/ui/text-field";
import { Link } from "@/i18n/routing";
import { changePassword, refreshSession, updateProfile } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/core";
import { cn } from "@/lib/utils";
import { BD_MOBILE, normalizePhone } from "@/lib/validation";

function Note({ kind, text }: { kind: "ok" | "error"; text: string }) {
  return (
    <p role={kind === "error" ? "alert" : "status"} className={cn("type-body flex items-start gap-2", kind === "error" ? "text-error" : "text-success-ink")}>
      {kind === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
      {text}
    </p>
  );
}
const box = "flex flex-col gap-4 rounded-md border border-line bg-card p-4 shadow-card md:p-5";
const primary = "type-body-medium flex h-12 items-center justify-center gap-2 self-start rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover disabled:opacity-60";

export function ProfileForm() {
  const t = useTranslations("Profile");
  const { status, user } = useSession();
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [details, setDetails] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [password, setPassword] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const save = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => { setDetails({ kind: "ok", text: t("saved") }); void refreshSession().catch(() => null); },
    onError: () => setDetails({ kind: "error", text: t("errors.generic") }),
  });
  const change = useMutation({
    mutationFn: () => changePassword(pw.current, pw.next),
    onSuccess: () => { setPw({ current: "", next: "", again: "" }); setPassword({ kind: "ok", text: t("changed") }); },
    onError: (err) => setPassword({ kind: "error", text: err instanceof ApiError && (err.status === 400 || err.status === 401) ? t("errors.wrongCurrent") : t("errors.generic") }),
  });

  if (status === "loading") return null;
  if (!user) return <p className="type-body text-ink-secondary">{t("guest")} <Link href={`/auth/login?next=${encodeURIComponent("/account/profile")}`} className="text-brand underline">{t("logIn")}</Link></p>;

  const nameValue = name ?? user.name;
  const phoneValue = phone ?? user.phone ?? "";

  function onDetails(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const n = nameValue.trim();
    const p = normalizePhone(phoneValue);
    if (n.length < 2 || n.length > 80) return setDetails({ kind: "error", text: t("errors.name") });
    if (!BD_MOBILE.test(p)) return setDetails({ kind: "error", text: t("errors.phone") });
    setDetails(null);
    save.mutate({ name: n, phone: p });
  }

  function onPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pw.current) return setPassword({ kind: "error", text: t("errors.current") });
    const ok = pw.next.length >= 8 && new TextEncoder().encode(pw.next).length <= 72 && /[A-Za-z]/.test(pw.next) && /\d/.test(pw.next);
    if (!ok) return setPassword({ kind: "error", text: t("errors.new") });
    if (pw.next !== pw.again) return setPassword({ kind: "error", text: t("errors.match") });
    setPassword(null);
    change.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onDetails} noValidate className={box}>
        <h2 className="type-h3 text-ink">{t("detailsTitle")}</h2>
        <TextField label={t("name")} autoComplete="name" maxLength={80} value={nameValue} onChange={(e) => setName(e.target.value)} />
        <TextField label={t("phone")} type="tel" autoComplete="tel" maxLength={25} value={phoneValue} onChange={(e) => setPhone(e.target.value)} />
        <TextField label={t("email")} value={user.email} disabled readOnly />
        {details && <Note kind={details.kind} text={details.text} />}
        <button type="submit" disabled={save.isPending} className={primary}>{save.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}{save.isPending ? t("saving") : t("save")}</button>
      </form>
      <form onSubmit={onPassword} noValidate className={box}>
        <h2 className="type-h3 text-ink">{t("passwordTitle")}</h2>
        <p className="type-caption text-ink-muted">{t("passwordText")}</p>
        <TextField label={t("current")} type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
        <TextField label={t("new")} type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
        <TextField label={t("confirm")} type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw((p) => ({ ...p, again: e.target.value }))} />
        {password && <Note kind={password.kind} text={password.text} />}
        <button type="submit" disabled={change.isPending} className={primary}>{change.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}{t("changePassword")}</button>
      </form>
    </div>
  );
}