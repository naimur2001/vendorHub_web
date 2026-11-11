"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, GitMerge, LoaderCircle, Pencil, Plus, Search, X,Image as ImageIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState, type FormEvent } from "react";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import {
  createProduct,
  listAdminProducts,
  listBrands,
  listCategories,
  mergeProduct,
  productKeys,
  reviewProduct,
  updateProduct,
  type AdminProduct,
  type CatalogCategory,
  type ProductInput,
  type ProductQuery,
} from "@/lib/api/admin";
import { parseAmount } from "@/lib/api/bargains";
import { ApiError } from "@/lib/api/core";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProductPhotos } from "@/components/admin/product-photos";



type Filter = "ACTIVE" | "INACTIVE" | "ALL";
type Panel = { kind: "add" } | { kind: "edit"; product: AdminProduct } | { kind: "merge"; product: AdminProduct } | { kind: "photos"; product: AdminProduct } | null;
type SpecRow = { key: string; value: string };

const inputClass =
  "type-body h-11 w-full rounded-md border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";

// Roots and subcategories as one list: "Phones › Smartphones".
function flatten(categories: CatalogCategory[]): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const c of categories) {
    out.push({ id: c.id, label: c.name });
    for (const child of c.children ?? []) out.push({ id: child.id, label: `${c.name} › ${child.name}` });
  }
  return out;
}

function errorKey(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400 || err.status === 409) return "errors.invalid";
    if (err.status === 0) return "errors.network";
  }
  return "errors.generic";
}

// ---------- Add / edit ----------

