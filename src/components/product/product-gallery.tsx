"use client";

import { ChevronLeft, ChevronRight, Maximize2, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type WheelEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { safeMediaUrl } from "@/lib/api/storefront";
import { cn } from "@/lib/utils";

type Props = {
  images: string[];
  title: string;
  placeholder: React.ReactNode; // shown when the product has no photos
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const STEP = 0.5;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const roundButton =
  "flex size-11 items-center justify-center rounded-full bg-card/90 text-ink shadow-card backdrop-blur-sm hover:bg-card focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-40";

/**
 * Product photos: a square main photo with softly rounded corners. On a mouse it magnifies where the
 * pointer is; a tap or click opens a full-screen viewer with zoom in / out (buttons, wheel, pinch,
 * double tap) and drag to move. Arrows and thumbnails switch photos. Only transform is animated.
 */
export function ProductGallery({ images: raw, title, placeholder }: Props) {
  const t = useTranslations("Product");
  const images = raw.map((src) => safeMediaUrl(src)).filter((src): src is string => Boolean(src));
  const total = images.length;
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  // Hover magnifier (mouse only): where the pointer is, in % of the photo.
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const current = images[Math.min(index, total - 1)];
  const label = (i: number) => t("photoN", { n: i + 1, total });

  const go = (by: number) => setIndex((i) => (i + by + total) % total);

  function onMove(e: PointerEvent<HTMLButtonElement>) {
    if (e.pointerType !== "mouse") return;
    const box = e.currentTarget.getBoundingClientRect();
    setLens({ x: ((e.clientX - box.left) / box.width) * 100, y: ((e.clientY - box.top) / box.height) * 100 });
  }

  return (
    <div className="flex flex-col gap-3 lg:max-w-[560px]">
      <div className="group/photo relative aspect-square w-full overflow-hidden rounded-2xl border border-line bg-card shadow-card">
        {current ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            onPointerMove={onMove}
            onPointerLeave={() => setLens(null)}
            aria-label={t("zoomOpen", { n: index + 1 })}
            className="absolute inset-0 cursor-zoom-in focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none focus-visible:ring-inset"
          >
            <Image
              src={current}
              alt={`${title}: ${label(index)}`}
              fill
              unoptimized
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-contain motion-safe:transition-transform motion-safe:duration-200"
              style={lens ? { transform: "scale(2)", transformOrigin: `${lens.x}% ${lens.y}%` } : undefined}
            />
          </button>
        ) : (
          placeholder
        )}

        {current && (
          <span aria-hidden className="pointer-events-none absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-full bg-card/90 text-ink shadow-card">
            <Maximize2 className="size-4" />
          </span>
        )}
        {total > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label={t("prevPhoto")} className={cn(roundButton, "absolute top-1/2 left-3 -translate-y-1/2")}>
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button type="button" onClick={() => go(1)} aria-label={t("nextPhoto")} className={cn(roundButton, "absolute top-1/2 right-3 -translate-y-1/2")}>
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </>
        )}
      </div>

      {total > 1 && <Thumbnails images={images} index={index} onPick={setIndex} label={label} listLabel={t("photos")} />}

      {current && (
        <Dialog open={open} onOpenChange={setOpen}>
          {open && <ZoomViewer images={images} index={index} onIndex={setIndex} title={title} label={label} onClose={() => setOpen(false)} />}
        </Dialog>
      )}
    </div>
  );
}

