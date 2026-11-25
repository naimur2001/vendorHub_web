"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle, Megaphone, Plus } from "lucide-react";
import { useNow, useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
import { DayBars } from "@/components/admin/day-bars";
import { ApiError } from "@/lib/api/core";
import {
  createPopup,
  deletePopup,
  getPopupSettings,
  getPopupStats,
  listAdminPopups,
  POPUP_MAX_BYTES,
  POPUP_TYPES,
  popupKeys,
  setPopupSettings,
  stopPopup,
  updatePopup,
  type AdminPopup,
  type PopupAudience,
  type PopupFrequency,
  type PopupInput,
  type PopupPages,
} from "@/lib/api/popups";
import { safeMediaUrl } from "@/lib/api/storefront";
import { cn } from "@/lib/utils";

const outline = "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60";
const solid = "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60";
const field = "type-body h-11 w-full rounded-sm border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";
const card = "flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card md:p-5";

const AUDIENCES: PopupAudience[] = ["ALL", "GUESTS", "CUSTOMERS", "SHOP_TEAM"];
const PAGES: PopupPages[] = ["HOME_ONLY", "ALL_PAGES"];
const FREQUENCIES: PopupFrequency[] = ["ONCE_PER_DAY", "ONCE_PER_VISITOR", "EVERY_VISIT"];
const MIN_SIZE = 300;

function errorKey(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 413) return "errors.size";
    if (err.status === 415) return "errors.type";
    if (err.status === 404) return "errors.gone";
    if (err.status === 400) return "errors.invalid";
    if (err.status === 0) return "errors.network";
  }
  return "errors.generic";
}

// Quick checks in the browser (the server checks again). A preview URL, or an error key.
async function prepareFile(file: File): Promise<{ preview: string } | { error: string }> {
  if (!POPUP_TYPES.includes(file.type)) return { error: "errors.type" };
  if (file.size > POPUP_MAX_BYTES) return { error: "errors.size" };
  const preview = URL.createObjectURL(file);
  const ok = await new Promise<boolean>((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img.naturalWidth >= MIN_SIZE && img.naturalHeight >= MIN_SIZE);
    img.onerror = () => resolve(false);
    img.src = preview;
  });
  if (!ok) {
    URL.revokeObjectURL(preview);
    return { error: "errors.small" };
  }
  return { preview };
}

// ISO <-> <input type="datetime-local"> value (the admin's own time zone).
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : "");

// Internal paths and https links only (the backend checks too).
const linkOk = (v: string) => v === "" || (v.startsWith("/") && !v.startsWith("//") && !v.includes("\\")) || /^https:\/\/[^\s]+$/i.test(v);

type Status = "live" | "off" | "scheduled" | "ended";
function statusOf(p: AdminPopup, now: Date): Status {
  if (p.liveNow) return "live";
  if (!p.isActive) return "off";
  if (p.startsAt && new Date(p.startsAt) > now) return "scheduled";
  return "ended";
}
const STATUS_CLASS: Record<Status, string> = {
  live: "bg-success-soft text-success-ink",
  off: "bg-subtle text-ink-secondary",
  scheduled: "bg-info-soft text-ink",
  ended: "bg-warning-soft text-ink",
};

