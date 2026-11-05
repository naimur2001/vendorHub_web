"use client";

import { Download, Eye, LoaderCircle, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ApiError, fetchPrivateFile, isPrivateFileUrl } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; kind: "image" | "pdf" | "other"; url: string };

// Images are shown as a data: address (allowed for images by our security policy).
function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * One private verification document: loaded only on click, with the admin's token,
 * kept in memory only and released when the panel closes.
 */
export function PrivateDocument({ fileUrl, label, fileName }: { fileUrl: string; label: string; fileName: string }) {
  const t = useTranslations("AdminReview.document");
  const [state, setState] = useState<State>({ phase: "idle" });
  const [zoomed, setZoomed] = useState(false);

  // Free the in-memory copy when another file loads or the panel closes.
  useEffect(() => {
    return () => {
      if (state.phase === "ready" && state.url.startsWith("blob:")) URL.revokeObjectURL(state.url);
    };
  }, [state]);

  // Never fetch (or link to) anything that isn't our own API's private file address.
  if (!isPrivateFileUrl(fileUrl)) {
    return (
      <p className="type-caption flex items-start gap-1.5 text-ink-muted">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t("notOurs")}
      </p>
    );
  }

  async function load() {
    setState({ phase: "loading" });
    try {
      const blob = await fetchPrivateFile(fileUrl);
      if (blob.type.startsWith("image/")) {
        setState({ phase: "ready", kind: "image", url: await toDataUrl(blob) });
      } else {
        setState({ phase: "ready", kind: blob.type === "application/pdf" ? "pdf" : "other", url: URL.createObjectURL(blob) });
      }
    } catch (err) {
      setState({ phase: "error", message: err instanceof ApiError && err.status === 404 ? t("notFound") : t("error") });
    }
  }

  if (state.phase === "idle") {
    return (
      <button
        type="button"
        onClick={load}
        className="type-body-medium flex h-10 items-center gap-2 self-start rounded-sm border border-brand px-3 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        <Eye className="size-4" aria-hidden />
        {t("view")}
      </button>
    );
  }

  if (state.phase === "loading") {
    return (
      <p role="status" className="type-body flex items-center gap-2 text-ink-secondary">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {t("loading")}
      </p>
    );
  }

  if (state.phase === "error") {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2">
        <p className="type-body text-error">{state.message}</p>
        <button type="button" onClick={load} className="type-body-medium text-brand underline-offset-4 hover:underline">
          {t("retry")}
        </button>
      </div>
    );
  }

  if (state.kind === "image") {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setZoomed((z) => !z)}
          aria-pressed={zoomed}
          className="overflow-hidden rounded-sm border border-line bg-surface focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- in-memory private file, not a page image */}
          <img src={state.url} alt={label} className={cn("w-full object-contain", zoomed ? "max-h-none" : "max-h-72")} />
        </button>
        <p className="type-caption text-ink-muted">{t("zoom")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <a
        href={state.url}
        download={fileName}
        className="type-body-medium flex h-10 items-center gap-2 self-start rounded-sm bg-action px-3 text-primary-foreground hover:bg-action-hover"
      >
        <Download className="size-4" aria-hidden />
        {state.kind === "pdf" ? t("downloadPdf") : t("downloadFile")}
      </a>
      <p className="type-caption text-ink-muted">{t("downloadNote")}</p>
    </div>
  );
}