"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleCheck, Download, FileUp, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { ApiError } from "@/lib/api/core";
import { importListingsCsv, type ImportResult } from "@/lib/api/shop-tools";

const MAX_BYTES = 1024 * 1024; // backend limit: 1 MB, 500 rows
// A sample file built in the browser (no download from anywhere else).
const SAMPLE = "productSlug,price,stockQty,availability\ngalaxy-a55-5g-8-128gb,42500,5,\niphone-15-128gb,98000,,LIMITED\n";

/**
 * Bulk add or update listings from a CSV. The server checks every row first: one bad row and
 * nothing is saved, and every problem comes back with its row number.
 */
export function CsvImport({ shopId, onDone }: { shopId: string; onDone: (r: ImportResult) => void }) {
  const t = useTranslations("OwnerCsv");
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<ImportResult["errors"]>([]);

  const upload = useMutation({
    mutationFn: (f: File) => importListingsCsv(shopId, f),
    onMutate: () => {
      setError(null);
      setRowErrors([]);
    },
    onSuccess: onDone,
    onError: (err) => {
      if (err instanceof ApiError && err.status === 422) {
        const errs = (err.details as { errors?: ImportResult["errors"] } | undefined)?.errors ?? [];
        setRowErrors(errs);
        return setError(t("rowsInvalid", { count: errs.length }));
      }
      if (err instanceof ApiError && err.status === 413) return setError(t("tooBig"));
      if (err instanceof ApiError && err.status === 429) return setError(t("tooMany"));
      // 400: fixed messages about the file (columns, header); shown as plain text
      if (err instanceof ApiError && err.status === 400) return setError(err.message);
      setError(err instanceof ApiError && err.status === 0 ? t("network") : t("generic"));
    },
  });

  function pick(f: File | undefined) {
    setError(null);
    setRowErrors([]);
    if (!f) return setFile(null);
    if (!/\.csv$/i.test(f.name)) return setError(t("notCsv"));
    if (f.size > MAX_BYTES) return setError(t("tooBig"));
    setFile(f);
  }

  function downloadSample() {
    const url = URL.createObjectURL(new Blob([SAMPLE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "listings-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="type-body flex flex-col gap-2 rounded-md bg-subtle p-3 text-ink-secondary">
        <p>{t("intro")}</p>
        <ul className="type-caption list-disc pl-5">
          <li>{t("colProduct")}</li>
          <li>{t("colPrice")}</li>
          <li>{t("colStock")}</li>
          <li>{t("colAvailability")}</li>
        </ul>
        <button type="button" onClick={downloadSample} className="type-body-medium inline-flex h-11 items-center gap-2 self-start text-brand underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
          <Download className="size-4" aria-hidden />
          {t("sample")}
        </button>
      </div>

      <label
        htmlFor={id}
        className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line-strong bg-card p-4 text-center hover:border-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
      >
        <FileUp className="size-6 text-highlight" aria-hidden />
        <span className="type-body-medium text-ink">{file ? file.name : t("choose")}</span>
        <span className="type-caption text-ink-muted">{t("limits")}</span>
        <input id={id} type="file" accept=".csv,text/csv" className="sr-only" disabled={upload.isPending} onChange={(e) => pick(e.target.files?.[0])} />
      </label>

      {error && (
        <div role="alert" className="flex flex-col gap-2">
          <p className="type-body text-error">{error}</p>
          {rowErrors.length > 0 && (
            <ul className="type-caption max-h-56 overflow-y-auto rounded-md border border-line bg-card p-3 text-ink-secondary">
              {rowErrors.slice(0, 100).map((e, i) => (
                <li key={i} className="py-0.5">
                  <span className="font-medium text-ink">{t("row", { row: e.row })}</span> {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={!file || upload.isPending}
        onClick={() => file && upload.mutate(file)}
        className="type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
      >
        {upload.isPending ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden /> : <CircleCheck className="size-4" aria-hidden />}
        {upload.isPending ? t("uploading") : t("upload")}
      </button>
    </div>
  );
}
