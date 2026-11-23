"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, LoaderCircle, Plus, Search, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/core";
import { searchCatalog } from "@/lib/api/listings";
import { addFeatured, FEATURED_MAX, listFeatured, modKeys, removeFeatured, reorderFeatured, type FeaturedKind, type FeaturedSlot } from "@/lib/api/moderation";
import { searchShops } from "@/lib/api/shop-search";
import { refreshPublicPages } from "@/lib/refresh-public";
import { cn } from "@/lib/utils";

const KINDS: FeaturedKind[] = ["PRODUCT", "SHOP"];
const field =
  "type-body h-11 w-full rounded-sm border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";
const iconButton =
  "flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-subtle hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-40";

type Pick = { id: string; name: string; sub?: string };

function errorKey(err: unknown): string {
  if (!(err instanceof ApiError)) return "errors.generic";
  const code = (err.details as { code?: string } | undefined)?.code;
  if (code === "FEATURED_LIMIT") return "errors.limit";
  if (code === "FEATURED_DUPLICATE") return "errors.duplicate";
  if (err.status === 404) return "errors.notFound";
  if (err.status === 400) return "errors.invalid";
  if (err.status === 0) return "errors.network";
  return "errors.generic";
}

/** Admin: pick up to 12 products and 12 shops for the home page rows, in order, optionally scheduled. */
export function FeaturedManager() {
  const t = useTranslations("AdminFeatured");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<FeaturedKind>("PRODUCT");
  const [notice, setNotice] = useState<string | null>(null);

  const slots = useQuery({ queryKey: modKeys.featured(kind), queryFn: () => listFeatured(kind) });
  const done = (msg: string) => {
    setNotice(msg);
    refreshPublicPages(["featured"]);
    void queryClient.invalidateQueries({ queryKey: modKeys.featured(kind) });
  };

  const remove = useMutation({ mutationFn: removeFeatured, onSuccess: () => done(t("removed")), onError: (e) => setNotice(t(errorKey(e))) });
  const reorder = useMutation({
    mutationFn: reorderFeatured,
    onMutate: (ids) => {
      // move at once; the server order comes back after
      queryClient.setQueryData<FeaturedSlot[]>(modKeys.featured(kind), (old) => old && ids.map((id) => old.find((s) => s.id === id)!).filter(Boolean));
    },
    onSuccess: () => done(t("reordered")),
    onError: (e) => {
      setNotice(t(errorKey(e)));
      void queryClient.invalidateQueries({ queryKey: modKeys.featured(kind) });
    },
  });

  function move(i: number, dir: -1 | 1) {
    const list = slots.data ?? [];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const ids = list.map((s) => s.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorder.mutate(ids);
  }

  const when = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null);
  const count = slots.data?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label={t("kindLabel")} className="flex gap-2">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k);
              setNotice(null);
            }}
            className={cn(
              "type-body-medium h-11 rounded-full border px-5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
              kind === k ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand",
            )}
          >
            {t(`kinds.${k}`)}
          </button>
        ))}
      </div>

      {notice && (
        <p role="status" className="type-body rounded-md bg-subtle p-3 text-ink-secondary">
          {notice}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="type-h3 text-ink">{t("listTitle", { count, max: FEATURED_MAX })}</h2>
        {slots.isPending ? (
          <div className="h-40 skeleton rounded-md" aria-hidden />
        ) : slots.isError ? (
          <div role="alert" className="flex items-center gap-3">
            <p className="type-body text-ink-secondary">{t("loadError")}</p>
            <button type="button" onClick={() => slots.refetch()} className="type-body-medium h-11 rounded-sm border border-brand px-4 text-brand hover:bg-subtle">
              {t("retry")}
            </button>
          </div>
        ) : slots.data.length === 0 ? (
          <p className="type-body rounded-md border border-dashed border-line-strong p-6 text-center text-ink-secondary">{t("empty")}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {slots.data.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 rounded-md border border-line bg-card p-3 shadow-card">
                <span className="type-caption w-6 shrink-0 text-center text-ink-muted">{format.number(i + 1)}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="type-body-medium truncate text-ink">{s.target?.name ?? t("unnamed", { id: s.targetId.slice(0, 8) })}</p>
                  <p className="type-caption flex flex-wrap items-center gap-2 text-ink-muted">
                    <span className={cn("rounded-full px-2 py-0.5", s.liveNow ? "bg-success-soft text-success-ink" : "bg-subtle text-ink-muted")}>
                      {s.liveNow ? t("live") : t("notLive")}
                    </span>
                    {(s.startsAt || s.endsAt) && <span>{t("window", { from: when(s.startsAt) ?? t("now"), to: when(s.endsAt) ?? t("noEnd") })}</span>}
                  </p>
                </div>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || reorder.isPending} aria-label={t("up", { name: s.target?.name ?? "" })} className={iconButton}>
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === slots.data.length - 1 || reorder.isPending}
                  aria-label={t("down", { name: s.target?.name ?? "" })}
                  className={iconButton}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => window.confirm(t("confirmRemove")) && remove.mutate(s.id)}
                  disabled={remove.isPending}
                  aria-label={t("remove", { name: s.target?.name ?? "" })}
                  className={cn(iconButton, "hover:text-error")}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {count < FEATURED_MAX ? <AddFeatured key={kind} kind={kind} onAdded={() => done(t("added"))} /> : <p className="type-body text-ink-secondary">{t("full")}</p>}
    </div>
  );
}

