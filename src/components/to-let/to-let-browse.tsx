"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Images, KeyRound, Plus, Ruler, Search } from "lucide-react";
import Image from "next/image";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { Link } from "@/i18n/routing";
import { getMarkets, shopKeys } from "@/lib/api/shops";
import { safeMediaUrl } from "@/lib/api/storefront";
import { listToLet, toLetKeys, type ToLetCard, type ToLetQuery, type ToLetSort } from "@/lib/api/to-let";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const field = "type-body h-11 w-full rounded-sm border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";
const outline = "type-body-medium inline-flex h-11 items-center justify-center gap-1 rounded-sm border border-brand px-3 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none";
const whole = (v: string) => (/^\d{1,9}$/.test(v.trim()) ? Number(v.trim()) : undefined);

/** Public: shop spaces for rent, with filters. Contacts are never shown; enquiries go to the Vendors Hub team. */
export function ToLetBrowse() {
  const t = useTranslations("ToLet");
  const id = useId();
  const [query, setQuery] = useState<ToLetQuery>({ sort: "newest", page: 1 });
  const [form, setForm] = useState({ q: "", marketId: "", minRent: "", maxRent: "", minSize: "" });
  const markets = useQuery({ queryKey: shopKeys.markets, queryFn: getMarkets, staleTime: 10 * 60_000 });
  const list = useQuery({ queryKey: toLetKeys.list(query), queryFn: () => listToLet(query), placeholderData: keepPreviousData });

  function apply(e: FormEvent) {
    e.preventDefault();
    const q = form.q.trim();
    setQuery((old) => ({
      sort: old.sort,
      page: 1,
      ...(q.length >= 2 && { q: q.slice(0, 100) }),
      ...(form.marketId && { marketId: form.marketId }),
      ...(whole(form.minRent) !== undefined && { minRent: whole(form.minRent) }),
      ...(whole(form.maxRent) !== undefined && { maxRent: whole(form.maxRent) }),
      ...(whole(form.minSize) !== undefined && { minSize: whole(form.minSize) }),
    }));
  }

  const items = list.data?.data ?? [];
  const totalPages = list.data?.meta?.pagination?.totalPages ?? 1;
  const page = query.page ?? 1;
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 9);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-md border border-gold bg-highlight-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="type-body flex items-start gap-2 text-ink">
          <KeyRound className="mt-0.5 size-5 shrink-0 text-highlight" aria-hidden />
          {t("ownerCta")}
        </p>
        <Link href="/to-let/new" className="type-body-medium inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none">
          <Plus className="size-4" aria-hidden />
          {t("listYours")}
        </Link>
      </div>

      <form onSubmit={apply} role="search" aria-label={t("filters")} className="grid gap-3 rounded-md border border-line bg-card p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <label htmlFor={`${id}-q`} className="type-caption text-ink-secondary">{t("search")}</label>
          <input id={`${id}-q`} type="search" value={form.q} maxLength={100} onChange={(e) => setForm({ ...form, q: e.target.value })} placeholder={t("searchPlaceholder")} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-m`} className="type-caption text-ink-secondary">{t("market")}</label>
          <select id={`${id}-m`} value={form.marketId} onChange={(e) => setForm({ ...form, marketId: e.target.value })} className={field}>
            <option value="">{t("anyMarket")}</option>
            {(markets.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-r1`} className="type-caption text-ink-secondary">{t("minRent")}</label>
          <input id={`${id}-r1`} inputMode="numeric" value={form.minRent} onChange={(e) => setForm({ ...form, minRent: digits(e.target.value) })} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-r2`} className="type-caption text-ink-secondary">{t("maxRent")}</label>
          <input id={`${id}-r2`} inputMode="numeric" value={form.maxRent} onChange={(e) => setForm({ ...form, maxRent: digits(e.target.value) })} className={field} />
        </div>
        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor={`${id}-s`} className="type-caption text-ink-secondary">{t("minSize")}</label>
            <input id={`${id}-s`} inputMode="numeric" value={form.minSize} onChange={(e) => setForm({ ...form, minSize: digits(e.target.value) })} className={field} />
          </div>
          <button type="submit" aria-label={t("apply")} className="flex size-11 shrink-0 items-center justify-center self-end rounded-sm bg-action text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none">
            <Search className="size-4" aria-hidden />
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="type-body text-ink-secondary" aria-live="polite">{list.data ? t("count", { count: list.data.meta?.pagination?.total ?? items.length }) : ""}</p>
        <label className="type-caption flex items-center gap-2 text-ink-secondary">
          {t("sort")}
          <select value={query.sort} onChange={(e) => setQuery((q) => ({ ...q, sort: e.target.value as ToLetSort, page: 1 }))} className="type-body h-11 rounded-sm border border-input bg-card px-3 text-ink focus:border-brand focus:outline-none">
            <option value="newest">{t("sorts.newest")}</option>
            <option value="rent_asc">{t("sorts.rent_asc")}</option>
            <option value="rent_desc">{t("sorts.rent_desc")}</option>
          </select>
        </label>
      </div>

      {list.isPending ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="h-72 skeleton rounded-md" />
          ))}
        </ul>
      ) : list.isError ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => list.refetch()} className={outline}>{t("retry")}</button>
        </div>
      ) : items.length === 0 ? (
        <p className="type-body rounded-md border border-dashed border-line-strong p-8 text-center text-ink-secondary">{t("empty")}</p>
      ) : (
        <ul className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", list.isPlaceholderData && "opacity-60")}>
          {items.map((l) => (
            <li key={l.id}>
              <ToLetCardView listing={l} />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setQuery((q) => ({ ...q, page: page - 1 }))} disabled={page <= 1} className={cn(outline, "disabled:invisible")}>
            <ChevronLeft className="size-4" aria-hidden />
            {t("previous")}
          </button>
          <span className="type-body text-ink-secondary">{t("pageOf", { page, total: totalPages })}</span>
          <button type="button" onClick={() => setQuery((q) => ({ ...q, page: page + 1 }))} disabled={page >= totalPages} className={cn(outline, "disabled:invisible")}>
            {t("next")}
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      )}
    </div>
  );
}

function ToLetCardView({ listing: l }: { listing: ToLetCard }) {
  const t = useTranslations("ToLet");
  const locale = useLocale();
  const format = useFormatter();
  const cover = safeMediaUrl(l.cover?.thumbUrl) ?? safeMediaUrl(l.cover?.url);
  return (
    <Link href={`/to-let/${l.slug}`} className="group lift flex h-full flex-col overflow-hidden rounded-md border border-line bg-card shadow-card hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
      <span className="relative block aspect-4/3 bg-highlight-soft">
        {cover ? (
          <Image src={cover} alt="" fill unoptimized sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" />
        ) : (
          <KeyRound className="absolute inset-0 m-auto size-10 text-highlight" strokeWidth={1.25} aria-hidden />
        )}
        <span className="type-caption absolute top-3 left-3 rounded-full bg-brand px-2.5 py-0.5 text-primary-foreground">{t("badge")}</span>
        {l.photoCount > 1 && (
          <span className="type-caption absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-ink/70 px-2 py-0.5 text-primary-foreground">
            <Images className="size-3.5" aria-hidden />
            {l.photoCount}
          </span>
        )}
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="type-body-medium line-clamp-2 text-ink group-hover:text-brand">{l.title}</span>
        <span className="type-caption truncate text-ink-muted">{l.addressLine}</span>
        <span className="mt-auto flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-1">
          <span className="type-price text-brand">{t("perMonth", { rent: formatTaka(l.monthlyRent, locale) })}</span>
          <span className="type-caption inline-flex items-center gap-1 text-ink-secondary">
            <Ruler className="size-3.5" aria-hidden />
            {t("sqft", { size: format.number(l.sizeSqft) })}
          </span>
          {l.availableFrom && (
            <span className="type-caption inline-flex items-center gap-1 text-ink-secondary">
              <CalendarDays className="size-3.5" aria-hidden />
              {t("from", { date: format.dateTime(new Date(`${l.availableFrom}T12:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" }) })}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
