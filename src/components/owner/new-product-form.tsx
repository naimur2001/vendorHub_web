"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleAlert, ImagePlus, LoaderCircle, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { TextField } from "@/components/ui/text-field";
import { listBrands, listCategories, productKeys } from "@/lib/api/admin";
import { parseAmount } from "@/lib/api/bargains";
import { ApiError } from "@/lib/api/core";
import {
  createShopProduct,
  findSimilarProducts,
  uploadShopProductPhoto,
  type CatalogPick,
  type ManualAvailability,
  type NewProductInput,
} from "@/lib/api/listings";
import { cn } from "@/lib/utils";

const inputClass =
  "type-body h-11 w-full rounded-md border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("not an image"));
    img.src = src;
  });
}

function apiErrorKey(err: unknown, photo = false): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return "errors.rateLimit";
    if (err.status === 413) return "errors.photoSize";
    if (err.status === 422) return "errors.photoSmall";
    if (err.status === 400) return photo ? "errors.photoRejected" : "errors.invalid";
    if (err.status === 0) return "errors.network";
  }
  return "errors.generic";
}

/** Step 2: add up to 6 photos to the new product (uploaded one by one). */
function PhotoStep({ shopId, productId, onDone }: { shopId: string; productId: string; onDone: () => void }) {
  const t = useTranslations("OwnerNewProduct");
  const inputId = useId();
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: ({ file }: { file: File; preview: string }) => uploadShopProductPhoto(shopId, productId, file),
    onSuccess: (_r, vars) => setPreviews((p) => [...p, vars.preview]),
    onError: (err) => setError(t(apiErrorKey(err, true))),
  });

  async function pick(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (previews.length >= 6) return setError(t("errors.photoLimit"));
    if (!PHOTO_TYPES.includes(file.type)) return setError(t("errors.photoType"));
    if (file.size > 5 * 1024 * 1024) return setError(t("errors.photoSize"));
    try {
      const preview = await readAsDataUrl(file);
      const { width, height } = await imageSize(preview);
      if (width < 480 || height < 270) return setError(t("errors.photoSmall"));
      upload.mutate({ file, preview });
    } catch {
      setError(t("errors.photoRead"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="type-body text-success-ink">{t("photosIntro")}</p>
      {previews.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {previews.map((src, i) => (
            <li key={i}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of an uploaded photo */}
              <img src={src} alt={t("photoAlt", { n: i + 1 })} className="aspect-square w-full rounded-sm border border-line object-cover" />
            </li>
          ))}
        </ul>
      )}
      {previews.length < 6 && (
        <label
          htmlFor={inputId}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void pick(e.dataTransfer.files?.[0]);
          }}
          className="flex cursor-pointer flex-col items-center gap-1 rounded-md border-2 border-dashed border-line-strong bg-surface p-5 text-center hover:border-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
        >
          {upload.isPending ? <LoaderCircle className="size-7 animate-spin text-highlight" aria-hidden /> : <ImagePlus className="size-7 text-highlight" aria-hidden />}
          <span className="type-body-medium text-brand">{upload.isPending ? t("uploading") : t("choose")}</span>
          <span className="type-caption text-ink-muted">{t("drop")}</span>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={upload.isPending}
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {previews.length > 0 && <p className="type-caption text-ink-muted">{t("uploaded", { count: previews.length })}</p>}
      {error && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      <button type="button" onClick={onDone} disabled={upload.isPending} className="type-body-medium flex h-12 items-center justify-center rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover disabled:opacity-60">
        {t("done")}
      </button>
    </div>
  );
}

type Props = { shopId: string; onUseExisting: (product: CatalogPick) => void; onDone: () => void; onCancel: () => void };

/** A shop adds a product that isn't in the catalog, with its own offer, then photos. */
export function NewProductForm({ shopId, onUseExisting, onDone, onCancel }: Props) {
  const t = useTranslations("OwnerNewProduct");
  const tL = useTranslations("OwnerListings");
  const ids = { category: useId(), brand: useId(), description: useId(), availability: useId() };

  const [created, setCreated] = useState<{ id: string } | null>(null);
  const [title, setTitle] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [msrp, setMsrp] = useState("");
  const [description, setDescription] = useState("");
  const [specs, setSpecs] = useState<{ key: string; value: string }[]>([]);
  const [price, setPrice] = useState("");
  const [track, setTrack] = useState(true);
  const [stock, setStock] = useState("");
  const [manual, setManual] = useState<ManualAvailability>("AVAILABLE");
  const [offers, setOffers] = useState(false);
  const [minOffer, setMinOffer] = useState("92");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Suggest existing catalog products while typing the name (prevents duplicates).
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(title.trim()), 400);
    return () => clearTimeout(timer);
  }, [title]);
  const similar = useQuery({
    queryKey: ["owner", "similar", shopId, debounced],
    queryFn: () => findSimilarProducts(shopId, debounced),
    enabled: !created && debounced.length >= 4,
  });

  const categoriesQ = useQuery({ queryKey: productKeys.categories, queryFn: listCategories, staleTime: 5 * 60_000 });
  const brandsQ = useQuery({ queryKey: productKeys.brands, queryFn: listBrands, staleTime: 5 * 60_000 });
  const categories = useMemo(() => {
    const out: { id: string; label: string }[] = [];
    for (const c of categoriesQ.data ?? []) {
      out.push({ id: c.id, label: c.name });
      for (const ch of c.children ?? []) out.push({ id: ch.id, label: `${c.name} › ${ch.name}` });
    }
    return out;
  }, [categoriesQ.data]);

  const save = useMutation({
    mutationFn: (input: NewProductInput) => createShopProduct(shopId, input),
    onSuccess: (r) => setCreated({ id: r.product.id }),
    onError: (err) => setErrors({ form: t(apiErrorKey(err)) }),
  });

  if (created) return <PhotoStep shopId={shopId} productId={created.id} onDone={onDone} />;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    const name = title.trim();
    if (name.length < 3 || name.length > 200) next.name = t("errors.name");
    if (!categoryId) next.category = t("errors.category");
    const official = msrp.trim() ? parseAmount(msrp) : null;
    if (msrp.trim() && official === null) next.msrp = t("errors.msrp");
    if (description.length > 5000) next.description = t("errors.description");
    const rows = specs.filter((s) => s.key.trim() || s.value.trim());
    if (rows.some((s) => !s.key.trim() || !s.value.trim() || s.key.trim().length > 40 || s.value.trim().length > 100)) next.specs = t("errors.specs");
    const priceValue = parseAmount(price);
    if (priceValue === null || priceValue < 1) next.price = tL("errors.price");
    const stockValue = parseAmount(stock);
    if (track && (stockValue === null || stockValue > 100_000)) next.stock = tL("errors.stock");
    const minValue = parseAmount(minOffer);
    if (offers && (minValue === null || minValue < 50 || minValue > 100)) next.minOffer = tL("errors.minOffer");
    setErrors(next);
    if (Object.keys(next).length > 0 || priceValue === null) return;

    save.mutate({
      title: name,
      categoryId,
      ...(brandId && { brandId }),
      ...(description.trim() && { description: description.trim() }),
      ...(rows.length > 0 && { specs: Object.fromEntries(rows.map((s) => [s.key.trim(), s.value.trim()])) }),
      ...(official !== null && { msrp: official }),
      listing: {
        price: priceValue,
        stockQty: track ? (stockValue ?? 0) : null,
        ...(!track && { availability: manual }),
        bargainEnabled: offers,
        minOfferPercent: offers ? (minValue ?? 92) : 92,
      },
    });
  }

  const matches = similar.data ?? [];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="type-caption text-ink-muted">{t("intro")}</p>
      <h3 className="type-body-medium border-b border-line pb-1 text-ink">{t("productSection")}</h3>

      <TextField label={t("name")} placeholder={t("namePlaceholder")} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} error={errors.name} />

      {matches.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-highlight bg-highlight-soft/40 p-3">
          <p className="type-body-medium text-ink">{t("similarTitle")}</p>
          <p className="type-caption text-ink-secondary">{t("similarText")}</p>
          <ul className="flex flex-col gap-1.5">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span className="type-body min-w-0 truncate text-ink">{m.title}</span>
                <button
                  type="button"
                  onClick={() => onUseExisting({ id: m.id, slug: m.slug, title: m.title, brand: m.brand?.name ?? null, image: m.image ?? null })}
                  className="type-body-medium shrink-0 rounded-sm border border-brand px-2 py-1 text-brand hover:bg-subtle"
                >
                  {t("useThis")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.category} className="type-body-medium text-ink">{t("category")}</label>
        <select id={ids.category} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
          <option value="">{t("chooseCategory")}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        {errors.category && <p className="type-caption text-error">{errors.category}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.brand} className="type-body-medium text-ink">{t("brand")}</label>
        <select id={ids.brand} value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inputClass}>
          <option value="">{t("noBrand")}</option>
          {(brandsQ.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <TextField label={t("msrp")} inputMode="numeric" maxLength={12} value={msrp} onChange={(e) => setMsrp(e.target.value)} error={errors.msrp} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.description} className="type-body-medium text-ink">{t("description")}</label>
        <textarea id={ids.description} rows={3} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} className="type-body w-full rounded-md border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none" />
        {errors.description && <p className="type-caption text-error">{errors.description}</p>}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="type-body-medium mb-1 text-ink">{t("specs")}</legend>
        {specs.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input aria-label={t("specName")} placeholder={t("specName")} maxLength={40} value={row.key} onChange={(e) => setSpecs((s) => s.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))} className={inputClass} />
            <input aria-label={t("specValue")} placeholder={t("specValue")} maxLength={100} value={row.value} onChange={(e) => setSpecs((s) => s.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))} className={inputClass} />
            <button type="button" aria-label={t("removeSpec")} onClick={() => setSpecs((s) => s.filter((_, j) => j !== i))} className="flex size-11 items-center justify-center rounded-sm text-ink-muted hover:text-error">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
        {specs.length < 20 && (
          <button type="button" onClick={() => setSpecs((s) => [...s, { key: "", value: "" }])} className="type-body-medium flex h-10 items-center gap-1 self-start px-2 text-brand">
            <Plus className="size-4" aria-hidden />
            {t("addSpec")}
          </button>
        )}
        {errors.specs && <p className="type-caption text-error">{errors.specs}</p>}
      </fieldset>

      <h3 className="type-body-medium border-b border-line pb-1 text-ink">{t("offerSection")}</h3>
      <TextField label={tL("form.price")} inputMode="numeric" maxLength={12} value={price} onChange={(e) => setPrice(e.target.value)} error={errors.price} />

      <div className="grid grid-cols-2 gap-2">
        {[true, false].map((v) => (
          <button key={String(v)} type="button" aria-pressed={track === v} onClick={() => setTrack(v)} className={cn("type-body-medium h-11 rounded-md border px-2", track === v ? "border-brand bg-highlight-soft/40 text-ink" : "border-line-strong text-ink-secondary")}>
            {v ? tL("form.track") : tL("form.untracked")}
          </button>
        ))}
      </div>
      {track ? (
        <TextField label={tL("form.stockQty")} inputMode="numeric" maxLength={7} value={stock} onChange={(e) => setStock(e.target.value)} error={errors.stock} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.availability} className="type-body-medium text-ink">{tL("form.availability")}</label>
          <select id={ids.availability} value={manual} onChange={(e) => setManual(e.target.value as ManualAvailability)} className={inputClass}>
            {(["AVAILABLE", "LIMITED", "OUT_OF_STOCK"] as ManualAvailability[]).map((a) => <option key={a} value={a}>{tL(`availability.${a}`)}</option>)}
          </select>
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-line-strong p-3">
        <input type="checkbox" checked={offers} onChange={(e) => setOffers(e.target.checked)} className="size-5 accent-brand" />
        <span className="type-body-medium text-ink">🤝 {tL("form.offers")}</span>
      </label>
      {offers && (
        <TextField label={tL("form.minOffer")} hint={tL("form.minOfferHint")} inputMode="numeric" maxLength={3} value={minOffer} onChange={(e) => setMinOffer(e.target.value)} error={errors.minOffer} />
      )}

      {errors.form && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {errors.form}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} disabled={save.isPending} className="type-body-medium flex h-12 items-center justify-center rounded-sm border border-ink px-4 text-ink hover:bg-subtle">
          {t("cancel")}
        </button>
        <button type="submit" disabled={save.isPending} className="type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover disabled:opacity-60">
          {save.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {save.isPending ? t("saving") : t("create")}
        </button>
      </div>
    </form>
  );
}