"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, CircleCheck, Copy, KeyRound, LoaderCircle, MapPin, Ruler, ShieldCheck, Wallet } from "lucide-react";
import Image from "next/image";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { useSession } from "@/components/app-providers";
import { Link } from "@/i18n/routing";
import { ApiError } from "@/lib/api/core";
import { safeMediaUrl } from "@/lib/api/storefront";
import { getToLet, sendInquiry, toLetKeys, type InquiryResult, type ToLetDetail } from "@/lib/api/to-let";
import { formatTaka } from "@/lib/format";
import { BD_MOBILE, normalizePhone } from "@/lib/validation";
import { cn } from "@/lib/utils";

const field = "type-body h-11 w-full rounded-sm border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";

/** Public detail of one shop space. "Contact Vendors Hub" sends an enquiry to our team, never to the owner directly. */
export function ToLetDetailView({ slug }: { slug: string }) {
  const t = useTranslations("ToLet");
  const q = useQuery({ queryKey: toLetKeys.detail(slug), queryFn: () => getToLet(slug), retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2 });

  if (q.isPending) return <div className="h-96 skeleton rounded-md" aria-hidden />;
  if (q.isError) {
    const gone = q.error instanceof ApiError && q.error.status === 404;
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center">
        <p className="type-body text-ink-secondary">{gone ? t("gone") : t("loadError")}</p>
        {gone ? (
          <Link href="/to-let" className="type-body-medium flex h-11 items-center rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover">{t("backToList")}</Link>
        ) : (
          <button type="button" onClick={() => q.refetch()} className="type-body-medium h-11 rounded-sm border border-brand px-4 text-brand hover:bg-subtle">{t("retry")}</button>
        )}
      </div>
    );
  }
  return <Detail l={q.data} />;
}

