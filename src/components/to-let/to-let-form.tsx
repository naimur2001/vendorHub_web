"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleCheck, ImagePlus, LoaderCircle, MailCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useSession } from "@/components/app-providers";
import { Link } from "@/i18n/routing";
import { ApiError } from "@/lib/api/core";
import { getMarkets, shopKeys } from "@/lib/api/shops";
import { listCategories } from "@/lib/api/catalog";
import { addToLetPhoto, createToLet, updateToLet, type OwnerAuth, type ToLetInput, type ToLetOwnerView } from "@/lib/api/to-let";
import { BD_MOBILE, normalizePhone } from "@/lib/validation";
import { cn } from "@/lib/utils";

const field = "type-body h-11 w-full rounded-sm border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const num = (v: string) => (/^\d{1,9}$/.test(v.trim()) ? Number(v.trim()) : NaN);
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 9);
const MAX_TYPES = 10; // backend limit
const MAX_PHOTOS = 6;
const IMG = ["image/jpeg", "image/png", "image/webp"];
const FIVE_MB = 5 * 1024 * 1024;

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="type-body-medium text-ink">{label}</label>
      {children}
      {error ? <p className="type-caption text-error">{error}</p> : hint ? <p className="type-caption text-ink-muted">{hint}</p> : null}
    </div>
  );
}

type Props = {
  existing?: ToLetOwnerView; // edit mode
  auth?: OwnerAuth;
  onSaved?: (l: ToLetOwnerView) => void;
};

