"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, ExternalLink, ImagePlus, LoaderCircle, MapPin, Pencil, Plus, Store, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState, type DragEvent, type FormEvent } from "react";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { Link } from "@/i18n/routing";
import {
  createMarket,
  deleteMarket,
  getMarketLocation,
  listAllMarkets,
  marketKeys,
  removeMarketImage,
  updateMarket,
  uploadMarketImage,
  type AdminMarket,
  type MarketInput,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/core";
import { safeMediaUrl } from "@/lib/api/storefront";
import { cn } from "@/lib/utils";

type Panel = { kind: "add" } | { kind: "edit"; market: AdminMarket; justCreated?: boolean } | null;

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_MIN = { width: 800, height: 450 };

/** "23.8133, 90.4243" -> numbers; "" -> null (no location); anything else -> "invalid". */
function parseLocation(text: string): { latitude: number; longitude: number } | null | "invalid" {
  const s = text.trim();
  if (!s) return null;
  const m = s.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return "invalid";
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return "invalid";
  return { latitude, longitude };
}

function errorKey(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return "errors.hasShops";
    if (err.status === 404) return "errors.gone";
    if (err.status === 400) return "errors.invalid";
    if (err.status === 0) return "errors.network";
  }
  return "errors.generic";
}

function photoErrorKey(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 413) return "errors.size";
    if (err.status === 422) return "errors.small";
    if (err.status === 400) return "errors.rejected";
    if (err.status === 429) return "errors.rateLimit";
    if (err.status === 0) return "errors.network";
  }
  return "errors.generic";
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
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

/** The market photo: current one, a drop zone, a preview before upload, replace and remove. */
function PhotoField({ marketId, marketName }: { marketId: string; marketName: string }) {
  const t = useTranslations("AdminMarketPhoto");
  const inputId = useId();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<{ file: File; preview: string } | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);

  // The current photo comes from the (fresh) admin market list.
  const markets = useQuery({ queryKey: marketKeys.all, queryFn: listAllMarkets });
  const current = markets.data?.find((m) => m.id === marketId)?.image ?? null;
  const currentUrl = safeMediaUrl(current?.url ?? null);

  function changed(text: string) {
    setPicked(null);
    setMessage({ kind: "ok", text });
    void queryClient.invalidateQueries({ queryKey: ["admin", "markets"] });
  }

  const upload = useMutation({
    mutationFn: (file: File) => uploadMarketImage(marketId, file),
    onSuccess: () => changed(t("uploaded")),
    onError: (err) => setMessage({ kind: "error", text: t(photoErrorKey(err)) }),
  });
  const remove = useMutation({
    mutationFn: () => removeMarketImage(marketId),
    onSuccess: () => changed(t("removed")),
    onError: (err) => setMessage({ kind: "error", text: t(photoErrorKey(err)) }),
  });
  const busy = upload.isPending || remove.isPending;

  // Quick checks in the browser (the server checks again, properly).
  async function pick(file: File | undefined) {
    setMessage(null);
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return setMessage({ kind: "error", text: t("errors.type") });
    if (file.size > PHOTO_MAX_BYTES) return setMessage({ kind: "error", text: t("errors.size") });
    try {
      const preview = await readAsDataUrl(file);
      const { width, height } = await imageSize(preview);
      if (width < PHOTO_MIN.width || height < PHOTO_MIN.height) return setMessage({ kind: "error", text: t("errors.small") });
      setPicked({ file, preview });
    } catch {
      setMessage({ kind: "error", text: t("errors.read") });
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void pick(event.dataTransfer.files?.[0]);
  }

  return (
    <section className="flex flex-col gap-3 border-b border-line pb-4">
      <h3 className="type-body-medium text-ink">{t("title")}</h3>

      {picked ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview from memory, not uploaded yet */}
          <img src={picked.preview} alt={t("previewAlt")} className="aspect-video w-full rounded-md border border-line object-cover" />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPicked(null)}
              disabled={busy}
              className="type-body-medium flex h-11 items-center justify-center rounded-sm border border-ink px-3 text-ink hover:bg-subtle"
            >
              {t("chooseAnother")}
            </button>
            <button
              type="button"
              onClick={() => upload.mutate(picked.file)}
              disabled={busy}
              aria-busy={upload.isPending}
              className="type-body-medium flex h-11 items-center justify-center gap-2 rounded-sm bg-action px-3 text-primary-foreground hover:bg-action-hover disabled:opacity-60"
            >
              {upload.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {upload.isPending ? t("uploading") : t("upload")}
            </button>
          </div>
        </>
      ) : (
        <>
          {currentUrl ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-md border border-line">
              <Image src={currentUrl} alt={t("currentAlt", { market: marketName })} fill unoptimized sizes="28rem" className="object-cover" />
            </div>
          ) : (
            <p className="type-caption text-ink-muted">{t("noPhoto")}</p>
          )}

          <label
            htmlFor={inputId}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1 rounded-md border-2 border-dashed p-5 text-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand",
              dragging ? "border-brand bg-highlight-soft/50" : "border-line-strong bg-surface hover:border-brand",
            )}
          >
            <ImagePlus className="size-7 text-highlight" aria-hidden />
            <span className="type-body-medium text-brand">{t("choose")}</span>
            <span className="type-caption text-ink-muted">{t("drop")}</span>
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = ""; // the same file can be chosen again
              }}
            />
          </label>

          {current && (
            <button
              type="button"
              onClick={() => remove.mutate()}
              disabled={busy}
              className="type-body-medium flex h-10 items-center gap-2 self-start rounded-sm px-2 text-error hover:bg-error-soft disabled:opacity-60"
            >
              {remove.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
              {remove.isPending ? t("removing") : t("remove")}
            </button>
          )}
        </>
      )}

      <p className="type-caption text-ink-muted">{t("hint")}</p>

      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={cn("type-body flex items-start gap-2", message.kind === "error" ? "text-error" : "text-success-ink")}>
          {message.kind === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {message.text}
        </p>
      )}
    </section>
  );
}

