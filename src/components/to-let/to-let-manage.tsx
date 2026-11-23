"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, ImagePlus, LoaderCircle, Pencil, Upload, X } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useSession } from "@/components/app-providers";
import { ToLetForm } from "@/components/to-let/to-let-form";
import { ToLetThread } from "@/components/to-let/to-let-thread";
import { Link } from "@/i18n/routing";
import { ApiError } from "@/lib/api/core";
import { safeMediaUrl } from "@/lib/api/storefront";
import {
  addToLetDocument,
  addToLetPhoto,
  getManagedToLet,
  getOwnerMessages,
  listMyToLet,
  removeToLetPhoto,
  sendOwnerMessage,
  TOKEN,
  toLetKeys,
  withdrawToLet,
  type OwnerAuth,
  type ToLetOwnerView,
  type ToLetStatus,
} from "@/lib/api/to-let";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_PHOTOS = 6;
const MAX_DOCS = 3;
const IMG = ["image/jpeg", "image/png", "image/webp"];
const DOC = ["application/pdf", "image/jpeg", "image/png"];
const FIVE_MB = 5 * 1024 * 1024;
const OPEN: ToLetStatus[] = ["PENDING_EMAIL", "SUBMITTED", "NEEDS_INFO", "PUBLISHED"];

const STATUS_STYLE: Record<ToLetStatus, string> = {
  PENDING_EMAIL: "bg-highlight-soft text-highlight",
  SUBMITTED: "bg-info-soft text-verified",
  NEEDS_INFO: "bg-error-soft text-error",
  PUBLISHED: "bg-success-soft text-success-ink",
  RENTED: "bg-subtle text-ink-secondary",
  REJECTED: "bg-error-soft text-error",
  EXPIRED: "bg-subtle text-ink-muted",
  WITHDRAWN: "bg-subtle text-ink-muted",
};
const outline =
  "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60";

/** Guest owner: /to-let/manage?token=… (the private link from the email). */
export function ManageByToken() {
  const t = useTranslations("ToLetManage");
  const searchParams = useSearchParams();
  const raw = searchParams.get("token");
  const token = raw && TOKEN.test(raw) ? raw : null;
  const q = useQuery({ queryKey: toLetKeys.managed(token ?? ""), queryFn: () => getManagedToLet(token!), enabled: Boolean(token), retry: false });

  if (!token) return <p className="type-body rounded-md border border-line bg-card p-6 text-center text-ink-secondary">{t("badLink")}</p>;
  if (q.isPending) return <div className="h-96 skeleton rounded-md" aria-hidden />;
  if (q.isError) return <p role="alert" className="type-body rounded-md border border-line bg-card p-6 text-center text-ink-secondary">{t("badLink")}</p>;
  return <ListingPanel listing={q.data} auth={{ token }} queryKey={toLetKeys.managed(token)} />;
}

/** Logged-in owner: /me/to-let, every listing they submitted. */
export function MyToLet() {
  const t = useTranslations("ToLetManage");
  const { status } = useSession();
  const q = useQuery({ queryKey: toLetKeys.mine, queryFn: listMyToLet, enabled: status === "authenticated" });

  if (status === "loading" || (status === "authenticated" && q.isPending)) return <div className="h-96 skeleton rounded-md" aria-hidden />;
  if (status === "guest") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center">
        <p className="type-body text-ink-secondary">{t("guestText")}</p>
        <Link href={`/auth/login?next=${encodeURIComponent("/me/to-let")}`} className="type-body-medium flex h-11 items-center rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover">{t("logIn")}</Link>
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div role="alert" className="flex items-center gap-3">
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => q.refetch()} className={outline}>{t("retry")}</button>
      </div>
    );
  }
  if (q.data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-line-strong px-6 py-12 text-center">
        <p className="type-body text-ink-secondary">{t("none")}</p>
        <Link href="/to-let/new" className="type-body-medium flex h-11 items-center rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover">{t("listNew")}</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-10">
      {q.data.map((l) => (
        <ListingPanel key={l.id} listing={l} auth={{}} queryKey={toLetKeys.mine} />
      ))}
    </div>
  );
}

