"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, CircleAlert, ImagePlus, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import {
  BANNER_MAX_BYTES,
  BANNER_TYPES,
  bannerKeys,
  createBanner,
  deleteBanner,
  listAdminBanners,
  reorderBanners,
  setBannerActive,
  updateBanner,
  type AdminBanner,
  type BannerInput,
  type BannerPlacement,
} from "@/lib/api/banners";
import { ApiError } from "@/lib/api/core";
import { safeMediaUrl } from "@/lib/api/storefront";
import { refreshPublicPages } from "@/lib/refresh-public";
import { cn } from "@/lib/utils";

type Panel = { kind: "add" } | { kind: "edit"; banner: AdminBanner } | null;

// Smallest accepted image per placement (the server checks too).
const MIN = {
  HERO: { width: 900, height: 300 },
  SIDE_AD: { width: 300, height: 400 },
  GALLERY: { width: 600, height: 600 },
  mobile: { width: 400, height: 300 },
};
const PLACEMENTS = ["HERO", "SIDE_AD", "GALLERY"] as const;
// Gallery pictures: no GIF (the server refuses it too).
const GALLERY_TYPES = BANNER_TYPES.filter((type) => type !== "image/gif");
const typesFor = (placement: BannerPlacement) => (placement === "GALLERY" ? GALLERY_TYPES : BANNER_TYPES);
// Per-placement texts (the slider uses the plain keys).
const HINT_SUFFIX: Record<BannerPlacement, string> = { HERO: "", SIDE_AD: "Side", GALLERY: "Gallery" };

const outline =
  "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-brand px-3 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const primary =
  "type-body-medium inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60";
const iconButton =
  "flex size-11 items-center justify-center rounded-sm border border-line text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";

function errorKey(err: unknown): string {
  if (err instanceof ApiError) {
    const code = (err.details as { code?: string } | undefined)?.code;
    if (err.status === 409 && code === "BANNER_LIMIT") return "errors.limit";
    if (err.status === 409 && code === "GALLERY_LIMIT") return "errors.galleryLimit";
    if (err.status === 413) return "errors.size";
    if (err.status === 415) return "errors.type";
    if (err.status === 404) return "errors.gone";
    if (err.status === 400) return "errors.invalid";
    if (err.status === 0) return "errors.network";
  }
  return "errors.generic";
}

function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("not an image"));
    img.src = src;
  });
}