function Thumbnails({
  images,
  index,
  onPick,
  label,
  listLabel,
  dark = false,
}: {
  images: string[];
  index: number;
  onPick: (i: number) => void;
  label: (i: number) => string;
  listLabel: string;
  dark?: boolean;
}) {
  return (
    <ul aria-label={listLabel} className="scroll-row flex gap-2 overflow-x-auto p-1">
      {images.map((src, i) => (
        <li key={src} className="shrink-0">
          <button
            type="button"
            onClick={() => onPick(i)}
            aria-pressed={i === index}
            aria-label={label(i)}
            className={cn(
              "relative block size-16 overflow-hidden rounded-xl border-2 bg-card focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
              i === index ? "border-brand" : dark ? "border-transparent opacity-70 hover:opacity-100" : "border-transparent hover:border-line-strong",
            )}
          >
            <Image src={src} alt="" fill unoptimized sizes="64px" className="object-cover" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Full-screen photo with zoom (1x to 4x) and drag to move when zoomed. */
function ZoomViewer(props: {
  images: string[];
  index: number;
  onIndex: (i: number) => void;
  title: string;
  label: (i: number) => string;
  onClose: () => void;
}) {
  const { images, index, onIndex, title, label, onClose } = props;
  const t = useTranslations("Product");
  const total = images.length;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const lastTap = useRef(0);

  function setZoomTo(next: number) {
    const z = clamp(Math.round(next * 100) / 100, MIN_ZOOM, MAX_ZOOM);
    setZoom(z);
    if (z === 1) setPan({ x: 0, y: 0 });
  }
  function show(i: number) {
    onIndex((i + total) % total);
    setZoomTo(1);
  }

  function onWheel(e: WheelEvent) {
    setZoomTo(zoom + (e.deltaY < 0 ? STEP : -STEP));
  }
  function onDoubleClick(e: MouseEvent) {
    e.preventDefault();
    setZoomTo(zoom > 1 ? 1 : 2.5);
  }
  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      drag.current = null;
    } else {
      drag.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      // Double tap on touch screens
      if (e.pointerType !== "mouse") {
        const now = Date.now();
        if (now - lastTap.current < 300) setZoomTo(zoom > 1 ? 1 : 2.5);
        lastTap.current = now;
      }
    }
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      setZoomTo(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.distance));
    } else if (drag.current && zoom > 1) {
      setPan({ x: drag.current.panX + (e.clientX - drag.current.x) / zoom, y: drag.current.panY + (e.clientY - drag.current.y) / zoom });
    }
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "+" || e.key === "=") setZoomTo(zoom + STEP);
    else if (e.key === "-") setZoomTo(zoom - STEP);
    else if (e.key === "0") setZoomTo(1);
    else if (e.key === "ArrowLeft" && total > 1) show(index - 1);
    else if (e.key === "ArrowRight" && total > 1) show(index + 1);
    else return;
    e.preventDefault();
  }

  return (
    <DialogContent
      showCloseButton={false}
      onKeyDown={onKeyDown}
      className="flex h-[100dvh] max-h-none w-screen max-w-none flex-col gap-0 rounded-none bg-ink p-0 text-primary-foreground ring-0 sm:max-w-none motion-reduce:animate-none"
    >
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <DialogTitle className="type-body-medium truncate text-primary-foreground">{title}</DialogTitle>
          <DialogDescription className="type-caption text-primary-foreground/70">
            {label(index)} · {t("zoomHint")}
          </DialogDescription>
        </div>
        <button type="button" onClick={onClose} aria-label={t("zoomClose")} className={roundButton}>
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {/* The photo: zoom with wheel, pinch or double tap; drag to move when zoomed */}
      <div
        className={cn("relative min-h-0 flex-1 touch-none overflow-hidden select-none", zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="absolute inset-0 motion-safe:transition-transform motion-safe:duration-150"
          style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
        >
          <Image src={images[index]} alt={`${title}: ${label(index)}`} fill unoptimized sizes="100vw" draggable={false} className="object-contain" />
        </div>

        {total > 1 && (
          <>
            <button type="button" onClick={() => show(index - 1)} aria-label={t("prevPhoto")} className={cn(roundButton, "absolute top-1/2 left-3 -translate-y-1/2")}>
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button type="button" onClick={() => show(index + 1)} aria-label={t("nextPhoto")} className={cn(roundButton, "absolute top-1/2 right-3 -translate-y-1/2")}>
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div role="group" aria-label={t("zoomLevel", { percent: Math.round(zoom * 100) })} className="flex items-center gap-2">
          <button type="button" onClick={() => setZoomTo(zoom - STEP)} disabled={zoom <= MIN_ZOOM} aria-label={t("zoomOut")} className={roundButton}>
            <ZoomOut className="size-5" aria-hidden />
          </button>
          <output aria-live="polite" className="type-body-medium w-16 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </output>
          <button type="button" onClick={() => setZoomTo(zoom + STEP)} disabled={zoom >= MAX_ZOOM} aria-label={t("zoomIn")} className={roundButton}>
            <ZoomIn className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={() => setZoomTo(1)} disabled={zoom === 1} aria-label={t("zoomReset")} className={roundButton}>
            <RotateCcw className="size-5" aria-hidden />
          </button>
        </div>
        {total > 1 && <Thumbnails images={images} index={index} onPick={show} label={label} listLabel={t("photos")} dark />}
      </div>
    </DialogContent>
  );
}