function ListingPanel({ listing: l, auth, queryKey }: { listing: ToLetOwnerView; auth: OwnerAuth; queryKey: readonly unknown[] }) {
  const t = useTranslations("ToLetManage");
  const locale = useLocale();
  const format = useFormatter();
  const id = useId();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey });
  const open = OPEN.includes(l.status);

  const fail = (err: unknown) => {
    const tooBig = err instanceof ApiError && err.status === 413;
    const limit = err instanceof ApiError && err.status === 409;
    setMsg({ ok: false, text: tooBig ? t("tooBig") : limit ? t("limit") : err instanceof ApiError && err.status === 0 ? t("network") : t("error") });
  };
  const photo = useMutation({ mutationFn: (f: File) => addToLetPhoto(l.id, f, auth), onSuccess: refresh, onError: fail });
  const unphoto = useMutation({ mutationFn: (pid: string) => removeToLetPhoto(l.id, pid, auth), onSuccess: refresh, onError: fail });
  const doc = useMutation({
    mutationFn: (f: File) => addToLetDocument(l.id, f, auth),
    onSuccess: () => {
      setMsg({ ok: true, text: t("docAdded") });
      refresh();
    },
    onError: fail,
  });
  const withdraw = useMutation({ mutationFn: () => withdrawToLet(l.id, auth), onSuccess: refresh, onError: fail });

  function pick(file: File | undefined, kind: "photo" | "doc") {
    setMsg(null);
    if (!file) return;
    if (!(kind === "photo" ? IMG : DOC).includes(file.type)) return setMsg({ ok: false, text: kind === "photo" ? t("photoType") : t("docType") });
    if (file.size > FIVE_MB) return setMsg({ ok: false, text: t("tooBig") });
    (kind === "photo" ? photo : doc).mutate(file);
  }

  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-2 rounded-md border border-line bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="type-h3 text-ink">{l.title}</h2>
          <span className={cn("type-caption rounded-full px-2.5 py-0.5", STATUS_STYLE[l.status])}>{t(`status.${l.status}`)}</span>
        </div>
        <p className="type-body text-ink-secondary">{t(`statusText.${l.status}`)}</p>
        {l.status === "REJECTED" && l.rejectReason && <p className="type-body rounded-sm bg-error-soft p-2 text-error">{t("reason", { reason: l.rejectReason })}</p>}
        <p className="type-caption text-ink-muted">
          {t("summary", { rent: formatTaka(l.monthlyRent, locale), size: format.number(l.sizeSqft) })}
          {l.status === "PUBLISHED" && l.expiresAt && ` · ${t("expires", { date: format.dateTime(new Date(l.expiresAt), { day: "numeric", month: "short", year: "numeric" }) })}`}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {l.status === "PUBLISHED" && <Link href={`/to-let/${l.slug}`} className={outline}>{t("viewPublic")}</Link>}
          {open && (
            <button type="button" onClick={() => setEditing((e) => !e)} aria-expanded={editing} className={outline}>
              <Pencil className="size-4" aria-hidden />
              {editing ? t("closeEdit") : t("edit")}
            </button>
          )}
          {open && (
            <button type="button" onClick={() => window.confirm(t("confirmWithdraw")) && withdraw.mutate()} disabled={withdraw.isPending} className={cn(outline, "border-error text-error hover:bg-error-soft")}>
              {t("withdraw")}
            </button>
          )}
        </div>
      </header>

      {msg && <p role={msg.ok ? "status" : "alert"} className={cn("type-body", msg.ok ? "text-success-ink" : "text-error")}>{msg.text}</p>}

      {editing && (
        <ToLetForm
          existing={l}
          auth={auth}
          onSaved={() => {
            setEditing(false);
            setMsg({ ok: true, text: t("saved") });
            refresh();
          }}
        />
      )}

      {open && (
        <section aria-labelledby={`${id}-ph`} className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card">
          <h3 id={`${id}-ph`} className="type-body-medium text-ink">{t("photos", { count: l.photos.length, max: MAX_PHOTOS })}</h3>
          <p className="type-caption text-ink-muted">{t("photosHint")}</p>
          <ul className="flex flex-wrap gap-2">
            {l.photos.map((p, i) => (
              <li key={p.id} className="relative size-24 overflow-hidden rounded-md border border-line bg-subtle">
                {safeMediaUrl(p.thumbUrl) && <Image src={safeMediaUrl(p.thumbUrl)!} alt={t("photoN", { n: i + 1 })} fill unoptimized sizes="96px" className="object-cover" />}
                <button type="button" onClick={() => unphoto.mutate(p.id)} disabled={unphoto.isPending} aria-label={t("removePhoto", { n: i + 1 })} className="absolute top-0 right-0 flex size-11 items-start justify-end p-1 focus-visible:outline-none [&>span]:focus-visible:ring-2 [&>span]:focus-visible:ring-brand">
                  <span className="flex size-6 items-center justify-center rounded-full bg-ink/70 text-primary-foreground">
                    <X className="size-3.5" aria-hidden />
                  </span>
                </button>
              </li>
            ))}
            {l.photos.length < MAX_PHOTOS && (
              <li>
                <label htmlFor={`${id}-pi`} className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line-strong text-ink-muted hover:border-brand hover:text-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand">
                  {photo.isPending ? <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
                  <span className="type-caption">{t("addPhoto")}</span>
                  <input id={`${id}-pi`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={photo.isPending} onChange={(e) => { pick(e.target.files?.[0], "photo"); e.target.value = ""; }} />
                </label>
              </li>
            )}
          </ul>
        </section>
      )}

      {open && l.status !== "PUBLISHED" && (
        <section aria-labelledby={`${id}-dc`} className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card">
          <h3 id={`${id}-dc`} className="type-body-medium text-ink">{t("docs", { count: l.documents.length, max: MAX_DOCS })}</h3>
          <p className="type-caption text-ink-muted">{t("docsHint")}</p>
          {l.documents.length > 0 && (
            <ul className="flex flex-col gap-1">
              {l.documents.map((d) => (
                <li key={d.id} className="type-body flex items-center gap-2 text-ink-secondary">
                  <FileText className="size-4 text-highlight" aria-hidden />
                  <span className="truncate">{d.originalName}</span>
                </li>
              ))}
            </ul>
          )}
          {l.documents.length < MAX_DOCS && (
            <label htmlFor={`${id}-di`} className={cn(outline, "cursor-pointer self-start has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand")}>
              {doc.isPending ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
              {t("addDoc")}
              <input id={`${id}-di`} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" disabled={doc.isPending} onChange={(e) => { pick(e.target.files?.[0], "doc"); e.target.value = ""; }} />
            </label>
          )}
        </section>
      )}

      {l.status !== "PENDING_EMAIL" && (
        <ToLetThread
          queryKey={toLetKeys.ownerMessages(l.id)}
          load={async () => (await getOwnerMessages(l.id, auth)).messages}
          send={(body) => sendOwnerMessage(l.id, body, auth)}
          title={t("threadTitle")}
          intro={t("threadIntro")}
          pollMs={30_000}
        />
      )}
    </article>
  );
}
