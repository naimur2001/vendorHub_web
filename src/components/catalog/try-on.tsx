"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle, Shirt } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/app-providers";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  const roll = useRef<HTMLDivElement>(null);

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
  useEffect(() => {
    if (frames[start]?.state === "done") roll.current?.querySelector(`[data-view="${start}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [frames, start]);

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
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <button type="button" onClick={() => setOpen(true)} className="type-body-medium flex h-11 items-center justify-center gap-2 rounded-sm border border-brand px-4 text-brand hover:bg-subtle">
        <Shirt className="size-5" aria-hidden />
        {t("button")}
      </button>
      <SheetContent side="right" className="w-full overflow-y-auto bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="type-h3 text-ink">{t("title")}</SheetTitle>
          <SheetDescription className="type-caption text-ink-muted">{t("aiNote")}</SheetDescription>
        </SheetHeader>
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
              <div ref={roll} className="scroll-row -mx-4 snap-x snap-mandatory px-4">
                <ul className="flex w-max gap-3 pb-1">
                  {views.map((v) => {
                    const f = frames[v];
                    return (
                      <li key={v} data-view={v} className="flex w-60 snap-center flex-col gap-1">
                        <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border border-line bg-subtle">
                          {f?.state === "done" && f.url ? (
                            // eslint-disable-next-line @next/next/no-img-element -- in-memory data URL, never stored
                            <img src={f.url} alt={t(`view.${v}`)} className="h-full w-full object-cover" />
                          ) : f?.state === "creating" ? (
                            <LoaderCircle className="size-8 animate-spin text-ink-muted" aria-hidden />
                          ) : f?.state === "failed" ? (
                            <span className="type-caption flex items-center gap-1 px-3 text-center text-error"><CircleAlert className="size-4 shrink-0" aria-hidden />{t("failedView")}</span>
                          ) : (
                            <span className="type-caption text-ink-muted">{t("waiting")}</span>
                          )}
                        </div>
                        <span className={cn("type-caption text-center", v === start ? "font-medium text-ink" : "text-ink-secondary")}>{t(`view.${v}`)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <p className="type-caption text-ink-muted">{t("aiNote")}</p>
              {!running && <button type="button" onClick={reset} className="type-body-medium h-11 self-start rounded-sm border border-brand px-4 text-brand hover:bg-subtle">{t("again")}</button>}
            </>
          )}
          {error && <p role="alert" className="type-body text-error">{error}</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}