"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
import {
  createBrand,
  createCategory,
  deleteBrand,
  deleteCategory,
  listBrands,
  listCategories,
  productKeys,
  renameBrand,
  renameCategory,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/core";
import { cn } from "@/lib/utils";

const inputClass =
  "type-body h-11 w-full rounded-md border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";
const validName = (s: string) => s.trim().length >= 2 && s.trim().length <= 60;

type Op = { kind: "create" | "rename" | "delete"; target: "brand" | "category"; id?: string; name?: string; parentId?: string };

function run(op: Op): Promise<unknown> {
  const name = op.name?.trim() ?? "";
  if (op.target === "brand") {
    if (op.kind === "create") return createBrand(name);
    if (op.kind === "rename") return renameBrand(op.id ?? "", name);
    return deleteBrand(op.id ?? "");
  }
  if (op.kind === "create") return createCategory(name, op.parentId);
  if (op.kind === "rename") return renameCategory(op.id ?? "", name);
  return deleteCategory(op.id ?? "");
}

/** One name with Rename (inline) and Delete (two clicks). */
function EditableRow({ name, busy, onRename, onDelete, indent }: { name: string; busy: boolean; onRename: (name: string) => void; onDelete: () => void; indent?: boolean }) {
  const t = useTranslations("AdminTaxonomy");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(name);
  const [confirm, setConfirm] = useState(false);

  return (
    <li className={cn("flex flex-wrap items-center gap-2 border-t border-line py-2 first:border-t-0", indent && "pl-6")}>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (validName(text)) {
              onRename(text);
              setEditing(false);
            }
          }}
          className="flex flex-1 gap-2"
        >
          <input aria-label={t("name")} value={text} maxLength={60} onChange={(e) => setText(e.target.value)} className={inputClass} />
          <button type="submit" disabled={!validName(text) || busy} className="type-body-medium h-11 rounded-sm bg-action px-3 text-primary-foreground disabled:opacity-50">{t("save")}</button>
          <button type="button" onClick={() => { setEditing(false); setText(name); }} className="type-body-medium h-11 px-2 text-ink-secondary">{t("cancel")}</button>
        </form>
      ) : (
        <>
          <span className={cn("type-body flex-1 text-ink", indent && "text-ink-secondary")}>{indent && "↳ "}{name}</span>
          <button type="button" onClick={() => setEditing(true)} disabled={busy} className="type-body-medium flex h-9 items-center gap-1 rounded-sm px-2 text-brand hover:bg-subtle">
            <Pencil className="size-4" aria-hidden />
            {t("rename")}
          </button>
          <button
            type="button"
            onClick={() => (confirm ? onDelete() : setConfirm(true))}
            onBlur={() => setConfirm(false)}
            disabled={busy}
            className={cn("type-body-medium flex h-9 items-center gap-1 rounded-sm px-2", confirm ? "bg-error text-primary-foreground" : "text-error hover:bg-error-soft")}
          >
            <Trash2 className="size-4" aria-hidden />
            {confirm ? t("confirmDelete") : t("delete")}
          </button>
        </>
      )}
    </li>
  );
}