/** List a shop for rent (or edit it). Contacts stay private: only the Vendors Hub team sees them. */
export function ToLetForm({ existing, auth = {}, onSaved }: Props) {
  const t = useTranslations("ToLetForm");
  const id = useId();
  const { user } = useSession();
  const markets = useQuery({ queryKey: shopKeys.markets, queryFn: getMarkets, staleTime: 10 * 60_000 });
  // business types = the top-level product categories
  const categories = useQuery({ queryKey: ["catalog", "categories"], queryFn: listCategories, staleTime: 10 * 60_000 });
  const types = (categories.data ?? []).filter((c) => !c.parentId);
  const [suitable, setSuitable] = useState<string[]>(existing?.suitableFor.map((c) => c.id) ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(0);
  const [noPhotoWarn, setNoPhotoWarn] = useState(false); // new listing without photos: ask once before sending
  const [v, setV] = useState({
    marketId: existing?.marketId ?? "",
    marketName: existing && !existing.marketId ? (existing.marketName ?? "") : "",
    levelFloor: existing?.levelFloor ?? "",
    shopNumber: existing?.shopNumber ?? "",
    addressLine: existing?.addressLine ?? "",
    sizeSqft: existing ? String(existing.sizeSqft) : "",
    monthlyRent: existing ? String(existing.monthlyRent) : "",
    advance: existing ? String(existing.advance) : "0",
    availableFrom: existing?.availableFrom ?? "",
    description: existing?.description ?? "",
    contactName: existing?.contactName ?? user?.name ?? "",
    contactPhone: existing?.contactPhone ?? user?.phone ?? "",
    contactEmail: existing?.contactEmail ?? user?.email ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<(ToLetOwnerView & { emailConfirmationRequired: boolean }) | null>(null);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  const save = useMutation({
    mutationFn: (input: ToLetInput) => (existing ? updateToLet(existing.id, input, auth) : createToLet(input)),
    onMutate: () => setFormError(null),
    onSuccess: async (l) => {
      if (existing) return onSaved?.(l);
      const made = l as ToLetOwnerView & { emailConfirmationRequired: boolean };
      // logged in (no email step): the chosen photos go up now, one by one
      if (!made.emailConfirmationRequired) {
        for (const f of files) {
          try {
            await addToLetPhoto(made.id, f, {});
            setUploaded((n) => n + 1);
          } catch {
            /* the rest can be added on the manage page */
          }
        }
      }
      setCreated(made);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 429) return setFormError(t("errors.tooMany"));
      if (err instanceof ApiError && err.status === 409) return setFormError(t("errors.limit"));
      if (err instanceof ApiError && err.status === 400) return setFormError(t("errors.check"));
      setFormError(err instanceof ApiError && err.status === 0 ? t("errors.network") : t("errors.generic"));
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!v.marketId && v.marketName.trim().length < 2) next.market = t("errors.market");
    if (v.addressLine.trim().length < 5) next.addressLine = t("errors.address");
    if (Number.isNaN(num(v.sizeSqft)) || num(v.sizeSqft) < 10) next.sizeSqft = t("errors.size");
    if (Number.isNaN(num(v.monthlyRent)) || num(v.monthlyRent) < 1) next.monthlyRent = t("errors.rent");
    if (Number.isNaN(num(v.advance || "0"))) next.advance = t("errors.advance");
    if (!DAY.test(v.availableFrom)) next.availableFrom = t("errors.date");
    if (v.description.trim().length < 10) next.description = t("errors.description");
    if (v.contactName.trim().length < 2) next.contactName = t("errors.name");
    if (!BD_MOBILE.test(normalizePhone(v.contactPhone))) next.contactPhone = t("errors.phone");
    if (!existing && !EMAIL.test(v.contactEmail.trim())) next.contactEmail = t("errors.email");
    setErrors(next);
    if (Object.keys(next).length) return setFormError(t("errors.fix"));
    setFormError(null);
    if (!existing && files.length === 0) return setNoPhotoWarn(true);
    send();
  }

  function send() {
    setNoPhotoWarn(false);
    save.mutate({
      ...(v.marketId ? { marketId: v.marketId, marketName: null } : { marketId: null, marketName: v.marketName.trim() }),
      levelFloor: v.levelFloor.trim() || null,
      shopNumber: v.shopNumber.trim() || null,
      addressLine: v.addressLine.trim(),
      sizeSqft: num(v.sizeSqft),
      monthlyRent: num(v.monthlyRent),
      advance: num(v.advance || "0"),
      availableFrom: v.availableFrom,
      description: v.description.trim(),
      contactName: v.contactName.trim(),
      contactPhone: normalizePhone(v.contactPhone),
      ...(!existing && { contactEmail: v.contactEmail.trim().toLowerCase() }),
      suitableFor: suitable,
    });
  }

  if (created) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-md border border-success-ink/40 bg-success-soft p-5">
        <p className="type-h3 flex items-center gap-2 text-success-ink">
          {created.emailConfirmationRequired ? <MailCheck className="size-6" aria-hidden /> : <CircleCheck className="size-6" aria-hidden />}
          {created.emailConfirmationRequired ? t("checkEmailTitle") : t("submittedTitle")}
        </p>
        <p className="type-body text-ink-secondary">
          {created.emailConfirmationRequired ? t("checkEmailText", { email: created.contactEmail }) : t("submittedText")}
        </p>
        {files.length > 0 && (
          <p className="type-caption text-ink-secondary">
            {created.emailConfirmationRequired ? t("photosAfterConfirm") : t("photosUploaded", { done: uploaded, total: files.length })}
          </p>
        )}
        {!created.emailConfirmationRequired && (
          <Link href="/me/to-let" className="type-body-medium inline-flex h-11 items-center rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover">{t("goManage")}</Link>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <fieldset disabled={save.isPending} className="flex flex-col gap-4 rounded-md border border-line bg-card p-4 shadow-card md:p-5">
        <legend className="type-h3 px-1 text-ink">{t("whereTitle")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${id}-m`} label={t("market")} error={errors.market}>
            <select id={`${id}-m`} value={v.marketId} onChange={set("marketId")} className={field}>
              <option value="">{t("otherMarket")}</option>
              {(markets.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>
          {!v.marketId && (
            <Field id={`${id}-mn`} label={t("marketName")} error={errors.market}>
              <input id={`${id}-mn`} value={v.marketName} maxLength={120} onChange={set("marketName")} className={field} />
            </Field>
          )}
          <Field id={`${id}-f`} label={t("floor")}>
            <input id={`${id}-f`} value={v.levelFloor} maxLength={40} placeholder={t("floorPlaceholder")} onChange={set("levelFloor")} className={field} />
          </Field>
          <Field id={`${id}-n`} label={t("shopNumber")}>
            <input id={`${id}-n`} value={v.shopNumber} maxLength={40} onChange={set("shopNumber")} className={field} />
          </Field>
          <div className="sm:col-span-2">
            <Field id={`${id}-a`} label={t("address")} error={errors.addressLine}>
              <input id={`${id}-a`} value={v.addressLine} maxLength={300} autoComplete="street-address" onChange={set("addressLine")} className={field} />
            </Field>
          </div>
        </div>
      </fieldset>

      <fieldset disabled={save.isPending} className="flex flex-col gap-4 rounded-md border border-line bg-card p-4 shadow-card md:p-5">
        <legend className="type-h3 px-1 text-ink">{t("termsTitle")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${id}-s`} label={t("size")} error={errors.sizeSqft}>
            <input id={`${id}-s`} inputMode="numeric" value={v.sizeSqft} onChange={(e) => setV({ ...v, sizeSqft: digits(e.target.value) })} className={field} />
          </Field>
          <Field id={`${id}-r`} label={t("rent")} error={errors.monthlyRent}>
            <input id={`${id}-r`} inputMode="numeric" value={v.monthlyRent} onChange={(e) => setV({ ...v, monthlyRent: digits(e.target.value) })} className={field} />
          </Field>
          <Field id={`${id}-ad`} label={t("advance")} hint={t("advanceHint")} error={errors.advance}>
            <input id={`${id}-ad`} inputMode="numeric" value={v.advance} onChange={(e) => setV({ ...v, advance: digits(e.target.value) })} className={field} />
          </Field>
          <Field id={`${id}-d`} label={t("availableFrom")} error={errors.availableFrom}>
            <input id={`${id}-d`} type="date" value={v.availableFrom} onChange={set("availableFrom")} className={field} />
          </Field>
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="type-body-medium mb-1 text-ink">{t("suitableFor")}</legend>
            <p className="type-caption -mt-1 text-ink-muted">{t("suitableHint", { max: MAX_TYPES })}</p>
            {categories.isPending ? (
              <div className="h-11 skeleton rounded-full" aria-hidden />
            ) : (
              <div className="flex flex-wrap gap-2">
                {types.map((c) => {
                  const on = suitable.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      disabled={!on && suitable.length >= MAX_TYPES}
                      onClick={() => setSuitable((s) => (on ? s.filter((x) => x !== c.id) : [...s, c.id]))}
                      className={cn(
                        "type-body h-11 rounded-full border px-4 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-50",
                        on ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand",
                      )}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>
          <div className="sm:col-span-2">
            <Field id={`${id}-de`} label={t("description")} hint={t("descriptionHint")} error={errors.description}>
              <textarea id={`${id}-de`} value={v.description} maxLength={1500} rows={5} onChange={set("description")} className="type-body rounded-sm border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none" />
            </Field>
          </div>
        </div>
      </fieldset>

      {!existing && (
        <fieldset disabled={save.isPending} className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card md:p-5">
          <legend className="type-h3 px-1 text-ink">{t("photosTitle", { count: files.length, max: MAX_PHOTOS })}</legend>
          <p className="type-caption -mt-1 text-ink-muted">{t("photosHint")}</p>
          {files.length > 0 && (
            <ul className="flex flex-col gap-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="type-body flex items-center justify-between gap-2 rounded-sm bg-subtle px-3 text-ink-secondary">
                  <span className="truncate">{f.name}</span>
                  <button type="button" onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} aria-label={t("removePhoto", { name: f.name })} className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-error focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {files.length < MAX_PHOTOS && (
            <label htmlFor={`${id}-ph`} className="type-body-medium inline-flex h-11 cursor-pointer items-center gap-2 self-start rounded-sm border border-brand px-4 text-brand hover:bg-subtle has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand">
              <ImagePlus className="size-4" aria-hidden />
              {t("addPhotos")}
              <input
                id={`${id}-ph`}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  const ok = picked.filter((f) => IMG.includes(f.type) && f.size <= FIVE_MB);
                  setPhotoNote(ok.length < picked.length ? t("photosSkipped") : null);
                  setFiles((fs) => [...fs, ...ok].slice(0, MAX_PHOTOS));
                  if (ok.length) setNoPhotoWarn(false);
                }}
              />
            </label>
          )}
          {photoNote && <p role="alert" className="type-caption text-error">{photoNote}</p>}
          {!user && files.length > 0 && <p className="type-caption text-ink-muted">{t("photosGuest")}</p>}
        </fieldset>
      )}

      <fieldset disabled={save.isPending} className="flex flex-col gap-4 rounded-md border border-gold bg-card p-4 shadow-card md:p-5">
        <legend className="type-h3 px-1 text-ink">{t("contactTitle")}</legend>
        <p className="type-caption -mt-2 text-ink-secondary">{t("contactPrivate")}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id={`${id}-cn`} label={t("contactName")} error={errors.contactName}>
            <input id={`${id}-cn`} value={v.contactName} maxLength={80} autoComplete="name" onChange={set("contactName")} className={field} />
          </Field>
          <Field id={`${id}-cp`} label={t("contactPhone")} error={errors.contactPhone}>
            <input id={`${id}-cp`} value={v.contactPhone} inputMode="tel" autoComplete="tel" placeholder="01712345678" onChange={set("contactPhone")} className={field} />
          </Field>
          <Field id={`${id}-ce`} label={t("contactEmail")} hint={existing ? t("emailFixed") : t("emailHint")} error={errors.contactEmail}>
            <input id={`${id}-ce`} type="email" value={v.contactEmail} maxLength={200} autoComplete="email" disabled={Boolean(existing)} onChange={set("contactEmail")} className={field} />
          </Field>
        </div>
      </fieldset>

      {formError && <p role="alert" className="type-body text-error">{formError}</p>}
      {noPhotoWarn && (
        <div role="alert" className="flex flex-col gap-3 rounded-md border border-highlight bg-highlight-soft p-4">
          <p className="type-body-medium text-ink">{t("noPhotosTitle")}</p>
          <p className="type-body text-ink-secondary">{t("noPhotosText")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => document.getElementById(`${id}-ph`)?.click()} className="type-body-medium inline-flex h-11 items-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none">
              <ImagePlus className="size-4" aria-hidden />
              {t("noPhotosAdd")}
            </button>
            <button type="button" onClick={send} disabled={save.isPending} className="type-body-medium inline-flex h-11 items-center rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60">
              {t("noPhotosSend")}
            </button>
          </div>
        </div>
      )}
      <p className="type-caption text-ink-muted">{existing ? t("editNote") : t("afterNote")}</p>
      <button type="submit" disabled={save.isPending} className="type-body-medium flex h-12 items-center justify-center gap-2 self-start rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60">
        {save.isPending && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
        {existing ? t("saveChanges") : t("submit")}
      </button>
    </form>
  );
}
