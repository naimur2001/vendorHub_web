"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, EyeOff, Flag as FlagIcon, Package, ShieldCheck, X } from "lucide-react";
import Image from "next/image";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Link } from "@/i18n/routing";
import { ApiError } from "@/lib/api/core";
import {
  approveProduct,
  listFlags,
  listModeration,
  modKeys,
  rejectProduct,
  resolveFlag,
  type Flag,
  type FlagStatus,
  type ModerationStatus,
  type PendingProduct,
} from "@/lib/api/moderation";
import { safeMediaUrl } from "@/lib/api/storefront";
import { formatTaka } from "@/lib/format";
import { refreshPublicPages } from "@/lib/refresh-public";
import { cn } from "@/lib/utils";

type Tab = "products" | "flags";
const PRODUCT_STATUSES: ModerationStatus[] = ["PENDING", "APPROVED", "REJECTED"];
const FLAG_STATUSES: FlagStatus[] = ["OPEN", "HIDDEN", "KEPT"];

const chip = (on: boolean) =>
  cn(
    "type-body-medium h-11 rounded-full border px-4 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
    on ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand",
  );
const solid =
  "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60";
const outline =
  "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60";
const box = "rounded-md border border-dashed border-line-strong p-6 text-center type-body text-ink-secondary";

const errText = (err: unknown, t: (k: string) => string) =>
  err instanceof ApiError && err.status === 0 ? t("errors.network") : err instanceof ApiError && err.status === 409 ? t("errors.changed") : t("errors.generic");

/** Admin: products shops added (approve or reject) and reported reviews, photos and chat messages (hide or keep). */
export function ModerationQueue() {
  const t = useTranslations("AdminModeration");
  const [tab, setTab] = useState<Tab>("products");
  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label={t("tabsLabel")} className="flex gap-2">
        <button type="button" aria-pressed={tab === "products"} onClick={() => setTab("products")} className={chip(tab === "products")}>
          <Package className="mr-1.5 inline size-4" aria-hidden />
          {t("tabProducts")}
        </button>
        <button type="button" aria-pressed={tab === "flags"} onClick={() => setTab("flags")} className={chip(tab === "flags")}>
          <FlagIcon className="mr-1.5 inline size-4" aria-hidden />
          {t("tabFlags")}
        </button>
      </div>
      {tab === "products" ? <ProductsQueue /> : <FlagsQueue />}
    </div>
  );
}

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const t = useTranslations("AdminModeration");
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className={cn(outline, "disabled:invisible")}>
        <ChevronLeft className="size-4" aria-hidden />
        {t("previous")}
      </button>
      <span className="type-body text-ink-secondary">{t("pageOf", { page, total: totalPages })}</span>
      <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} className={cn(outline, "disabled:invisible")}>
        {t("next")}
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </nav>
  );
}

// ---------- products ----------

