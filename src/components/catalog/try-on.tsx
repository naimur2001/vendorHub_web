"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle, Shirt } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/app-providers";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "@/i18n/routing";
import { ApiError } from "@/lib/api/core";
import { createTryOn, dataUrlToBlob, getTryOnInfo, type TryOnView } from "@/lib/api/try-on";
import { cn } from "@/lib/utils";

type Frame = { state: "waiting" | "creating" | "done" | "failed"; url?: string };

function errorKey(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return "errors.limit";
    if (err.status === 422 || err.status === 400) return "errors.photo";
    if (err.status === 409) return "errors.notEligible";
    if (err.status >= 502) return "errors.unavailable";
  }
  return "errors.generic";
}

/** One big picture: drag/swipe, arrows or the slider turn it; "Turn automatically" sways left↔right. */
/** 3D ring: the pictures stand in a circle; drag/swipe or the arrows turn it, "Turn automatically" spins it 360°. */
function TurnViewer({ views, frames, start }: { views: TryOnView[]; frames: Partial<Record<TryOnView, Frame>>; start: TryOnView }) {
  const t = useTranslations("TryOn");
  const n = views.length;
  const step = 360 / n;
  const cardW = 150; // px
  const radius = Math.round(cardW / 2 / Math.tan(Math.PI / n)) + 70;

  const [angle, setAngle] = useState(-Math.max(0, views.indexOf(start)) * step);
  const [snap, setSnap] = useState(true); // smooth move after release or arrow clicks
  const [auto, setAuto] = useState(false);
  const drag = useRef<{ x: number; a: number } | null>(null);
  const ready = views.every((v) => frames[v]?.state === "done");

  // Continuous spin (paused by the user or by "reduce motion").
  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setSnap(false);
    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      setAngle((a) => a - (now - prev) * 0.03); // ~30° per second
      prev = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [auto]);

  const settle = (a: number) => { setSnap(true); setAngle(Math.round(a / step) * step); };
  const front = ((Math.round(-angle / step) % n) + n) % n;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative h-80 w-full cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing"
        style={{ perspective: "1100px" }}
        onPointerDown={(e) => { setAuto(false); setSnap(false); drag.current = { x: e.clientX, a: angle }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (drag.current) setAngle(drag.current.a + (e.clientX - drag.current.x) * 0.4); }}
        onPointerUp={() => { if (drag.current) settle(angle); drag.current = null; }}
        onPointerCancel={() => { if (drag.current) settle(angle); drag.current = null; }}
        role="img"
        aria-label={t(`view.${views[front]}`)}
      >
        <div
          className={cn("absolute top-1/2 left-1/2", snap && "motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out")}
          style={{ transformStyle: "preserve-3d", transform: `translate(-50%, -50%) translateZ(${-radius}px) rotateX(-8deg) rotateY(${angle}deg)` }}
        >
          {views.map((v, k) => {
            const fr = frames[v];
            // How much this card faces us: 1 = front, -1 = back (dim the back ones).
            const facing = Math.cos(((k * step + angle) * Math.PI) / 180);
            return (
              <div
                key={v}
                className="absolute overflow-hidden rounded-xl border border-line bg-subtle shadow-card"
                style={{
                  width: cardW,
                  height: cardW * (4 / 3),
                  left: -cardW / 2,
                  top: -(cardW * (4 / 3)) / 2,
                  transform: `rotateY(${k * step}deg) translateZ(${radius}px)`,
                  opacity: 0.35 + 0.65 * Math.max(0, facing),
                }}
              >
                {fr?.state === "done" && fr.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- in-memory data URL, never stored
                  <img src={fr.url} alt="" draggable={false} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center px-2 text-center">
                    {fr?.state === "creating" ? <LoaderCircle className="size-6 animate-spin text-ink-muted" aria-hidden /> : fr?.state === "failed" ? <CircleAlert className="size-5 text-error" aria-hidden /> : <span className="type-caption text-ink-muted">{t("waiting")}</span>}
                  </span>
                )}
                <span className="type-caption absolute inset-x-0 bottom-0 bg-ink/55 py-0.5 text-center text-primary-foreground">{t(`view.${v}`)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => { setAuto(false); settle(angle + step); }} aria-label={t("prev")} className="flex size-10 items-center justify-center rounded-full border border-line-strong text-ink hover:bg-subtle">‹</button>
        <span className="type-body-medium min-w-24 text-center text-ink">{t(`view.${views[front]}`)}</span>
        <button type="button" onClick={() => { setAuto(false); settle(angle - step); }} aria-label={t("next")} className="flex size-10 items-center justify-center rounded-full border border-line-strong text-ink hover:bg-subtle">›</button>
      </div>
      <div className="flex items-center gap-3">
        <span className="type-caption text-ink-muted">{t("rotate")}</span>
        <button type="button" onClick={() => (auto ? (setAuto(false), settle(angle)) : setAuto(true))} disabled={!ready} className="type-body-medium h-9 rounded-sm border border-brand px-3 text-brand hover:bg-subtle disabled:opacity-40">
          {auto ? t("stop") : t("autoRotate")}
        </button>
      </div>
    </div>
  );
}

/** Product page: "Try it on" (only when the backend says this product is eligible). */
export function TryOn({ slug, productId }: { slug: string; productId: string }) {
  const t = useTranslations("TryOn");
  const { status } = useSession();
  const info = useQuery({ queryKey: ["try-on", slug], queryFn: () => getTryOnInfo(slug), staleTime: 10 * 60_000 });
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [frames, setFrames] = useState<Partial<Record<TryOnView, Frame>>>({});
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const cancelled = useRef(false);
  // const roll = useRef<HTMLDivElement>(null);

  // Closing the panel drops everything (pictures live in memory only).
  function reset() {
    cancelled.current = true;
    setFrames({});
    setPhoto(null);
    setAgreed(false);
    setError(null);
    setRunning(false);
  }

  // Scroll the roll to the start view once it exists.
  const start = info.data?.startView ?? "FRONT";
  // useEffect(() => {
  //   if (frames[start]?.state === "done") roll.current?.querySelector(`[data-view="${start}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
  // }, [frames, start]);

  if (!info.data?.available) return null;
  const { views, createOrder } = info.data;

  function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setError(t("errors.type"));
    if (f.size > 5 * 1024 * 1024) return setError(t("errors.size"));
    setPhoto(f);
  }

  async function run() {
    if (!photo) return;
    cancelled.current = false;
    setRunning(true);
    setError(null);
    setFrames(Object.fromEntries(createOrder.map((v) => [v, { state: "waiting" }])));
    let reference: Blob | undefined;
    for (const [i, view] of createOrder.entries()) {
      if (cancelled.current) return;
      setFrames((f) => ({ ...f, [view]: { state: "creating" } }));
      try {
        const url = await createTryOn(productId, view, photo, reference);
        if (cancelled.current) return;
        setFrames((f) => ({ ...f, [view]: { state: "done", url } }));
        if (i === 0) reference = await dataUrlToBlob(url); // the first picture keeps the others consistent
      } catch (err) {
        if (cancelled.current) return;
        setFrames((f) => ({ ...f, [view]: { state: "failed" } }));
        console.warn("try-on failed", view, err instanceof ApiError ? String(err.status) + " " + err.message : err);
        // Without the first picture (or at the daily limit) the rest can't follow.
        if (i === 0 || (err instanceof ApiError && err.status === 429)) {
          setError(t(errorKey(err)));
          break;
        }
      }
    }
    setRunning(false);
  }

  const creatingView = createOrder.find((v) => frames[v]?.state === "creating");
  const started = Object.keys(frames).length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <button type="button" onClick={() => setOpen(true)} className="type-body-medium flex h-11 items-center justify-center gap-2 rounded-sm border border-brand px-4 text-brand hover:bg-subtle">
        <Shirt className="size-5" aria-hidden />
        {t("button")}
      </button>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="type-h3 text-ink">{t("title")}</DialogTitle>
          <DialogDescription className="type-caption text-ink-muted">{t("aiNote")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-4">
          {status !== "authenticated" ? (
            <div className="flex flex-col items-start gap-3">
              <p className="type-body text-ink">{t("loginTitle")}</p>
              <Link href={`/auth/login?next=${encodeURIComponent(`/products/${slug}`)}`} className="type-body-medium flex h-11 items-center rounded-sm bg-action px-5 text-primary-foreground">{t("logIn")}</Link>
            </div>
          ) : !started ? (
            <>
              <p className="type-body text-ink-secondary">{t("intro")}</p>
              {info.data.notice && <p className="type-caption rounded-md bg-highlight-soft p-3 text-ink">{info.data.notice}</p>}
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-5 accent-brand" />
                <span className="type-body text-ink">{t("agree")}</span>
              </label>
              <label className={cn("type-body-medium flex h-11 cursor-pointer items-center justify-center rounded-sm border border-brand px-4 text-brand hover:bg-subtle has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand", !agreed && "pointer-events-none opacity-50")}>
                {photo ? photo.name.slice(0, 30) : t("choose")}
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!agreed} className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              <p className="type-caption text-ink-muted">{t("rules")}</p>
              <button type="button" onClick={() => void run()} disabled={!agreed || !photo} className="type-body-medium h-12 rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover disabled:opacity-50">{t("start")}</button>
            </>
          ) : (
            <>
              {creatingView && (
                <p role="status" className="type-body flex items-center gap-2 text-ink-secondary">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  {t("creating", { view: t(`view.${creatingView}`) })}
                </p>
              )}
              {/* The swipe roll: left → front → right */}
              <div  className="scroll-row -mx-4 snap-x snap-mandatory px-4">
                             <TurnViewer views={views} frames={frames} start={start} />
              </div>
              <p className="type-caption text-ink-muted">{t("aiNote")}</p>
              {!running && <button type="button" onClick={reset} className="type-body-medium h-11 self-start rounded-sm border border-brand px-4 text-brand hover:bg-subtle">{t("again")}</button>}
            </>
          )}
          {error && <p role="alert" className="type-body text-error">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
  
}