function Detail({ l }: { l: ToLetDetail }) {
  const t = useTranslations("ToLet");
  const locale = useLocale();
  const format = useFormatter();
  const photos = l.photos.filter((p) => safeMediaUrl(p.url));
  const [shown, setShown] = useState(0);
  const main = photos[shown] ? safeMediaUrl(photos[shown].url) : null;
  const day = l.availableFrom ? format.dateTime(new Date(`${l.availableFrom}T12:00:00Z`), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null;

  const facts = [
    { icon: Wallet, label: t("rent"), value: t("perMonth", { rent: formatTaka(l.monthlyRent, locale) }) },
    { icon: Wallet, label: t("advance"), value: l.advance > 0 ? formatTaka(l.advance, locale) : t("noAdvance") },
    { icon: Ruler, label: t("size"), value: t("sqft", { size: format.number(l.sizeSqft) }) },
    ...(day ? [{ icon: CalendarDays, label: t("available"), value: day }] : []),
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="relative block aspect-4/3 overflow-hidden rounded-md bg-highlight-soft">
            {main ? (
              <Image src={main} alt={t("photoAlt", { n: shown + 1, total: photos.length })} fill unoptimized sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
            ) : (
              <KeyRound className="absolute inset-0 m-auto size-12 text-highlight" strokeWidth={1.25} aria-hidden />
            )}
          </span>
          {photos.length > 1 && (
            <ul className="scroll-row flex gap-2 overflow-x-auto pb-1">
              {photos.map((p, i) => (
                <li key={p.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setShown(i)}
                    aria-label={t("showPhoto", { n: i + 1 })}
                    aria-current={shown === i}
                    className={cn("relative block size-16 overflow-hidden rounded-sm border-2 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none", shown === i ? "border-brand" : "border-transparent")}
                  >
                    <Image src={safeMediaUrl(p.thumbUrl) ?? main ?? ""} alt="" fill unoptimized sizes="64px" className="object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="type-caption self-start rounded-full bg-brand px-2.5 py-0.5 text-primary-foreground">{t("badge")}</span>
          <h1 className="type-h1 text-ink">{l.title}</h1>
          <p className="type-body flex items-start gap-1.5 text-ink-secondary">
            <MapPin className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
            {[l.shopNumber && t("shopNo", { n: l.shopNumber }), l.levelFloor, l.addressLine].filter(Boolean).join(" · ")}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="flex flex-col-reverse gap-1 rounded-md border border-line bg-card p-3">
              <dt className="type-caption text-ink-muted">{f.label}</dt>
              <dd className="type-body-medium text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>

        {l.suitableFor.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="type-body-medium text-ink">{t("suitableFor")}</h2>
            <ul className="flex flex-wrap gap-2">
              {l.suitableFor.map((c) => (
                <li key={c.id} className="type-caption rounded-full bg-highlight-soft px-3 py-1 text-highlight">{c.name}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h2 className="type-h3 text-ink">{t("about")}</h2>
          {/* Owner's text, plain */}
          <p className="type-body whitespace-pre-line text-ink-secondary">{l.description}</p>
        </div>
      </div>

      <aside className="lg:sticky lg:top-24">
        <InquiryForm listingId={l.id} />
      </aside>
    </div>
  );
}

function InquiryForm({ listingId }: { listingId: string }) {
  const t = useTranslations("ToLet");
  const id = useId();
  const { user } = useSession();
  const [form, setForm] = useState({ name: user?.name ?? "", phone: user?.phone ?? "", email: "", message: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<InquiryResult | null>(null);
  const [copied, setCopied] = useState(false);

  const send = useMutation({
    mutationFn: () =>
      sendInquiry(listingId, {
        name: form.name.trim(),
        phone: normalizePhone(form.phone),
        ...(form.email.trim() && { email: form.email.trim() }),
        message: form.message.trim(),
      }),
    onMutate: () => setError(null),
    onSuccess: setDone,
    onError: (err) => {
      if (err instanceof ApiError && err.status === 429) return setError(t("errors.tooMany"));
      if (err instanceof ApiError && err.status === 409) return setError(t("errors.alreadyAsked"));
      if (err instanceof ApiError && err.status === 400) return setError(t("errors.check"));
      setError(err instanceof ApiError && err.status === 0 ? t("errors.network") : t("errors.generic"));
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError(t("errors.name"));
    if (!BD_MOBILE.test(normalizePhone(form.phone))) return setError(t("errors.phone"));
    if (form.message.trim().length < 5) return setError(t("errors.message"));
    send.mutate();
  }

  if (done) {
    const follow = done.followToken ? `/to-let/inquiry/${done.inquiryId}?token=${done.followToken}` : `/to-let/inquiry/${done.inquiryId}`;
    const full = typeof window === "undefined" ? follow : `${window.location.origin}${follow}`;
    return (
      <div role="status" className="flex flex-col gap-3 rounded-md border border-success-ink/40 bg-success-soft p-4">
        <p className="type-body-medium flex items-center gap-2 text-success-ink">
          <CircleCheck className="size-5" aria-hidden />
          {t("sentTitle")}
        </p>
        <p className="type-body text-ink-secondary">{t("sentText")}</p>
        {done.followToken && <p className="type-caption text-ink-secondary">{t("saveLink")}</p>}
        <div className="flex flex-wrap gap-2">
          <Link href={follow} className="type-body-medium inline-flex h-11 items-center rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover">{t("openThread")}</Link>
          {done.followToken && (
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(full).then(() => setCopied(true), () => setCopied(false))}
              className="type-body-medium inline-flex h-11 items-center gap-1.5 rounded-sm border border-brand px-4 text-brand hover:bg-subtle"
            >
              <Copy className="size-4" aria-hidden />
              {copied ? t("copied") : t("copyLink")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${id}-t`} className="flex flex-col gap-3 rounded-md border border-gold bg-card p-4 shadow-card">
      <h2 id={`${id}-t`} className="type-h3 text-ink">{t("contactTitle")}</h2>
      <p className="type-caption flex items-start gap-1.5 text-ink-secondary">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-verified" aria-hidden />
        {t("middleman")}
      </p>
      <fieldset disabled={send.isPending} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-n`} className="type-body-medium text-ink">{t("yourName")}</label>
          <input id={`${id}-n`} value={form.name} maxLength={80} autoComplete="name" onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-p`} className="type-body-medium text-ink">{t("yourPhone")}</label>
          <input id={`${id}-p`} value={form.phone} inputMode="tel" autoComplete="tel" placeholder="01712345678" onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-e`} className="type-body-medium text-ink">{t("yourEmail")}</label>
          <input id={`${id}-e`} type="email" value={form.email} maxLength={200} autoComplete="email" onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-m`} className="type-body-medium text-ink">{t("yourMessage")}</label>
          <textarea id={`${id}-m`} value={form.message} maxLength={1000} rows={4} placeholder={t("messagePlaceholder")} onChange={(e) => setForm({ ...form, message: e.target.value })} className="type-body rounded-sm border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none" />
        </div>
      </fieldset>
      {error && <p role="alert" className="type-caption text-error">{error}</p>}
      <button type="submit" disabled={send.isPending} className="type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60">
        {send.isPending && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
        {t("sendInquiry")}
      </button>
    </form>
  );
}