type FormProps = { market?: AdminMarket; onSaved: (saved: AdminMarket) => void; onCancel: () => void };

/** Add or edit one market's details. */
function MarketForm({ market, onSaved, onCancel }: FormProps) {
  const t = useTranslations("AdminMarkets");

  // When editing, load the saved location first (the list doesn't include it).
  const location = useQuery({
    queryKey: marketKeys.location(market?.slug ?? ""),
    queryFn: () => getMarketLocation(market?.slug ?? ""),
    enabled: Boolean(market),
  });

  const [name, setName] = useState(market?.name ?? "");
  const [city, setCity] = useState(market?.city ?? "Dhaka");
  const [address, setAddress] = useState(market?.address ?? "");
  const [place, setPlace] = useState<string | null>(null); // null = not edited: show the saved location
  const [errors, setErrors] = useState<Partial<Record<"name" | "city" | "address" | "location" | "form", string>>>({});

  const saved = location.data && location.data.latitude !== null && location.data.longitude !== null ? `${location.data.latitude}, ${location.data.longitude}` : "";
  const placeText = place ?? saved;

  const save = useMutation({
    mutationFn: (input: MarketInput) => (market ? updateMarket(market.id, input) : createMarket(input)),
    onSuccess: onSaved,
    onError: (err) => setErrors({ form: t(errorKey(err)) }),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    const n = name.trim();
    const c = city.trim();
    const a = address.trim();
    const loc = parseLocation(placeText);
    if (n.length < 2 || n.length > 100) next.name = t("errors.name");
    if (c.length < 2 || c.length > 60) next.city = t("errors.city");
    if (a.length > 200) next.address = t("errors.address");
    if (loc === "invalid") next.location = t("errors.location");
    setErrors(next);
    if (Object.keys(next).length > 0 || loc === "invalid") return;

    // Create: leave out empty optional fields. Edit: send null to clear them.
    const input: MarketInput = market
      ? { name: n, city: c, address: a || null, latitude: loc?.latitude ?? null, longitude: loc?.longitude ?? null }
      : { name: n, city: c, ...(a && { address: a }), ...(loc && { latitude: loc.latitude, longitude: loc.longitude }) };
    save.mutate(input);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <TextField label={t("form.name")} placeholder={t("form.namePlaceholder")} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
      <TextField label={t("form.city")} maxLength={60} value={city} onChange={(e) => setCity(e.target.value)} error={errors.city} />
      <TextField label={t("form.address")} placeholder={t("form.addressPlaceholder")} maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} error={errors.address} />
      <TextField
        label={t("form.location")}
        placeholder={market && location.isPending ? t("form.loadingLocation") : t("form.locationPlaceholder")}
        hint={t("form.locationHint")}
        inputMode="decimal"
        maxLength={40}
        disabled={Boolean(market) && location.isPending}
        value={placeText}
        onChange={(e) => setPlace(e.target.value)}
        error={errors.location}
      />
      {!market && <p className="type-caption text-ink-muted">{t("form.slugNote")}</p>}

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
        <button
          type="submit"
          disabled={save.isPending}
          aria-busy={save.isPending}
          className="type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover disabled:opacity-60"
        >
          {save.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {save.isPending ? t("form.saving") : market ? t("form.save") : t("form.create")}
        </button>
      </div>
    </form>
  );
}

export function MarketsManager() {
  const t = useTranslations("AdminMarkets");
  const tPhoto = useTranslations("AdminMarketPhoto");
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<Panel>(null);
  const [find, setFind] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const markets = useQuery({ queryKey: marketKeys.all, queryFn: listAllMarkets });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMarket(id),
    onSuccess: () => {
      setConfirmId(null);
      setMessage({ kind: "ok", text: t("deleted") });
      void queryClient.invalidateQueries({ queryKey: marketKeys.all });
    },
    onError: (err) => {
      setConfirmId(null);
      setMessage({ kind: "error", text: t(errorKey(err)) });
      void queryClient.invalidateQueries({ queryKey: marketKeys.all });
    },
  });

  const all = useMemo(() => markets.data ?? [], [markets.data]);
  const visible = useMemo(() => {
    const term = find.trim().toLowerCase();
    if (!term) return all;
    return all.filter((m) => m.name.toLowerCase().includes(term) || (m.city ?? "").toLowerCase().includes(term));
  }, [all, find]);

  function afterSave(saved: AdminMarket, wasNew: boolean) {
    void queryClient.invalidateQueries({ queryKey: ["admin", "markets"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "market-location"] });
    if (wasNew) {
      // A new market: continue straight to its photo (the photo needs the market to exist first).
      setPanel({ kind: "edit", market: { ...saved, shopCount: 0, image: null }, justCreated: true });
      setMessage(null);
      return;
    }
    setPanel(null);
    setMessage({ kind: "ok", text: t("saved") });
  }

  if (markets.isPending) return <OwnerSkeleton label={t("loading")} />;

  if (markets.isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center">
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => markets.refetch()} className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand">
          {t("retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="sm:w-72">
          <label htmlFor="market-find" className="sr-only">
            {t("findLabel")}
          </label>
          <input
            id="market-find"
            type="search"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            maxLength={100}
            placeholder={t("findPlaceholder")}
            className="type-body h-11 w-full rounded-md border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setPanel({ kind: "add" });
          }}
          className="type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Plus className="size-5" aria-hidden />
          {t("add")}
        </button>
      </div>

      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={cn("type-body flex items-start gap-2", message.kind === "error" ? "text-error" : "text-success-ink")}>
          {message.kind === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
          <span>
            {message.text}
            {message.kind === "ok" && <span className="text-ink-muted"> {t("cacheNote")}</span>}
          </span>
        </p>
      )}

      {all.length === 0 ? (
        <p className="type-body rounded-md border border-line bg-card px-6 py-12 text-center text-ink-secondary">{t("empty")}</p>
      ) : visible.length === 0 ? (
        <p className="type-body rounded-md border border-line bg-card px-6 py-12 text-center text-ink-secondary">{t("noMatch")}</p>
      ) : (
        <>
          <p className="type-body text-ink-secondary">{t("count", { count: visible.length })}</p>
          <ul className="grid gap-3 lg:grid-cols-2">
            {visible.map((m) => {
              const confirming = confirmId === m.id;
              const blocked = m.shopCount > 0;
              const thumb = safeMediaUrl(m.image?.thumbUrl ?? null);
              return (
                <li key={m.id} className="flex flex-col overflow-hidden rounded-md border border-line bg-card shadow-card">
                  {/* Photo, or a bordeaux arch placeholder */}
                  <div className="relative aspect-[16/7] w-full bg-brand">
                    {thumb ? (
                      <Image src={thumb} alt="" fill unoptimized sizes="(min-width: 1024px) 36rem, 100vw" className="object-cover" />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-1 text-primary-foreground/80">
                        <svg viewBox="0 0 60 50" className="h-10 w-auto" aria-hidden="true">
                          <path d="M10 49 V26 A20 20 0 0 1 50 26 V49" fill="none" strokeWidth="2.5" className="stroke-gold" />
                        </svg>
                        <span className="type-caption">{tPhoto("cardNoPhoto")}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 p-4">
                    <div className="flex flex-col gap-1">
                      <h2 className="type-h3 text-ink">{m.name}</h2>
                      <p className="type-body flex items-start gap-1.5 text-ink-secondary">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
                        {[m.address, m.city].filter(Boolean).join(", ") || t("noAddress")}
                      </p>
                      <p className="type-caption flex items-center gap-1.5 text-ink-muted">
                        <Store className="size-3.5" aria-hidden />
                        {t("shops", { count: m.shopCount })}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                      <Link href={`/markets/${m.slug}`} className="type-body-medium flex h-10 items-center gap-1 rounded-sm px-2 text-brand hover:bg-subtle">
                        {t("viewPage")}
                        <ExternalLink className="size-4" aria-hidden />
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setMessage(null);
                          setPanel({ kind: "edit", market: m });
                        }}
                        className="type-body-medium flex h-10 items-center gap-1.5 rounded-sm border border-brand px-3 text-brand hover:bg-subtle"
                      >
                        <Pencil className="size-4" aria-hidden />
                        {t("edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => (confirming ? remove.mutate(m.id) : setConfirmId(m.id))}
                        onBlur={() => confirming && !remove.isPending && setConfirmId(null)}
                        disabled={blocked || remove.isPending}
                        title={blocked ? t("cantDelete", { count: m.shopCount }) : undefined}
                        className={cn(
                          "type-body-medium ml-auto flex h-10 items-center gap-1.5 rounded-sm px-3 disabled:cursor-not-allowed disabled:opacity-50",
                          confirming ? "bg-error text-primary-foreground" : "text-error hover:bg-error-soft",
                        )}
                      >
                        {remove.isPending && confirming ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
                        {confirming ? t("confirmDelete") : t("delete")}
                      </button>
                    </div>
                    {blocked && <p className="type-caption text-ink-muted">{t("cantDelete", { count: m.shopCount })}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Sheet open={panel !== null} onOpenChange={(isOpen) => !isOpen && setPanel(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="type-h3 text-ink">{panel?.kind === "edit" ? t("form.editTitle") : t("form.addTitle")}</SheetTitle>
            <SheetDescription className="type-caption text-ink-muted">{t("subtitle")}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            {panel?.kind === "add" && <MarketForm onSaved={(saved) => afterSave(saved, true)} onCancel={() => setPanel(null)} />}
            {panel?.kind === "edit" && (
              <>
                {panel.justCreated && (
                  <p role="status" className="type-body flex items-start gap-2 text-success-ink">
                    <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {tPhoto("afterCreate")}
                  </p>
                )}
                <PhotoField marketId={panel.market.id} marketName={panel.market.name} />
                <MarketForm key={panel.market.id} market={panel.market} onSaved={(saved) => afterSave(saved, false)} onCancel={() => setPanel(null)} />
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}