// Quick checks in the browser (the server checks again). A preview URL, or an error key.
async function prepareFile(
  file: File,
  min: { width: number; height: number },
  types: string[],
): Promise<{ preview: string } | { error: string }> {
  if (!types.includes(file.type)) return { error: types === GALLERY_TYPES ? "errors.typeGallery" : "errors.type" };
  if (file.size > BANNER_MAX_BYTES) return { error: "errors.size" };
  const preview = URL.createObjectURL(file);
  try {
    const { width, height } = await imageSize(preview);
    if (width < min.width || height < min.height) {
      URL.revokeObjectURL(preview);
      return { error: "errors.small" };
    }
  } catch {
    URL.revokeObjectURL(preview);
    return { error: "errors.type" };
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
function fromLocalInput(value: string): string {
  return value ? new Date(value).toISOString() : "";
}

type Status = "live" | "hidden" | "scheduled" | "ended";
function statusOf(b: AdminBanner, now: Date): Status {
  if (b.liveNow) return "live";
  if (!b.isActive) return "hidden";
  if (b.startsAt && new Date(b.startsAt) > now) return "scheduled";
  return "ended";
}
const STATUS_CLASS: Record<Status, string> = {
  live: "bg-success-soft text-success-ink",
  hidden: "bg-subtle text-ink-secondary",
  scheduled: "bg-info-soft text-ink",
  ended: "bg-warning-soft text-ink",
};

export function BannersManager() {
  const t = useTranslations("AdminBanners");
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<Panel>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [placement, setPlacement] = useState<BannerPlacement>("HERO");
  const list = useQuery({ queryKey: bannerKeys.list(placement), queryFn: () => listAdminBanners(placement) });

  const changed = () => {
    void queryClient.invalidateQueries({ queryKey: bannerKeys.all });
    refreshPublicPages(["banners"]);
  };

  const reorder = useMutation({
    mutationFn: reorderBanners,
    onMutate: () => setMessage(null),
    onSuccess: changed,
    onError: (err) => {
      setMessage(t(errorKey(err)));
      void list.refetch();
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => setBannerActive(id, on),
    onMutate: () => setMessage(null),
    onSuccess: changed,
    onError: (err) => setMessage(t(errorKey(err))),
  });
  const remove = useMutation({
    mutationFn: deleteBanner,
    onMutate: () => setMessage(null),
    onSuccess: changed,
    onError: (err) => setMessage(t(errorKey(err))),
  });

  if (list.isPending) return <div className="h-64 skeleton rounded-md" aria-hidden />;
  if (list.isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="type-h3 text-ink">{t("loadError")}</p>
        <button type="button" onClick={() => list.refetch()} className={outline}>
          {t("retry")}
        </button>
      </div>
    );
  }

  const { banners, meta } = list.data;
  const full = meta.total >= meta.max;

  function move(index: number, by: -1 | 1) {
    const ids = banners.map((b) => b.id);
    const target = index + by;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    // Show the new order at once; the server confirms.
    queryClient.setQueryData(bannerKeys.list(placement), { meta, banners: ids.map((id) => banners.find((b) => b.id === id)!) });
    reorder.mutate(ids);
  }

  return (
    <div className="flex flex-col gap-5">
      <div role="group" aria-label={t("placementLabel")} className="flex gap-2">
        {PLACEMENTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPlacement(p)}
            aria-pressed={placement === p}
            className={cn(
              "type-body-medium h-11 rounded-full border px-4 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
              placement === p ? "border-brand bg-brand text-primary-foreground" : "border-line bg-card text-ink-secondary hover:border-brand",
            )}
          >
            {t(`placements.${p}`)}
          </button>
        ))}
      </div>
      {placement === "GALLERY" && <p className="type-body -mt-2 text-ink-secondary">{t("galleryIntro")}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="type-body text-ink-secondary">
          <span className={cn("type-body-medium", full ? "text-error" : "text-ink")}>{t("count", { total: meta.total, max: meta.max })}</span>
          {full && <span className="ml-2">{t("fullHint")}</span>}
        </p>
        <button type="button" onClick={() => setPanel({ kind: "add" })} disabled={full} className={primary}>
          <Plus className="size-4" aria-hidden />
          {t("add")}
        </button>
      </div>

      {message && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {message}
        </p>
      )}

      {banners.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-line-strong py-12 text-center">
          <ImagePlus className="size-8 text-ink-muted" aria-hidden />
          <p className="type-h3 text-ink">{t("emptyTitle")}</p>
          <p className="type-body max-w-sm text-ink-secondary">{t("emptyText")}</p>
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {banners.map((b, i) => (
            <BannerRow
              key={b.id}
              banner={b}
              first={i === 0}
              last={i === banners.length - 1}
              busy={reorder.isPending || toggle.isPending || remove.isPending}
              onUp={() => move(i, -1)}
              onDown={() => move(i, 1)}
              onToggle={() => toggle.mutate({ id: b.id, on: !b.isActive })}
              onEdit={() => setPanel({ kind: "edit", banner: b })}
              onDelete={() => remove.mutate(b.id)}
            />
          ))}
        </ol>
      )}

      <Sheet open={panel !== null} onOpenChange={(open) => !open && setPanel(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="type-h3 text-ink">{panel?.kind === "edit" ? t("editTitle") : t("addTitle")}</SheetTitle>
            <SheetDescription className="type-caption text-ink-muted">{t(`sizeHint${HINT_SUFFIX[placement]}`)}</SheetDescription>
          </SheetHeader>
          {panel && (
            <BannerForm
              key={panel.kind === "edit" ? panel.banner.id : "new"}
              banner={panel.kind === "edit" ? panel.banner : null}
              placement={placement}
              onDone={() => {
                setPanel(null);
                changed();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function BannerRow(props: {
  banner: AdminBanner;
  first: boolean;
  last: boolean;
  busy: boolean;
  onUp: () => void;
  onDown: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { banner: b } = props;
  const t = useTranslations("AdminBanners");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const [confirming, setConfirming] = useState(false);
  const status = statusOf(b, now);
  const thumb = safeMediaUrl(b.media.thumbUrl) ?? safeMediaUrl(b.media.url);
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });

  return (
    <li className="flex flex-col gap-3 rounded-md border border-line bg-card p-3 shadow-card md:flex-row md:items-center md:gap-4">
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl bg-subtle",
          b.placement === "GALLERY" ? "aspect-square w-32" : "aspect-4/1 w-full md:w-64",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- media server thumbnail, already resized */}
        {thumb && <img src={thumb} alt="" className="size-full object-cover" loading="lazy" />}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="type-body-medium truncate text-ink">{b.titleEn}</p>
          <span className={cn("type-caption rounded-full px-2 py-0.5", STATUS_CLASS[status])}>{t(`status.${status}`)}</span>
          {b.mediaType === "GIF" && <span className="type-caption rounded-full bg-highlight-soft px-2 py-0.5 text-highlight">GIF</span>}
        </div>
        {(b.startsAt || b.endsAt) && (
          <p className="type-caption text-ink-muted">
            {b.startsAt && t("from", { date: when(b.startsAt) })} {b.endsAt && t("until", { date: when(b.endsAt) })}
          </p>
        )}
        {b.linkUrl && <p className="type-caption truncate text-ink-muted">{b.linkUrl}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={props.onUp} disabled={props.first || props.busy} aria-label={t("moveUp", { title: b.titleEn })} className={iconButton}>
          <ArrowUp className="size-4" aria-hidden />
        </button>
        <button type="button" onClick={props.onDown} disabled={props.last || props.busy} aria-label={t("moveDown", { title: b.titleEn })} className={iconButton}>
          <ArrowDown className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={b.isActive}
          aria-label={t("activeLabel", { title: b.titleEn })}
          onClick={props.onToggle}
          disabled={props.busy}
          className="flex h-11 items-center gap-2 rounded-sm px-2 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60"
        >
          <span aria-hidden className={cn("relative h-6 w-11 rounded-full motion-safe:transition-colors", b.isActive ? "bg-brand" : "bg-line-strong")}>
            <span
              className={cn(
                "absolute top-0.5 left-0.5 size-5 rounded-full bg-card shadow-card motion-safe:transition-transform motion-safe:duration-200",
                b.isActive && "translate-x-5",
              )}
            />
          </span>
          <span className="type-caption text-ink-secondary">{b.isActive ? t("on") : t("off")}</span>
        </button>
        <button type="button" onClick={props.onEdit} className={outline}>
          <Pencil className="size-4" aria-hidden />
          {t("edit")}
        </button>
        {confirming ? (
          <span className="flex items-center gap-2">
            <button type="button" onClick={() => setConfirming(false)} className={outline}>
              {t("keep")}
            </button>
            <button
              type="button"
              onClick={props.onDelete}
              disabled={props.busy}
              className="type-body-medium inline-flex h-11 items-center gap-1.5 rounded-sm bg-error px-3 text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
            >
              {t("confirmDelete")}
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} aria-label={t("deleteLabel", { title: b.titleEn })} className={cn(iconButton, "text-error")}>
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
}

function emptyInput(placement: BannerPlacement): BannerInput {
  return { titleEn: "", titleBn: "", subtitleEn: "", subtitleBn: "", linkUrl: "", ctaLabelEn: "", ctaLabelBn: "", isActive: true, fit: "COVER", placement, startsAt: "", endsAt: "" };
}

function FilePicker(props: {
  label: string;
  hint: string;
  current: string | null;
  preview: string | null;
  aspect: string;
  accept: string[];
  fit?: BannerInput["fit"];
  onPick: (file: File | undefined) => void;
}) {
  const id = useId();
  const shown = props.preview ?? props.current;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="type-body-medium text-ink">
        {props.label}
      </label>
      <div className={cn("relative overflow-hidden rounded-xl border border-dashed border-line-strong bg-subtle", props.aspect)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob:) or media thumbnail */}
        {shown && <img src={shown} alt="" className={cn("size-full", props.fit === "CONTAIN" ? "object-contain" : "object-cover")} />}
      </div>
      <input
        id={id}
        type="file"
        accept={props.accept.join(",")}
        onChange={(e) => props.onPick(e.target.files?.[0])}
        className="type-body text-ink-secondary file:mr-3 file:h-11 file:rounded-sm file:border file:border-brand file:bg-card file:px-4 file:text-brand hover:file:bg-subtle"
      />
      <p className="type-caption text-ink-muted">{props.hint}</p>
    </div>
  );
}

function BannerForm({ banner, placement, onDone }: { banner: AdminBanner | null; placement: BannerPlacement; onDone: () => void }) {
  const t = useTranslations("AdminBanners");
  const [input, setInput] = useState<BannerInput>(() =>
    banner
      ? {
          titleEn: banner.titleEn,
          titleBn: banner.titleBn ?? "",
          subtitleEn: banner.subtitleEn ?? "",
          subtitleBn: banner.subtitleBn ?? "",
          linkUrl: banner.linkUrl ?? "",
          ctaLabelEn: banner.ctaLabelEn ?? "",
          ctaLabelBn: banner.ctaLabelBn ?? "",
          isActive: banner.isActive,
          fit: banner.fit ?? "COVER",
          placement: banner.placement ?? placement,
          startsAt: toLocalInput(banner.startsAt),
          endsAt: toLocalInput(banner.endsAt),
        }
      : emptyInput(placement),
  );
  const [media, setMedia] = useState<{ file: File; preview: string } | null>(null);
  const [mobile, setMobile] = useState<{ file: File; preview: string } | null>(null);
  const [removeMobile, setRemoveMobile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Free the local previews when they change or the form closes.
  useEffect(() => () => void (media && URL.revokeObjectURL(media.preview)), [media]);
  useEffect(() => () => void (mobile && URL.revokeObjectURL(mobile.preview)), [mobile]);

  const save = useMutation({
    mutationFn: () => {
      const body: BannerInput = { ...input, startsAt: fromLocalInput(input.startsAt), endsAt: fromLocalInput(input.endsAt) };
      return banner
        ? updateBanner(banner.id, body, { media: media?.file, mobileMedia: mobile?.file, removeMobileMedia: removeMobile && !mobile })
        : createBanner(body, media!.file, mobile?.file ?? null);
    },
    onMutate: () => setError(null),
    onSuccess: onDone,
    onError: (err) => setError(t(errorKey(err))),
  });

  const set = (key: keyof BannerInput) => (e: { target: { value: string } }) => setInput((v) => ({ ...v, [key]: e.target.value }));

  async function pick(kind: "media" | "mobile", file: File | undefined) {
    if (!file) return;
    const result = await prepareFile(file, kind === "media" ? MIN[input.placement] : MIN.mobile, typesFor(input.placement));
    if ("error" in result) {
      setError(t(result.error));
      return;
    }
    setError(null);
    if (kind === "media") setMedia({ file, preview: result.preview });
    else {
      setMobile({ file, preview: result.preview });
      setRemoveMobile(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = input.titleEn.trim();
    if (!title) return setError(t("errors.title"));
    if (!banner && !media) return setError(t("errors.media"));
    const link = input.linkUrl.trim();
    if (link && !(/^\/(?!\/)[^\s\\]*$/.test(link) || /^https:\/\/[^\s]+$/.test(link))) return setError(t("errors.link"));
    if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) return setError(t("errors.dates"));
    save.mutate();
  }

  const currentMobile = banner?.mobileMedia && !removeMobile ? safeMediaUrl(banner.mobileMedia.thumbUrl) : null;
  // Gallery pictures are images only: no phone version, fit, subtitle or button.
  const gallery = input.placement === "GALLERY";

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 px-4 pb-4">
      <FilePicker
        label={t("media")}
        hint={t(`mediaHint${HINT_SUFFIX[input.placement]}`)}
        current={banner ? safeMediaUrl(banner.media.thumbUrl) : null}
        preview={media?.preview ?? null}
        aspect={input.placement === "SIDE_AD" ? "aspect-2/3 max-w-48" : gallery ? "aspect-square max-w-56" : "aspect-4/1"}
        accept={typesFor(input.placement)}
        fit={input.fit}
        onPick={(f) => void pick("media", f)}
      />
      {!gallery && (
        <>
          <FilePicker
            label={t("mobileMedia")}
            hint={t("mobileHint")}
            current={currentMobile}
            preview={mobile?.preview ?? null}
            aspect="aspect-5/2"
            accept={BANNER_TYPES}
            onPick={(f) => void pick("mobile", f)}
          />
          {banner?.mobileMedia && !mobile && !removeMobile && (
            <button type="button" onClick={() => setRemoveMobile(true)} className={cn(outline, "self-start border-error text-error hover:bg-error-soft")}>
              {t("removeMobile")}
            </button>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="type-body-medium mb-1 text-ink">{t("fit")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["COVER", "CONTAIN"] as const).map((f) => (
                <label
                  key={f}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand",
                    input.fit === f ? "border-brand bg-subtle" : "border-line",
                  )}
                >
                  <input type="radio" name="fit" value={f} checked={input.fit === f} onChange={() => setInput((v) => ({ ...v, fit: f }))} className="mt-1 size-4 accent-brand" />
                  <span className="flex flex-col">
                    <span className="type-body-medium text-ink">{t(`fitOptions.${f}.label`)}</span>
                    <span className="type-caption text-ink-muted">{t(`fitOptions.${f}.hint`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <TextField label={t("titleEn")} value={input.titleEn} onChange={set("titleEn")} maxLength={120} required hint={t("titleHint")} />
      <TextField label={t("titleBn")} value={input.titleBn} onChange={set("titleBn")} maxLength={120} lang="bn" />
      {!gallery && (
        <>
          <TextField label={t("subtitleEn")} value={input.subtitleEn} onChange={set("subtitleEn")} maxLength={200} />
          <TextField label={t("subtitleBn")} value={input.subtitleBn} onChange={set("subtitleBn")} maxLength={200} lang="bn" />
        </>
      )}
      <TextField label={t("linkUrl")} value={input.linkUrl} onChange={set("linkUrl")} maxLength={500} hint={t("linkHint")} inputMode="url" />
      {!gallery && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("ctaEn")} value={input.ctaLabelEn} onChange={set("ctaLabelEn")} maxLength={40} />
          <TextField label={t("ctaBn")} value={input.ctaLabelBn} onChange={set("ctaLabelBn")} maxLength={40} lang="bn" />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("startsAt")} type="datetime-local" value={input.startsAt} onChange={set("startsAt")} />
        <TextField label={t("endsAt")} type="datetime-local" value={input.endsAt} onChange={set("endsAt")} />
      </div>
      <p className="type-caption -mt-2 text-ink-muted">{t("scheduleHint")}</p>

      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          checked={input.isActive}
          onChange={(e) => setInput((v) => ({ ...v, isActive: e.target.checked }))}
          className="size-5 accent-brand"
        />
        <span className="type-body text-ink">{t("activeField")}</span>
      </label>

      {error && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <button type="submit" disabled={save.isPending} aria-busy={save.isPending} className={cn(primary, "h-12")}>
        {save.isPending && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
        {banner ? t("save") : t("create")}
      </button>
    </form>
  );
}
