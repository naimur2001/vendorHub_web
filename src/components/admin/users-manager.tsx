"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { listUsers, ROLES, setUserRole, setUserStatus, type AdminUser, type Role } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/core";
import { cn } from "@/lib/utils";

const input = "type-body h-11 w-full rounded-md border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";

function UserRow({ u, onDone }: { u: AdminUser; onDone: (msg: string) => void }) {
  const t = useTranslations("AdminUsers");
  const c = useTranslations("AdminCommon");
  const [mode, setMode] = useState<null | "status" | "role">(null);
  const [role, setRole] = useState<Role>(u.role);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const act = useMutation({
    mutationFn: () => (mode === "role" ? setUserRole(u.id, role, reason.trim()) : setUserStatus(u.id, !u.isActive, reason.trim())),
    onSuccess: () => { setMode(null); setReason(""); onDone(t("done")); },
    onError: (err) => setError(err instanceof ApiError ? err.message : c("loadError")),
  });

  return (
    <li className={cn("flex flex-col gap-2 rounded-md border border-line bg-card p-4", !u.isActive && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-body-medium text-ink">{u.name}</span>
        <span className="type-caption rounded-full bg-subtle px-2 py-0.5 text-ink-secondary">{t(`roles.${u.role}`)}</span>
        {!u.isActive && <span className="type-caption rounded-full bg-error-soft px-2 py-0.5 text-error">{t("blocked")}</span>}
      </div>
      <span className="type-caption text-ink-muted">{u.email}{u.phone ? ` · ${u.phone}` : ""}</span>
      {mode === null ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode("status")} className={cn("type-body-medium h-9 rounded-sm px-3", u.isActive ? "text-error hover:bg-error-soft" : "text-success-ink hover:bg-success-soft")}>{u.isActive ? t("block") : t("unblock")}</button>
          <button type="button" onClick={() => setMode("role")} className="type-body-medium h-9 rounded-sm border border-brand px-3 text-brand hover:bg-subtle">{t("changeRole")}</button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim().length < 5 || reason.trim().length > 500) return setError(c("reasonError"));
            setError(null);
            act.mutate();
          }}
          className="flex flex-col gap-2 rounded-md bg-surface p-3"
        >
          {mode === "role" && (
            <select aria-label={t("newRole")} value={role} onChange={(e) => setRole(e.target.value as Role)} className={input}>
              {ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
            </select>
          )}
          <textarea aria-label={t("reason")} placeholder={t("reason")} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="type-body w-full rounded-md border border-input bg-card px-3 py-2 text-ink" />
          {error && <p role="alert" className="type-caption text-error">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={act.isPending} className="type-body-medium h-10 rounded-sm bg-action px-4 text-primary-foreground disabled:opacity-60">{t("confirm")}</button>
            <button type="button" onClick={() => { setMode(null); setError(null); }} className="type-body-medium h-10 px-3 text-ink-secondary">{t("cancel")}</button>
          </div>
        </form>
      )}
    </li>
  );
}

export function UsersManager() {
  const t = useTranslations("AdminUsers");
  const c = useTranslations("AdminCommon");
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [query, setQuery] = useState<{ q?: string; role?: Role; page: number }>({ page: 1 });
  const [notice, setNotice] = useState<string | null>(null);
  const users = useQuery({ queryKey: ["admin", "users", query], queryFn: () => listUsers(query), placeholderData: keepPreviousData });
  const rows = users.data?.data ?? [];
  const totalPages = users.data?.meta?.pagination?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={(e) => { e.preventDefault(); setQuery((q) => ({ ...q, page: 1, q: text.replace(/\p{Cc}/gu, "").trim().slice(0, 100) || undefined })); }} className="flex flex-col gap-2 sm:flex-row">
        <input type="search" aria-label={t("search")} placeholder={t("search")} maxLength={100} value={text} onChange={(e) => setText(e.target.value)} className={input} />
        <select aria-label={t("allRoles")} value={query.role ?? ""} onChange={(e) => setQuery((q) => ({ ...q, page: 1, role: (e.target.value || undefined) as Role | undefined }))} className={cn(input, "sm:w-48")}>
          <option value="">{t("allRoles")}</option>
          {ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
        </select>
        <button type="submit" className="type-body-medium flex h-11 items-center gap-2 rounded-sm border border-brand px-4 text-brand"><Search className="size-4" aria-hidden />{c("searchButton")}</button>
      </form>
      {notice && <p role="status" className="type-body flex items-center gap-2 text-success-ink"><CircleCheck className="size-4" aria-hidden />{notice}</p>}
      {users.isPending ? <p className="type-body text-ink-secondary">{c("loading")}</p> : users.isError ? <button type="button" onClick={() => users.refetch()} className="text-brand">{c("retry")}</button> : rows.length === 0 ? <p className="type-body text-ink-secondary">{t("empty")}</p> : (
        <>
          <p className="type-body text-ink-secondary">{t("count", { count: users.data?.meta?.pagination?.total ?? rows.length })}</p>
          <ul className="grid gap-3 lg:grid-cols-2">
            {rows.map((u) => <UserRow key={u.id} u={u} onDone={(m) => { setNotice(m); void queryClient.invalidateQueries({ queryKey: ["admin", "users"] }); }} />)}
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