function AddFeatured({ kind, onAdded }: { kind: FeaturedKind; onAdded: () => void }) {
  const t = useTranslations("AdminFeatured");
  const id = useId();
  const [term, setTerm] = useState("");
  const [searched, setSearched] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [error, setError] = useState<string | null>(null);

  const results = useQuery({
    queryKey: ["admin", "featured-search", kind, searched],
    enabled: searched.length >= 2,
    queryFn: async (): Promise<Pick[]> =>
      kind === "PRODUCT"
        ? (await searchCatalog(searched)).map((p) => ({ id: p.id, name: p.title, sub: p.brand ?? undefined }))
        : (await searchShops({ q: searched, limit: 8 })).data.map((s) => ({ id: s.id, name: s.name, sub: s.market?.name })),
  });

  const add = useMutation({
    mutationFn: (targetId: string) =>
      addFeatured({ kind, targetId, startsAt: starts ? new Date(starts).toISOString() : null, endsAt: ends ? new Date(ends).toISOString() : null }),
    onMutate: () => setError(null),
    onSuccess: onAdded,
    onError: (e) => setError(t(errorKey(e))),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setSearched(term.trim().slice(0, 100));
  }

  return (
    <section aria-labelledby={`${id}-t`} className="flex flex-col gap-4 rounded-md border border-line bg-card p-4 shadow-card md:p-5">
      <h2 id={`${id}-t`} className="type-h3 text-ink">
        {t(kind === "PRODUCT" ? "addProduct" : "addShop")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-s`} className="type-body-medium text-ink">{t("startsAt")}</label>
          <input id={`${id}-s`} type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-e`} className="type-body-medium text-ink">{t("endsAt")}</label>
          <input id={`${id}-e`} type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} className={field} />
        </div>
        <p className="type-caption -mt-2 text-ink-muted sm:col-span-2">{t("scheduleHint")}</p>
      </div>
      <form onSubmit={submit} role="search" className="flex gap-2">
        <label htmlFor={`${id}-q`} className="sr-only">{t("searchLabel")}</label>
        <input id={`${id}-q`} type="search" value={term} onChange={(e) => setTerm(e.target.value)} maxLength={100} placeholder={t(kind === "PRODUCT" ? "searchProducts" : "searchShops")} className={field} />
        <button type="submit" aria-label={t("search")} className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-action text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none">
          <Search className="size-4" aria-hidden />
        </button>
      </form>
      {error && <p role="alert" className="type-body text-error">{error}</p>}
      {searched.length >= 2 &&
        (results.isPending ? (
          <div className="h-24 skeleton rounded-md" aria-hidden />
        ) : results.isError ? (
          <p role="alert" className="type-body text-ink-secondary">{t("loadError")}</p>
        ) : results.data.length === 0 ? (
          <p className="type-body text-ink-secondary">{t("noResults")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {results.data.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 flex-col">
                  <span className="type-body-medium truncate text-ink">{r.name}</span>
                  {r.sub && <span className="type-caption truncate text-ink-muted">{r.sub}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => add.mutate(r.id)}
                  disabled={add.isPending}
                  className="type-body-medium inline-flex h-11 shrink-0 items-center gap-1.5 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60"
                >
                  {add.isPending && add.variables === r.id ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                  {t("feature")}
                  <span className="sr-only">{r.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