export function CatalogLists() {
  const t = useTranslations("AdminTaxonomy");
  const queryClient = useQueryClient();
  const ids = { cat: useId(), parent: useId(), brand: useId() };
  const [catName, setCatName] = useState("");
  const [parentId, setParentId] = useState("");
  const [brandName, setBrandName] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const categories = useQuery({ queryKey: productKeys.categories, queryFn: listCategories });
  const brands = useQuery({ queryKey: productKeys.brands, queryFn: listBrands });

  const op = useMutation({
    mutationFn: run,
    onSuccess: (_r, o) => {
      setMessage({ kind: "ok", text: o.kind === "delete" ? t("deleted") : t("saved") });
      if (o.kind === "create") (o.target === "brand" ? setBrandName : setCatName)("");
      void queryClient.invalidateQueries({ queryKey: o.target === "brand" ? productKeys.brands : productKeys.categories });
    },
    onError: (err, o) => {
      let key = "errors.generic";
      if (err instanceof ApiError && err.status === 409) key = o.kind === "delete" ? "errors.inUse" : "errors.duplicate";
      else if (err instanceof ApiError && err.status === 400) key = "errors.name";
      else if (err instanceof ApiError && err.status === 0) key = "errors.network";
      setMessage({ kind: "error", text: t(key) });
    },
  });

  function add(e: FormEvent<HTMLFormElement>, target: "brand" | "category") {
    e.preventDefault();
    const name = target === "brand" ? brandName : catName;
    if (!validName(name)) return setMessage({ kind: "error", text: t("errors.name") });
    setMessage(null);
    op.mutate({ kind: "create", target, name, parentId: target === "category" ? parentId || undefined : undefined });
  }

  if (categories.isPending || brands.isPending) return <OwnerSkeleton label={t("loading")} />;
  if (categories.isError || brands.isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center">
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => { void categories.refetch(); void brands.refetch(); }} className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand">{t("retry")}</button>
      </div>
    );
  }

  const roots = categories.data;
  const brandList = [...brands.data].sort((a, b) => a.name.localeCompare(b.name));
  const busy = op.isPending;

  return (
    <div className="flex flex-col gap-6">
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={cn("type-body flex items-start gap-2", message.kind === "error" ? "text-error" : "text-success-ink")}>
          {message.kind === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
          <span>
            {message.text}
            {message.kind === "ok" && <span className="text-ink-muted"> {t("cacheNote")}</span>}
          </span>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Categories */}
        <section className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card">
          <h2 className="type-h3 text-ink">{t("categories")}</h2>
          <form onSubmit={(e) => add(e, "category")} className="grid gap-2 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.cat} className="type-caption text-ink-secondary">{t("name")}</label>
              <input id={ids.cat} value={catName} maxLength={60} onChange={(e) => setCatName(e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.parent} className="type-caption text-ink-secondary">{t("under")}</label>
              <select id={ids.parent} value={parentId} onChange={(e) => setParentId(e.target.value)} className={inputClass}>
                <option value="">{t("topLevel")}</option>
                {roots.map((r) => <option key={r.id} value={r.id}>{t("underParent", { parent: r.name })}</option>)}
              </select>
            </div>
            <button type="submit" disabled={busy} className="type-body-medium flex h-11 items-center justify-center gap-1 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover disabled:opacity-60">
              {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              {t("add")}
            </button>
          </form>
          {roots.length === 0 ? (
            <p className="type-body text-ink-muted">{t("noCategories")}</p>
          ) : (
            <ul>
              {roots.map((r) => (
                <li key={r.id}>
                  <ul>
                    <EditableRow name={r.name} busy={busy} onRename={(name) => op.mutate({ kind: "rename", target: "category", id: r.id, name })} onDelete={() => op.mutate({ kind: "delete", target: "category", id: r.id })} />
                    {(r.children ?? []).map((c) => (
                      <EditableRow key={c.id} indent name={c.name} busy={busy} onRename={(name) => op.mutate({ kind: "rename", target: "category", id: c.id, name })} onDelete={() => op.mutate({ kind: "delete", target: "category", id: c.id })} />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Brands */}
        <section className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card">
          <h2 className="type-h3 text-ink">{t("brands")}</h2>
          <form onSubmit={(e) => add(e, "brand")} className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor={ids.brand} className="type-caption text-ink-secondary">{t("name")}</label>
              <input id={ids.brand} value={brandName} maxLength={60} onChange={(e) => setBrandName(e.target.value)} className={inputClass} />
            </div>
            <button type="submit" disabled={busy} className="type-body-medium flex h-11 items-center gap-1 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover disabled:opacity-60">
              {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              {t("add")}
            </button>
          </form>
          {brandList.length === 0 ? (
            <p className="type-body text-ink-muted">{t("noBrands")}</p>
          ) : (
            <ul>
              {brandList.map((b) => (
                <EditableRow key={b.id} name={b.name} busy={busy} onRename={(name) => op.mutate({ kind: "rename", target: "brand", id: b.id, name })} onDelete={() => op.mutate({ kind: "delete", target: "brand", id: b.id })} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}