function ProductForm({
  product,
  categories,
  brands,
  onSaved,
  onCancel,
}: {
  product?: AdminProduct;
  categories: { id: string; label: string }[];
  brands: { id: string; name: string }[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("AdminProducts");
  const ids = { category: useId(), brand: useId(), description: useId() };

  const [title, setTitle] = useState(product?.title ?? "");
  const [categoryId, setCategoryId] = useState(product?.category.id ?? "");
  const [brandId, setBrandId] = useState(product?.brand?.id ?? "");
  const [msrp, setMsrp] = useState(product?.msrp != null ? String(product.msrp) : "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [specs, setSpecs] = useState<SpecRow[]>(
    Object.entries(product?.specs ?? {}).map(([key, value]) => ({ key, value: String(value) })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (input: ProductInput) => (product ? updateProduct(product.id, input) : createProduct(input)),
    onSuccess: onSaved,
    onError: (err) => setErrors({ form: t(errorKey(err)) }),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    const tt = title.trim();
    if (tt.length < 3 || tt.length > 200) next.title = t("errors.title");
    if (!categoryId) next.category = t("errors.category");
    const price = msrp.trim() ? parseAmount(msrp) : null;
    if (msrp.trim() && price === null) next.msrp = t("errors.msrp");
    if (description.length > 5000) next.description = t("errors.description");
    const rows = specs.filter((s) => s.key.trim() || s.value.trim());
    if (rows.some((s) => !s.key.trim() || !s.value.trim() || s.key.trim().length > 40 || s.value.trim().length > 100)) next.specs = t("errors.specs");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    save.mutate({
      title: tt,
      categoryId,
      brandId: brandId || null,
      msrp: price,
      description: description.trim() || null,
      specs: Object.fromEntries(rows.map((s) => [s.key.trim(), s.value.trim()])),
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <TextField label={t("form.title")} placeholder={t("form.titlePlaceholder")} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.category} className="type-body-medium text-ink">{t("form.category")}</label>
        <select id={ids.category} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
          <option value="">{t("form.chooseCategory")}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        {errors.category && <p className="type-caption text-error">{errors.category}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.brand} className="type-body-medium text-ink">{t("form.brand")}</label>
        <select id={ids.brand} value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inputClass}>
          <option value="">{t("noBrand")}</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <TextField label={t("form.msrp")} inputMode="numeric" maxLength={12} value={msrp} onChange={(e) => setMsrp(e.target.value)} error={errors.msrp} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.description} className="type-body-medium text-ink">{t("form.description")}</label>
        <textarea id={ids.description} rows={4} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} className="type-body w-full rounded-md border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none" />
        {errors.description && <p className="type-caption text-error">{errors.description}</p>}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="type-body-medium mb-1 text-ink">{t("form.specs")}</legend>
        {specs.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input aria-label={t("form.specName")} placeholder={t("form.specName")} maxLength={40} value={row.key} onChange={(e) => setSpecs((s) => s.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))} className={inputClass} />
            <input aria-label={t("form.specValue")} placeholder={t("form.specValue")} maxLength={100} value={row.value} onChange={(e) => setSpecs((s) => s.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))} className={inputClass} />
            <button type="button" aria-label={t("form.removeSpec")} onClick={() => setSpecs((s) => s.filter((_, j) => j !== i))} className="flex size-11 items-center justify-center rounded-sm text-ink-muted hover:bg-subtle hover:text-error">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
        {specs.length < 20 && (
          <button type="button" onClick={() => setSpecs((s) => [...s, { key: "", value: "" }])} className="type-body-medium flex h-10 items-center gap-1 self-start rounded-sm px-2 text-brand hover:bg-subtle">
            <Plus className="size-4" aria-hidden />
            {t("form.addSpec")}
          </button>
        )}
        {errors.specs && <p className="type-caption text-error">{errors.specs}</p>}
      </fieldset>

      {!product && <p className="type-caption text-ink-muted">{t("form.slugNote")}</p>}
      {errors.form && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {errors.form}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} disabled={save.isPending} className="type-body-medium flex h-12 items-center justify-center rounded-sm border border-ink px-4 text-ink hover:bg-subtle">
          {t("form.cancel")}
        </button>
        <button type="submit" disabled={save.isPending} className="type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover disabled:opacity-60">
          {save.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {save.isPending ? t("form.saving") : product ? t("form.save") : t("form.create")}
        </button>
      </div>
    </form>
  );
}

// ---------- Merge a duplicate ----------

/** Moves all listings of a duplicate to the product to keep, then switches the duplicate off. */
function MergePanel({ product, onDone, onCancel }: { product: AdminProduct; onDone: () => void; onCancel: () => void }) {
  const t = useTranslations("AdminProductReview");
  const searchId = useId();
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const [target, setTarget] = useState<AdminProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  const results = useQuery({
    queryKey: ["admin", "merge-search", term],
    queryFn: () => listAdminProducts({ q: term, isActive: true, page: 1, limit: 8 }),
    enabled: term.length >= 2,
  });
  const options = (results.data?.data ?? []).filter((p) => p.id !== product.id);

  const merge = useMutation({
    mutationFn: () => mergeProduct(product.id, target?.id ?? ""),
    onSuccess: onDone,
    onError: () => setError(t("error")),
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="type-body text-ink-secondary">{t("mergeText", { product: product.title })}</p>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(text.replace(/\p{Cc}/gu, "").trim().slice(0, 100));
        }}
        className="flex flex-col gap-1.5"
      >
        <label htmlFor={searchId} className="type-body-medium text-ink">{t("mergeSearch")}</label>
        <div className="flex gap-2">
          <input id={searchId} type="search" maxLength={100} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("mergeSearchPlaceholder")} className={inputClass} />
          <button type="submit" className="type-body-medium h-11 shrink-0 rounded-sm border border-brand px-3 text-brand hover:bg-subtle">{t("search")}</button>
        </div>
      </form>

      {term.length >= 2 && results.data && options.length === 0 && <p className="type-body text-ink-secondary">{t("noResults")}</p>}
      {options.length > 0 && (
        <ul className="flex flex-col gap-2">
          {options.map((p) => (
            <li key={p.id} className={cn("flex items-center justify-between gap-2 rounded-md border p-2", target?.id === p.id ? "border-brand bg-highlight-soft/40" : "border-line")}>
              <span className="type-body min-w-0 truncate text-ink">{p.title}</span>
              <button type="button" onClick={() => setTarget(p)} className="type-body-medium shrink-0 rounded-sm border border-brand px-2 py-1 text-brand hover:bg-subtle">{t("choose")}</button>
            </li>
          ))}
        </ul>
      )}

      {target && <p className="type-body-medium text-ink">{t("chosen", { product: target.title })}</p>}
      {error && <p role="alert" className="type-body text-error">{error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} disabled={merge.isPending} className="type-body-medium flex h-12 items-center justify-center rounded-sm border border-ink px-4 text-ink hover:bg-subtle">{t("cancel")}</button>
        <button type="button" onClick={() => merge.mutate()} disabled={!target || merge.isPending} className="type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover disabled:opacity-50">
          {merge.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {merge.isPending ? t("merging") : t("confirm")}
        </button>
      </div>
    </div>
  );
}

// ---------- The page ----------

export function ProductsManager() {
  const t = useTranslations("AdminProducts");
  const tR = useTranslations("AdminProductReview");
  const tPhotos = useTranslations("ProductPhotos");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const searchId = useId();

  const [text, setText] = useState("");
  const [query, setQuery] = useState<ProductQuery>({ isActive: true, page: 1, limit: 20 });
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const products = useQuery({ queryKey: productKeys.list(query), queryFn: () => listAdminProducts(query), placeholderData: keepPreviousData });
  const categoriesQ = useQuery({ queryKey: productKeys.categories, queryFn: listCategories, staleTime: 5 * 60_000 });
  const brandsQ = useQuery({ queryKey: productKeys.brands, queryFn: listBrands, staleTime: 5 * 60_000 });
  const categories = useMemo(() => flatten(categoriesQ.data ?? []), [categoriesQ.data]);
  const brands = brandsQ.data ?? [];

  const refresh = (text: string) => {
    setNotice(text);
    void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
  };

  const toggle = useMutation({
    mutationFn: (p: AdminProduct) => updateProduct(p.id, { isActive: !p.isActive }),
    onSuccess: () => refresh(t("saved")),
  });
  const review = useMutation({
    mutationFn: (id: string) => reviewProduct(id),
    onSuccess: () => refresh(tR("reviewed")),
  });

  const filter: Filter = query.isActive === undefined ? "ALL" : query.isActive ? "ACTIVE" : "INACTIVE";
  const setFilter = (f: Filter) => setQuery((q) => ({ ...q, page: 1, isActive: f === "ALL" ? undefined : f === "ACTIVE" }));
  const reviewOnly = query.source === "SHOP" && query.reviewed === false;
  const rows = products.data?.data ?? [];
  const total = products.data?.meta?.pagination?.total ?? rows.length;
  const totalPages = products.data?.meta?.pagination?.totalPages ?? 1;

  function closeAnd(text: string) {
    setPanel(null);
    refresh(text);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery((q) => ({ ...q, page: 1, q: text.replace(/\p{Cc}/gu, "").trim().slice(0, 100) || undefined }));
          }}
          className="flex flex-1 gap-2"
        >
          <label htmlFor={searchId} className="sr-only">{t("searchLabel")}</label>
          <input id={searchId} type="search" maxLength={100} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("searchPlaceholder")} className={inputClass} />
          <button type="submit" className="type-body-medium flex h-11 shrink-0 items-center gap-2 rounded-sm border border-brand px-3 text-brand hover:bg-subtle">
            <Search className="size-4" aria-hidden />
            {t("search")}
          </button>
        </form>
        <select
          aria-label={t("form.category")}
          value={query.categoryId ?? ""}
          onChange={(e) => setQuery((q) => ({ ...q, page: 1, categoryId: e.target.value || undefined }))}
          className={cn(inputClass, "lg:w-64")}
        >
          <option value="">{t("allCategories")}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setPanel({ kind: "add" });
          }}
          className="type-body-medium flex h-11 shrink-0 items-center justify-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover"
        >
          <Plus className="size-5" aria-hidden />
          {t("add")}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["ACTIVE", "INACTIVE", "ALL"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn("type-body-medium flex h-10 items-center rounded-full border px-4", filter === f ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand")}
          >
            {t(`filters.${f}`)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={reviewOnly}
          onClick={() => setQuery((q) => ({ ...q, page: 1, source: reviewOnly ? undefined : "SHOP", reviewed: reviewOnly ? undefined : false }))}
          className={cn("type-body-medium flex h-10 items-center rounded-full border px-4", reviewOnly ? "border-highlight bg-highlight text-primary-foreground" : "border-highlight text-highlight hover:bg-highlight-soft")}
        >
          {tR("filter")}
        </button>
      </div>

      {notice && (
        <p role="status" className="type-body flex items-center gap-2 text-success-ink">
          <CircleCheck className="size-4" aria-hidden />
          {notice}
        </p>
      )}

      {products.isPending ? (
        <OwnerSkeleton label={t("loading")} />
      ) : products.isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center">
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => products.refetch()} className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand">{t("retry")}</button>
        </div>
      ) : rows.length === 0 ? (
        <p className="type-body rounded-md border border-line bg-card px-6 py-12 text-center text-ink-secondary">{t("empty")}</p>
      ) : (
        <>
          <p className="type-body text-ink-secondary">{t("count", { count: total })}</p>
          <ul className={cn("flex flex-col gap-3 transition-opacity", products.isPlaceholderData && "opacity-60")}>
            {rows.map((p) => (
              <li key={p.id} className={cn("flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card md:flex-row md:items-center", !p.isActive && "opacity-70")}>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h2 className="type-body-medium text-ink">{p.title}</h2>
                  <p className="type-caption text-ink-muted">{[p.brand?.name ?? t("noBrand"), p.category.name].join(" · ")}</p>
                  <p className="type-caption text-ink-secondary">
                    {p.msrp != null && `${t("msrp", { amount: formatTaka(p.msrp, locale) })} · `}
                    {t("shopsSelling", { count: p.activeListings })}
                    {!p.isActive && ` · ${t("off")}`}
                  </p>
                  {p.source === "SHOP" && (
                    <div className="flex flex-wrap gap-1.5">
                      {p.createdBy && <span className="type-caption rounded-full bg-info-soft px-2 py-0.5 text-verified">{tR("fromShop", { shop: p.createdBy.name })}</span>}
                      {!p.reviewedAt && <span className="type-caption rounded-full bg-highlight-soft px-2 py-0.5 text-highlight">{tR("notReviewed")}</span>}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setPanel({ kind: "edit", product: p });
                    }}
                    className="type-body-medium flex h-10 items-center gap-1.5 rounded-sm border border-brand px-3 text-brand hover:bg-subtle"
                  >
                    <Pencil className="size-4" aria-hidden />
                    {t("edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setPanel({ kind: "photos", product: p });
                    }}
                    className="type-body-medium flex h-10 items-center gap-1.5 rounded-sm px-3 text-ink-secondary hover:bg-subtle"
                  >
                    <ImageIcon className="size-4" aria-hidden />
                    {tPhotos("button")}
                  </button>
                  


                  
                  {p.source === "SHOP" && !p.reviewedAt && (
                    <button type="button" onClick={() => review.mutate(p.id)} disabled={review.isPending} className="type-body-medium flex h-10 items-center gap-1.5 rounded-sm px-3 text-success-ink hover:bg-success-soft disabled:opacity-60">
                      <BadgeCheck className="size-4" aria-hidden />
                      {tR("markReviewed")}
                    </button>
                  )}
                  {p.isActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setNotice(null);
                        setPanel({ kind: "merge", product: p });
                      }}
                      className="type-body-medium flex h-10 items-center gap-1.5 rounded-sm px-3 text-ink-secondary hover:bg-subtle"
                    >
                      <GitMerge className="size-4" aria-hidden />
                      {tR("merge")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggle.mutate(p)}
                    disabled={toggle.isPending}
                    title={p.isActive ? t("switchOffNote") : undefined}
                    className={cn("type-body-medium flex h-10 items-center rounded-sm px-3 disabled:opacity-60", p.isActive ? "text-error hover:bg-error-soft" : "text-success-ink hover:bg-success-soft")}
                  >
                    {p.isActive ? t("switchOff") : t("switchOn")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3 border-t border-gold pt-5">
          <button type="button" onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))} disabled={query.page <= 1} className="type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand disabled:invisible">
            <ChevronLeft className="size-4" aria-hidden />
            {t("previous")}
          </button>
          <span className="type-body text-ink-secondary">{t("pageOf", { page: query.page, total: totalPages })}</span>
          <button type="button" onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))} disabled={query.page >= totalPages} className="type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand disabled:invisible">
            {t("next")}
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      )}

      <Sheet open={panel !== null} onOpenChange={(open) => !open && setPanel(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="type-h3 text-ink">
              {panel?.kind === "edit" ? t("form.editTitle") : panel?.kind === "merge" ? tR("mergeTitle") : panel?.kind === "photos" ? tPhotos("title") : t("form.addTitle")}
            </SheetTitle>
            <SheetDescription className="type-caption text-ink-muted">{t("subtitle")}</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            {panel?.kind === "add" && <ProductForm categories={categories} brands={brands} onSaved={() => closeAnd(t("saved"))} onCancel={() => setPanel(null)} />}
            {panel?.kind === "edit" && (
              <ProductForm key={panel.product.id} product={panel.product} categories={categories} brands={brands} onSaved={() => closeAnd(t("saved"))} onCancel={() => setPanel(null)} />
            )}
            {panel?.kind === "merge" && <MergePanel product={panel.product} onCancel={() => setPanel(null)} onDone={() => closeAnd(tR("merged"))} />}
            {panel?.kind === "photos" && <ProductPhotos key={panel.product.id} product={panel.product} onChanged={() => setNotice(t("saved"))} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}