function ProductsQueue() {
  const t = useTranslations("AdminModeration");
  const [status, setStatus] = useState<ModerationStatus>("PENDING");
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: modKeys.products(status, page), queryFn: () => listModeration(status, page), placeholderData: keepPreviousData });
  const list = q.data?.data ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div role="group" aria-label={t("statusLabel")} className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {PRODUCT_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={chip(status === s)}
          >
            {t(`productStatus.${s}`)}
          </button>
        ))}
      </div>
      {q.isPending ? (
        <div className="h-48 skeleton rounded-md" aria-hidden />
      ) : q.isError ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => q.refetch()} className={outline}>{t("retry")}</button>
        </div>
      ) : list.length === 0 ? (
        <p className={box}>
          <ShieldCheck className="mx-auto mb-2 size-8 text-success-ink" aria-hidden />
          {t(status === "PENDING" ? "productsClear" : "productsEmpty")}
        </p>
      ) : (
        <ul className={cn("flex flex-col gap-3", q.isPlaceholderData && "opacity-60")}>
          {list.map((p) => (
            <li key={p.id}>
              <ProductRow product={p} />
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} totalPages={q.data?.meta?.pagination?.totalPages ?? 1} onPage={setPage} />
    </section>
  );
}

function ProductRow({ product: p }: { product: PendingProduct }) {
  const t = useTranslations("AdminModeration");
  const locale = useLocale();
  const format = useFormatter();
  const id = useId();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const photo = safeMediaUrl(p.images[0]);

  const after = () => {
    refreshPublicPages(["products"]);
    void queryClient.invalidateQueries({ queryKey: ["admin", "moderation"] });
  };
  const approve = useMutation({ mutationFn: () => approveProduct(p.id), onSuccess: after, onError: (e) => setError(errText(e, t)) });
  const reject = useMutation({ mutationFn: () => rejectProduct(p.id, reason.trim()), onSuccess: after, onError: (e) => setError(errText(e, t)) });

  return (
    <article className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card md:flex-row md:gap-5">
      <span className="relative block h-28 w-24 shrink-0 overflow-hidden rounded-t-full rounded-b-sm bg-highlight-soft">
        {photo ? <Image src={photo} alt="" fill unoptimized sizes="96px" className="object-cover" /> : <Package className="absolute inset-0 m-auto size-8 text-highlight" aria-hidden />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="type-body-medium text-ink">{p.title}</h3>
        <p className="type-caption text-ink-muted">
          {[p.brand?.name, p.category?.name, p.msrp !== null ? t("msrp", { price: formatTaka(p.msrp, locale) }) : null].filter(Boolean).join(" · ")}
        </p>
        {p.shop && (
          <p className="type-caption text-ink-secondary">
            {t("addedBy")}{" "}
            <Link href={`/shops/${p.shop.slug}`} className="text-brand underline-offset-4 hover:underline">
              {p.shop.name}
            </Link>
            {" · "}
            {format.dateTime(new Date(p.createdAt), { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}
        {/* Plain text from the shop */}
        {p.description && <p className="type-body line-clamp-3 whitespace-pre-line text-ink-secondary">{p.description}</p>}
        {p.moderationNote && <p className="type-caption rounded-sm bg-subtle p-2 text-ink-secondary">{t("note", { note: p.moderationNote })}</p>}
        {error && <p role="alert" className="type-caption text-error">{error}</p>}

        {rejecting && (
          <div className="mt-2 flex flex-col gap-1.5">
            <label htmlFor={`${id}-r`} className="type-body-medium text-ink">{t("rejectReason")}</label>
            <textarea id={`${id}-r`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2} className="type-body rounded-sm border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none" />
            <p className="type-caption text-ink-muted">{t("rejectHint")}</p>
          </div>
        )}
      </div>
      {p.moderationStatus !== "APPROVED" || rejecting ? (
        <div className="flex shrink-0 flex-wrap items-start gap-2 md:w-44 md:flex-col md:items-stretch">
          {rejecting ? (
            <>
              <button type="button" onClick={() => reject.mutate()} disabled={reason.trim().length < 3 || reject.isPending} className={solid}>
                <X className="size-4" aria-hidden />
                {t("confirmReject")}
              </button>
              <button type="button" onClick={() => setRejecting(false)} className={outline}>{t("cancel")}</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => approve.mutate()} disabled={approve.isPending} className={solid}>
                <Check className="size-4" aria-hidden />
                {t("approve")}
              </button>
              {p.moderationStatus === "PENDING" && (
                <button type="button" onClick={() => setRejecting(true)} className={outline}>
                  <X className="size-4" aria-hidden />
                  {t("reject")}
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setRejecting(true)} className={cn(outline, "self-start")}>
          {t("reject")}
        </button>
      )}
    </article>
  );
}

// ---------- flags ----------

function FlagsQueue() {
  const t = useTranslations("AdminModeration");
  const [status, setStatus] = useState<FlagStatus>("OPEN");
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: modKeys.flags(status, page), queryFn: () => listFlags(status, page), placeholderData: keepPreviousData });
  const list = q.data?.data ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div role="group" aria-label={t("statusLabel")} className="flex gap-2">
        {FLAG_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={chip(status === s)}
          >
            {t(`flagStatus.${s}`)}
          </button>
        ))}
      </div>
      {q.isPending ? (
        <div className="h-48 skeleton rounded-md" aria-hidden />
      ) : q.isError ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => q.refetch()} className={outline}>{t("retry")}</button>
        </div>
      ) : list.length === 0 ? (
        <p className={box}>{t(status === "OPEN" ? "flagsClear" : "flagsEmpty")}</p>
      ) : (
        <ul className={cn("flex flex-col gap-3", q.isPlaceholderData && "opacity-60")}>
          {list.map((f) => (
            <li key={f.id}>
              <FlagRow flag={f} />
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} totalPages={q.data?.meta?.pagination?.totalPages ?? 1} onPage={setPage} />
    </section>
  );
}

function FlagRow({ flag: f }: { flag: Flag }) {
  const t = useTranslations("AdminModeration");
  const tReason = useTranslations("Report");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const resolve = useMutation({
    mutationFn: (action: "HIDE" | "KEEP") => resolveFlag(f.id, action),
    onSuccess: () => {
      refreshPublicPages(["products", "shops"]);
      void queryClient.invalidateQueries({ queryKey: ["admin", "flags"] });
    },
    onError: (e) => setError(errText(e, t)),
  });
  const target = f.target;
  const photo = f.targetType === "REVIEW_PHOTO" ? safeMediaUrl(target?.thumbUrl) : null;

  return (
    <article className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-caption rounded-full bg-highlight-soft px-2 py-0.5 text-highlight">{t(`target.${f.targetType}`)}</span>
        <span className="type-caption rounded-full bg-subtle px-2 py-0.5 text-ink-secondary">{tReason(`reasons.${f.reason}`)}</span>
        {f.auto && <span className="type-caption rounded-full bg-info-soft px-2 py-0.5 text-verified">{t("auto")}</span>}
        {f.reportsOnTarget > 1 && <span className="type-caption text-error">{t("reports", { count: f.reportsOnTarget })}</span>}
        <span className="type-caption ml-auto text-ink-muted">{format.dateTime(new Date(f.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
      </div>

      {/* The reported content, as plain text */}
      {target === null ? (
        <p className="type-body text-ink-muted italic">{t("targetGone")}</p>
      ) : photo ? (
        <span className="relative block size-32 overflow-hidden rounded-md bg-subtle">
          <Image src={photo} alt={t("reportedPhoto")} fill unoptimized sizes="128px" className="object-cover" />
        </span>
      ) : (
        <blockquote className="type-body rounded-md border-l-4 border-gold bg-subtle p-3 break-words whitespace-pre-wrap text-ink">
          {typeof target.rating === "number" && <span className="mr-2 text-gold" aria-label={t("stars", { count: target.rating })}>{"★".repeat(target.rating)}</span>}
          {target.comment ?? target.body ?? t("noText")}
        </blockquote>
      )}
      {target?.isHidden && <p className="type-caption flex items-center gap-1 text-ink-muted"><EyeOff className="size-3.5" aria-hidden />{t("isHidden")}</p>}
      {f.note && <p className="type-caption text-ink-secondary">{t("reporterNote", { note: f.note })}</p>}
      {f.resolutionNote && <p className="type-caption text-ink-secondary">{t("resolution", { note: f.resolutionNote })}</p>}
      {error && <p role="alert" className="type-caption text-error">{error}</p>}

      {f.status === "OPEN" && target !== null && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => resolve.mutate("HIDE")} disabled={resolve.isPending} className={solid}>
            <EyeOff className="size-4" aria-hidden />
            {t("hide")}
          </button>
          <button type="button" onClick={() => resolve.mutate("KEEP")} disabled={resolve.isPending} className={outline}>
            <Check className="size-4" aria-hidden />
            {t("keep")}
          </button>
        </div>
      )}
    </article>
  );
}
