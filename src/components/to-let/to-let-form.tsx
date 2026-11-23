"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleCheck, LoaderCircle, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useSession } from "@/components/app-providers";
import { Link } from "@/i18n/routing";
import { ApiError } from "@/lib/api/core";
import { getMarkets, shopKeys } from "@/lib/api/shops";
import { createToLet, updateToLet, type OwnerAuth, type ToLetInput, type ToLetOwnerView } from "@/lib/api/to-let";
import { BD_MOBILE, normalizePhone } from "@/lib/validation";

const field = "type-body h-11 w-full rounded-sm border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const num = (v: string) => (/^\d{1,9}$/.test(v.trim()) ? Number(v.trim()) : NaN);
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 9);

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
    onSuccess: (l) => {
      if (existing) onSaved?.(l);
      else setCreated(l as ToLetOwnerView & { emailConfirmationRequired: boolean });
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
          <div className="sm:col-span-2">
            <Field id={`${id}-de`} label={t("description")} hint={t("descriptionHint")} error={errors.description}>
              <textarea id={`${id}-de`} value={v.description} maxLength={1500} rows={5} onChange={set("description")} className="type-body rounded-sm border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none" />
            </Field>
          </div>
        </div>
      </fieldset>

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
      <p className="type-caption text-ink-muted">{existing ? t("editNote") : t("afterNote")}</p>
      <button type="submit" disabled={save.isPending} className="type-body-medium flex h-12 items-center justify-center gap-2 self-start rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60">
        {save.isPending && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
        {existing ? t("saveChanges") : t("submit")}
      </button>
    </form>
  );
}
