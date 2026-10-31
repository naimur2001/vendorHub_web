"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert, FileText, LoaderCircle, LockKeyhole } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/core";
import {
  requestVerification,
  shopKeys,
  uploadPrivateDocument,
  type MyShop,
  type VerificationDocumentType,
} from "@/lib/api/shops";
import { cn } from "@/lib/utils";

// Same limits as the backend (UPLOAD_MAX_MB = 5, PRIVATE_DOCUMENT: pdf, jpeg, png).
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const ALLOWED_EXTENSIONS = /\.(pdf|jpe?g|png)$/i;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

// The first verification level needs exactly these two documents.
const REQUIRED: { type: Exclude<VerificationDocumentType, "SHOP_PHOTO">; label: string; hint: string }[] = [
  { type: "TRADE_LICENSE", label: "tradeLicense", hint: "tradeLicenseHint" },
  { type: "NID", label: "nid", hint: "nidHint" },
];

type DocType = (typeof REQUIRED)[number]["type"];

// Quick check before uploading; the backend checks again from the file's real content.
function checkFile(file: File): "wrongType" | "tooBig" | "empty" | null {
  // Some phones report no type; the extension decides then.
  const typeOk = ALLOWED_TYPES.includes(file.type) || (file.type === "" && ALLOWED_EXTENSIONS.test(file.name));
  if (!typeOk || !ALLOWED_EXTENSIONS.test(file.name)) return "wrongType";
  if (file.size === 0) return "empty";
  if (file.size > MAX_BYTES) return "tooBig";
  return null;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type PickerProps = {
  label: string;
  hint: string;
  file: File | null;
  error?: string;
  disabled: boolean;
  onPick: (file: File | null) => void;
};

function FilePicker({ label, hint, file, error, disabled, onPick }: PickerProps) {
  const t = useTranslations("OwnerSetup");
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <span className="type-body-medium text-ink">{label}</span>
      <div
        className={cn(
          "flex items-center gap-3 rounded-md border border-dashed bg-card p-3",
          error ? "border-error" : "border-line-strong",
        )}
      >
        <FileText className="size-6 shrink-0 text-ink-muted" aria-hidden />
        <div className="min-w-0 flex-1">
          {file ? (
            <>
              <p className="type-body-medium truncate text-ink">{file.name}</p>
              <p className="type-caption text-ink-muted">{formatSize(file.size)}</p>
            </>
          ) : (
            <p className="type-body text-ink-muted">{t("noFile")}</p>
          )}
        </div>
        {/* The real input stays focusable for keyboards; the label is the visible button. */}
        <input
          id={id}
          type="file"
          accept={ACCEPT}
          disabled={disabled}
          aria-label={`${label}: ${file ? t("changeFile") : t("chooseFile")}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
          className="peer sr-only"
          onChange={(e) => {
            onPick(e.target.files?.[0] ?? null);
            e.target.value = ""; // choosing the same file again still triggers onChange
          }}
        />
        <label
          htmlFor={id}
          aria-hidden
          className="type-body-medium flex h-10 shrink-0 cursor-pointer items-center rounded-sm border border-brand px-3 text-brand hover:bg-subtle peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
        >
          {file ? t("changeFile") : t("chooseFile")}
        </label>
      </div>
      <p id={`${id}-hint`} className="type-caption text-ink-muted">
        {hint}
      </p>
      {error && (
        <p id={`${id}-error`} className="type-caption flex items-center gap-1 text-error">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

export function DocumentsForm({ shop }: { shop: MyShop }) {
  const t = useTranslations("OwnerSetup");
  const tAuth = useTranslations("Auth");
  const queryClient = useQueryClient();

  const [files, setFiles] = useState<Record<DocType, File | null>>({ TRADE_LICENSE: null, NID: null });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<DocType, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "submitting">("idle");
  const [current, setCurrent] = useState(0);

  const busy = phase !== "idle";

  function pick(type: DocType, file: File | null) {
    setFiles((prev) => ({ ...prev, [type]: file }));
    const problem = file ? checkFile(file) : null;
    setFieldErrors((prev) => ({ ...prev, [type]: problem ? t(`docErrors.${problem}`) : undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    // Every document chosen and valid?
    const errors: Partial<Record<DocType, string>> = {};
    for (const { type } of REQUIRED) {
      const file = files[type];
      const problem = file ? checkFile(file) : "required";
      if (problem) errors[type] = t(`docErrors.${problem}`);
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    let stage: "upload" | "request" = "upload";
    try {
      setPhase("uploading");
      const documents: { type: DocType; fileUrl: string }[] = [];
      for (const [index, { type }] of REQUIRED.entries()) {
        setCurrent(index + 1);
        const uploaded = await uploadPrivateDocument(files[type] as File);
        documents.push({ type, fileUrl: uploaded.url });
      }

      stage = "request";
      setPhase("submitting");
      await requestVerification(shop.id, { targetLevel: "DOCUMENTS_VERIFIED", documents });

      // The wizard re-reads "my shops" and shows "Submitted for review".
      await queryClient.invalidateQueries({ queryKey: shopKeys.mine });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // A request is already in progress (e.g. sent from another tab): just show it.
        await queryClient.invalidateQueries({ queryKey: shopKeys.mine });
      } else if (err instanceof ApiError && err.status === 400 && stage === "upload") {
        setFormError(t("docErrors.rejectedType"));
      } else if (err instanceof ApiError && err.status === 413) {
        setFormError(t("docErrors.tooLarge"));
      } else if (err instanceof ApiError && err.status === 429) {
        setFormError(t("docErrors.uploadLimit"));
      } else if (err instanceof ApiError && err.status === 400) {
        setFormError(tAuth("errors.checkFields"));
      } else if (err instanceof ApiError && err.status === 0) {
        setFormError(tAuth("errors.network"));
      } else {
        setFormError(tAuth("errors.generic"));
      }
    } finally {
      setPhase("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h2 className="type-h3 text-ink">{t("documentsTitle")}</h2>
        <p className="type-body text-ink-secondary">{t("documentsText")}</p>
        <p className="type-caption text-ink-muted">{t("fileRules")}</p>
      </header>

      {formError && (
        <div role="alert" className="type-body flex gap-2 rounded-md border border-error/30 bg-error-soft p-3 text-error">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>{formError}</p>
        </div>
      )}

      {REQUIRED.map(({ type, label, hint }) => (
        <FilePicker
          key={type}
          label={t(label)}
          hint={t(hint)}
          file={files[type]}
          error={fieldErrors[type]}
          disabled={busy}
          onPick={(file) => pick(type, file)}
        />
      ))}

      <p className="type-caption flex items-start gap-2 rounded-md bg-info-soft p-3 text-verified">
        <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("privacyNote")}
      </p>

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className="type-body-medium flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-action text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-80"
      >
        {busy && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
        {phase === "uploading"
          ? t("uploading", { current, total: REQUIRED.length })
          : phase === "submitting"
            ? t("submitting")
            : t("submitDocs")}
      </button>
    </form>
  );
}