/** Admin: the welcome popup shown when people open the site. One live popup wins (highest priority). */
export function PopupsManager() {
  const t = useTranslations("AdminPopups");
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: popupKeys.settings, queryFn: getPopupSettings });
  const popups = useQuery({ queryKey: popupKeys.all, queryFn: listAdminPopups });
  const [editing, setEditing] = useState<AdminPopup | "new" | null>(null);
  const toggle = useMutation({
    mutationFn: (on: boolean) => setPopupSettings(on),
    onSuccess: (data) => queryClient.setQueryData(popupKeys.settings, data),
  });
  const enabled = settings.data?.popupsEnabled ?? true;

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="popup-switch" className={cn(card, "sm:flex-row sm:items-center sm:justify-between")}>
        <div className="flex flex-col gap-1">
          <h2 id="popup-switch" className="type-h3 flex items-center gap-2 text-ink">
            <Megaphone className="size-5 text-highlight" aria-hidden />
            {t("switchTitle")}
          </h2>
          <p className="type-body text-ink-secondary" aria-live="polite">{settings.isPending ? t("loading") : enabled ? t("switchOn") : t("switchOff")}</p>
          {toggle.isError && <p role="alert" className="type-caption text-error">{t(errorKey(toggle.error))}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="popup-switch"
          disabled={settings.isPending || toggle.isPending}
          onClick={() => toggle.mutate(!enabled)}
          className={cn("relative inline-flex h-11 w-20 shrink-0 items-center rounded-full border-2 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60", enabled ? "border-brand bg-brand" : "border-line-strong bg-subtle")}
        >
          <span aria-hidden className={cn("absolute size-8 rounded-full bg-card shadow-card motion-safe:transition-transform motion-safe:duration-200", enabled ? "translate-x-10" : "translate-x-1")} />
        </button>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="type-body text-ink-secondary">{t("rule")}</p>
        {editing === null && (
          <button type="button" onClick={() => setEditing("new")} className={solid}>
            <Plus className="size-4" aria-hidden />
            {t("add")}
          </button>
        )}
      </div>

      {editing !== null && (
        <div className={card}>
          <h2 className="type-h3 text-ink">{editing === "new" ? t("newTitle") : t("editTitle")}</h2>
          <PopupForm key={editing === "new" ? "new" : editing.id} popup={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
        </div>
      )}

      {popups.isPending ? (
        <div className="relative h-40 skeleton overflow-hidden rounded-md" aria-hidden />
      ) : popups.isError ? (
        <div role="alert" className="flex items-center gap-3 rounded-md border border-line bg-card p-4">
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => popups.refetch()} className={outline}>{t("retry")}</button>
        </div>
      ) : popups.data.length === 0 ? (
        editing === null && <p className="type-body rounded-md border border-dashed border-line-strong p-6 text-center text-ink-secondary">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {popups.data.map((p) => (
            <li key={p.id}>
              <PopupCard p={p} onEdit={() => setEditing(p)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PopupCard({ p, onEdit }: { p: AdminPopup; onEdit: () => void }) {
  const t = useTranslations("AdminPopups");
  const now = useNow({ updateInterval: 60_000 });
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: popupKeys.all });
  const stop = useMutation({ mutationFn: () => stopPopup(p.id), onSuccess: refresh });
  const start = useMutation({ mutationFn: () => updatePopup(p.id, { isActive: true }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: () => deletePopup(p.id), onSuccess: refresh });
  const error = stop.error ?? start.error ?? remove.error;
  const status = statusOf(p, now);
  const thumb = safeMediaUrl(p.media?.thumbUrl ?? p.media?.url ?? null);

  return (
    <article className={cn(card, status === "live" && "border-gold")}>
      <div className="flex gap-3">
        <div className="size-20 shrink-0 overflow-hidden rounded-sm bg-subtle">
          {/* eslint-disable-next-line @next/next/no-img-element -- media thumbnail */}
          {thumb && <img src={thumb} alt="" className="size-full object-cover" />}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Admin text: plain text */}
            <h3 className="type-body-medium text-ink">{p.titleEn}</h3>
            <span className={cn("type-caption rounded-full px-2 py-0.5", STATUS_CLASS[status])}>{t(`status.${status}`)}</span>
          </div>
          <p className="type-caption text-ink-secondary">
            {[t(`audience.${p.audience}`), t(`pages.${p.pages}`), t(`frequency.${p.frequency}`)].join(" · ")}
          </p>
          <p className="type-caption text-ink-muted">{t("meta", { priority: p.priority, delay: p.delaySeconds, version: p.version })}</p>
        </div>
      </div>

      {confirmDelete ? (
        <div className="flex flex-col gap-2 rounded-sm bg-error-soft/50 p-3">
          <p className="type-body text-ink">{t("deleteConfirm")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} aria-busy={remove.isPending} className="type-body-medium inline-flex h-11 items-center gap-1.5 rounded-sm bg-error px-4 text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none disabled:opacity-60">
              {remove.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {t("delete")}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="type-body-medium h-11 rounded-sm px-4 text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">{t("keep")}</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onEdit} className={outline}>{t("edit")}</button>
          {p.isActive ? (
            <button type="button" onClick={() => stop.mutate()} disabled={stop.isPending} aria-busy={stop.isPending} className={cn(outline, "border-error text-error hover:bg-error-soft")}>
              {stop.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {t("stop")}
            </button>
          ) : (
            <button type="button" onClick={() => start.mutate()} disabled={start.isPending} aria-busy={start.isPending} className={outline}>
              {start.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {t("start")}
            </button>
          )}
          <button type="button" onClick={() => setShowStats((v) => !v)} aria-expanded={showStats} className="type-body-medium h-11 rounded-sm px-3 text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
            {showStats ? t("hideStats") : t("stats")}
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)} className="type-body-medium h-11 rounded-sm px-3 text-error hover:bg-error-soft focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none">{t("delete")}</button>
        </div>
      )}
      {error && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t(errorKey(error))}
        </p>
      )}
      {showStats && <PopupStatsPanel id={p.id} />}
    </article>
  );
}

/** YYYY-MM-DD in Dhaka, `daysAgo` days before `now`. */
function dhakaDay(now: Date, daysAgo = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now.getTime() - daysAgo * 86_400_000));
}

function PopupStatsPanel({ id }: { id: string }) {
  const t = useTranslations("AdminPopups");
  const now = useNow({ updateInterval: 60_000 });
  const to = dhakaDay(now);
  const from = dhakaDay(now, 29);
  const stats = useQuery({ queryKey: popupKeys.stats(id, from, to), queryFn: () => getPopupStats(id, from, to) });

  if (stats.isPending) return <div className="relative h-32 skeleton overflow-hidden rounded-sm" aria-hidden />;
  if (stats.isError) return <p role="alert" className="type-body text-ink-secondary">{t("statsError")}</p>;
  const { totals, days } = stats.data;
  const numbers: [string, string][] = [
    [t("views"), String(totals.views)],
    [t("clicks"), String(totals.clicks)],
    [t("closes"), String(totals.closes)],
    [t("ctr"), totals.ctr === null ? "—" : `${totals.ctr}%`],
  ];
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {numbers.map(([k, v]) => (
          <div key={k} className="flex flex-col rounded-sm bg-subtle p-2">
            <dt className="type-caption text-ink-muted">{k}</dt>
            <dd className="type-h3 text-ink tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <DayBars
        title={t("viewsPerDay")}
        points={days.map((d) => ({ day: d.day, value: d.views, note: t("dayNote", { clicks: d.clicks, closes: d.closes }) }))}
        format={(n) => String(Math.round(n))}
        summary={t("statsSummary", { views: totals.views, clicks: totals.clicks })}
      />
    </div>
  );
}

type Picked = { file: File; preview: string } | null;

/** Add or edit a popup. Any change to the text, link or image makes it show again to people who closed it. */
function PopupForm({ popup, onDone }: { popup: AdminPopup | null; onDone: () => void }) {
  const t = useTranslations("AdminPopups");
  const uid = useId();
  const queryClient = useQueryClient();
  const [v, setV] = useState<PopupInput>({
    titleEn: popup?.titleEn ?? "",
    titleBn: popup?.titleBn ?? "",
    bodyEn: popup?.bodyEn ?? "",
    bodyBn: popup?.bodyBn ?? "",
    linkUrl: popup?.linkUrl ?? "",
    ctaLabelEn: popup?.ctaLabelEn ?? "",
    ctaLabelBn: popup?.ctaLabelBn ?? "",
    isActive: popup?.isActive ?? true,
    startsAt: popup?.startsAt ?? "",
    endsAt: popup?.endsAt ?? "",
    priority: popup?.priority ?? 0,
    audience: popup?.audience ?? "ALL",
    pages: popup?.pages ?? "HOME_ONLY",
    frequency: popup?.frequency ?? "ONCE_PER_DAY",
    delaySeconds: popup?.delaySeconds ?? 2,
  });
  const [media, setMedia] = useState<Picked>(null);
  const [mobile, setMobile] = useState<Picked>(null);
  const [removeMobile, setRemoveMobile] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => () => void (media && URL.revokeObjectURL(media.preview)), [media]);
  useEffect(() => () => void (mobile && URL.revokeObjectURL(mobile.preview)), [mobile]);

  const save = useMutation({
    mutationFn: () => {
      const input: PopupInput = { ...v, titleEn: v.titleEn.trim(), titleBn: v.titleBn.trim(), bodyEn: v.bodyEn.trim(), bodyBn: v.bodyBn.trim(), linkUrl: v.linkUrl.trim(), ctaLabelEn: v.ctaLabelEn.trim(), ctaLabelBn: v.ctaLabelBn.trim() };
      if (!popup) return createPopup(input, (media as NonNullable<Picked>).file, mobile?.file ?? null);
      return updatePopup(popup.id, input, { media: media?.file, mobileMedia: mobile?.file, removeMobileMedia: removeMobile && !mobile });
    },
    onMutate: () => setProblem(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: popupKeys.all });
      onDone();
    },
    onError: (err) => setProblem(t(errorKey(err))),
  });

  async function pick(file: File | undefined, set: (p: Picked) => void) {
    if (!file) return;
    const r = await prepareFile(file);
    if ("error" in r) return setProblem(t(r.error));
    setProblem(null);
    set({ file, preview: r.preview });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!popup && !media) return setProblem(t("errors.needImage"));
    if (v.titleEn.trim().length < 2) return setProblem(t("errors.title"));
    if (!linkOk(v.linkUrl.trim())) return setProblem(t("errors.link"));
    if (v.startsAt && v.endsAt && new Date(v.endsAt) <= new Date(v.startsAt)) return setProblem(t("errors.dates"));
    save.mutate();
  }

  const text = (key: keyof PopupInput, label: string, max: number, area = false) => (
    <label htmlFor={`${uid}-${key}`} className="flex flex-col gap-1">
      <span className="type-body-medium text-ink">{label}</span>
      {area ? (
        <textarea id={`${uid}-${key}`} rows={2} maxLength={max} value={String(v[key])} onChange={(e) => setV({ ...v, [key]: e.target.value })} className="type-body w-full rounded-sm border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none" />
      ) : (
        <input id={`${uid}-${key}`} maxLength={max} value={String(v[key])} onChange={(e) => setV({ ...v, [key]: e.target.value })} className={field} />
      )}
    </label>
  );
  // Only listed values can be picked; anything else falls back to the first option.
  const choice = (key: "audience" | "pages" | "frequency", options: readonly string[], label: string) => (
    <label htmlFor={`${uid}-${key}`} className="flex flex-col gap-1">
      <span className="type-body-medium text-ink">{label}</span>
      <select id={`${uid}-${key}`} value={v[key]} onChange={(e) => setV({ ...v, [key]: options.includes(e.target.value) ? e.target.value : options[0] })} className={field}>
        {options.map((o) => <option key={o} value={o}>{t(`${key}.${o}` as "audience.ALL")}</option>)}
      </select>
    </label>
  );
  const shown = media?.preview ?? safeMediaUrl(popup?.media?.url ?? null);
  const shownMobile = mobile?.preview ?? (removeMobile ? null : safeMediaUrl(popup?.mobileMedia?.url ?? null));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: t("image"), hint: t("imageHint"), src: shown, onPick: (f?: File) => pick(f, setMedia) },
          { label: t("mobileImage"), hint: t("mobileImageHint"), src: shownMobile, onPick: (f?: File) => pick(f, (x) => { setMobile(x); setRemoveMobile(false); }) },
        ].map((f, i) => (
          <div key={i} className="flex flex-col gap-2">
            <label htmlFor={`${uid}-file${i}`} className="type-body-medium text-ink">{f.label}</label>
            <div className="relative flex aspect-square max-h-56 items-center justify-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob:) or media file */}
              {f.src && <img src={f.src} alt="" className="size-full object-contain" />}
            </div>
            <input id={`${uid}-file${i}`} type="file" accept={POPUP_TYPES.join(",")} onChange={(e) => void f.onPick(e.target.files?.[0])} className="type-body text-ink-secondary file:mr-3 file:h-11 file:rounded-sm file:border file:border-brand file:bg-card file:px-4 file:text-brand hover:file:bg-subtle" />
            <p className="type-caption text-ink-muted">{f.hint}</p>
            {i === 1 && popup?.mobileMedia && !mobile && !removeMobile && (
              <button type="button" onClick={() => setRemoveMobile(true)} className="type-body-medium h-11 self-start rounded-sm px-3 text-error hover:bg-error-soft focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none">{t("removeMobile")}</button>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {text("titleEn", t("titleEn"), 120)}
        {text("titleBn", t("titleBn"), 120)}
        {text("bodyEn", t("bodyEn"), 300, true)}
        {text("bodyBn", t("bodyBn"), 300, true)}
        {text("linkUrl", t("linkUrl"), 500)}
        <div className="grid grid-cols-2 gap-4">
          {text("ctaLabelEn", t("ctaEn"), 30)}
          {text("ctaLabelBn", t("ctaBn"), 30)}
        </div>
      </div>
      <p className="-mt-2 type-caption text-ink-muted">{t("linkHint")}</p>

      <div className="grid gap-4 sm:grid-cols-3">
        {choice("audience", AUDIENCES, t("audienceLabel"))}
        {choice("pages", PAGES, t("pagesLabel"))}
        {choice("frequency", FREQUENCIES, t("frequencyLabel"))}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <label htmlFor={`${uid}-pr`} className="flex flex-col gap-1">
          <span className="type-body-medium text-ink">{t("priority")}</span>
          <input id={`${uid}-pr`} inputMode="numeric" value={String(v.priority)} onChange={(e) => setV({ ...v, priority: Math.min(1000, Number(e.target.value.replace(/\D/g, "").slice(0, 4)) || 0) })} className={field} />
        </label>
        <label htmlFor={`${uid}-d`} className="flex flex-col gap-1">
          <span className="type-body-medium text-ink">{t("delay")}</span>
          <input id={`${uid}-d`} inputMode="numeric" value={String(v.delaySeconds)} onChange={(e) => setV({ ...v, delaySeconds: Math.min(30, Number(e.target.value.replace(/\D/g, "").slice(0, 2)) || 0) })} className={field} />
        </label>
        <label htmlFor={`${uid}-s`} className="flex flex-col gap-1">
          <span className="type-body-medium text-ink">{t("startsAt")}</span>
          <input id={`${uid}-s`} type="datetime-local" value={toLocalInput(v.startsAt || null)} onChange={(e) => setV({ ...v, startsAt: fromLocalInput(e.target.value) })} className={field} />
        </label>
        <label htmlFor={`${uid}-e`} className="flex flex-col gap-1">
          <span className="type-body-medium text-ink">{t("endsAt")}</span>
          <input id={`${uid}-e`} type="datetime-local" value={toLocalInput(v.endsAt || null)} onChange={(e) => setV({ ...v, endsAt: fromLocalInput(e.target.value) })} className={field} />
        </label>
      </div>
      <p className="-mt-2 type-caption text-ink-muted">{t("priorityHint")}</p>

      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input type="checkbox" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} className="size-5 accent-brand" />
        <span className="type-body text-ink">{t("activeLabel")}</span>
      </label>

      {problem && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={save.isPending} aria-busy={save.isPending} className={solid}>
          {save.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {save.isPending ? t("saving") : t("save")}
        </button>
        <button type="button" onClick={onDone} disabled={save.isPending} className="type-body-medium h-11 rounded-sm px-4 text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">{t("cancel")}</button>
      </div>
    </form>
  );
}
