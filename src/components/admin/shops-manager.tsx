"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, ExternalLink, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { VerificationSeal } from "@/components/brand/verification-seal";
import { Link } from "@/i18n/routing";
import { listAdminShops, setShopStatus, type AdminShop } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/core";
import { cn } from "@/lib/utils";
import { AdminShopPhotos } from "@/components/shop/shop-photos";
import { refreshPublicPages } from "@/lib/refresh-public";


function ShopRow({ s, onDone }: { s: AdminShop; onDone: (msg: string) => void }) {
  const t = useTranslations("AdminShops");
  const c = useTranslations("AdminCommon");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
    const tPhotos = useTranslations("ShopPhotos");
  const [showPhotos, setShowPhotos] = useState(false);
  const act = useMutation({
    mutationFn: () => setShopStatus(s.id, !s.isActive, reason.trim()),
    onSuccess: () => { setOpen(false); setReason(""); onDone(t("done")); },
    onError: (err) => setError(err instanceof ApiError ? err.message : c("loadError")),
    
  });

  return (
    <li className={cn("flex flex-col gap-2 rounded-md border border-line bg-card p-4", !s.isActive && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-body-medium text-ink">{s.name}</span>
        {s.verificationLevel !== "UNVERIFIED" && <VerificationSeal level={s.verificationLevel} size="sm" />}
        {!s.isActive && <span className="type-caption rounded-full bg-error-soft px-2 py-0.5 text-error">{t("inactive")}</span>}
      </div>
      {s.owner && <span className="type-caption text-ink-muted">{t("owner", { name: s.owner.name, email: s.owner.email })}</span>}
      {!open ? (
        <div className="flex flex-wrap gap-2">
          <Link href={`/shops/${s.slug}`} className="type-body-medium flex h-9 items-center gap-1 rounded-sm px-2 text-brand hover:bg-subtle">{t("view")}<ExternalLink className="size-4" aria-hidden /></Link>

          <button type="button" onClick={() => setShowPhotos((v) => !v)} className="type-body-medium h-9 rounded-sm px-3 text-ink-secondary hover:bg-subtle">
            {showPhotos ? tPhotos("hide") : tPhotos("photos")}
          </button>


          <button type="button" onClick={() => setOpen(true)} className={cn("type-body-medium h-9 rounded-sm px-3", s.isActive ? "text-error hover:bg-error-soft" : "text-success-ink hover:bg-success-soft")}>{s.isActive ? t("deactivate") : t("reactivate")}</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (reason.trim().length < 5 || reason.trim().length > 500) return setError(c("reasonError")); setError(null); act.mutate(); }} className="flex flex-col gap-2 rounded-md bg-surface p-3">
          <textarea aria-label={t("reason")} placeholder={t("reason")} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="type-body w-full rounded-md border border-input bg-card px-3 py-2 text-ink" />
          {error && <p role="alert" className="type-caption text-error">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={act.isPending} className="type-body-medium h-10 rounded-sm bg-action px-4 text-primary-foreground disabled:opacity-60">{t("confirm")}</button>
            <button type="button" onClick={() => { setOpen(false); setError(null); }} className="type-body-medium h-10 px-3 text-ink-secondary">{t("cancel")}</button>
          </div>
        </form>
      )}
            {showPhotos && <AdminShopPhotos shopId={s.id} slug={s.slug} />}
    </li>
  );
}

export function ShopsManager() {
  const t = useTranslations("AdminShops");
  const c = useTranslations("AdminCommon");
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [query, setQuery] = useState<{ q?: string; page: number }>({ page: 1 });
  const [notice, setNotice] = useState<string | null>(null);
  const shops = useQuery({ queryKey: ["admin", "shops", query], queryFn: () => listAdminShops(query), placeholderData: keepPreviousData });
  const rows = shops.data?.data ?? [];
  const totalPages = shops.data?.meta?.pagination?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={(e) => { e.preventDefault(); setQuery({ page: 1, q: text.replace(/\p{Cc}/gu, "").trim().slice(0, 100) || undefined }); }} className="flex gap-2">
        <input type="search" aria-label={t("search")} placeholder={t("search")} maxLength={100} value={text} onChange={(e) => setText(e.target.value)} className="type-body h-11 w-full rounded-md border border-input bg-card px-3 text-ink focus:border-brand focus:outline-none" />
        <button type="submit" className="type-body-medium flex h-11 items-center gap-2 rounded-sm border border-brand px-4 text-brand"><Search className="size-4" aria-hidden />{c("searchButton")}</button>
      </form>
      {notice && <p role="status" className="type-body flex items-center gap-2 text-success-ink"><CircleCheck className="size-4" aria-hidden />{notice}</p>}
      {shops.isPending ? <p className="type-body text-ink-secondary">{c("loading")}</p> : shops.isError ? <button type="button" onClick={() => shops.refetch()} className="text-brand">{c("retry")}</button> : rows.length === 0 ? <p className="type-body text-ink-secondary">{t("empty")}</p> : (
        <>
          <p className="type-body text-ink-secondary">{t("count", { count: shops.data?.meta?.pagination?.total ?? rows.length })}</p>
          <ul className="grid gap-3 lg:grid-cols-2">
            {rows.map((s) => <ShopRow key={s.id} s={s}   onDone={(m) => { setNotice(m); void queryClient.invalidateQueries({ queryKey: ["admin", "shops"] }); refreshPublicPages(["shops", "markets", "products"]); }} />)}
          </ul>
        </>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button type="button" disabled={query.page <= 1} onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))} className="type-body-medium text-brand disabled:invisible">{c("previous")}</button>
          <span className="type-caption text-ink-secondary">{c("pageOf", { page: query.page, total: totalPages })}</span>
          <button type="button" disabled={query.page >= totalPages} onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))} className="type-body-medium text-brand disabled:invisible">{c("next")}</button>
        </div>
      )}
    </div>
  );
}