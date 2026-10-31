"use client";

import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  error?: string;
  hint?: string;
  // Needed only for type="password" (the show / hide button)
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
};

/**
 * Labelled text input used by every form: 48px tall, error and hint linked for screen readers,
 * optional show / hide toggle for passwords. Works with react-hook-form's register().
 */
export function TextField({
  label,
  error,
  hint,
  type = "text",
  className,
  showPasswordLabel,
  hidePasswordLabel,
  ...inputProps
}: Props) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  const hintId = hint && !error ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="type-body-medium text-ink">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={isPassword && visible ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "type-body h-12 w-full rounded-md border border-input bg-card px-3 text-ink placeholder:text-ink-muted",
            "hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none",
            "disabled:bg-subtle disabled:text-ink-disabled",
            "aria-invalid:border-error aria-invalid:focus:ring-error/15",
            isPassword && "pr-12",
            className,
          )}
          {...inputProps}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? hidePasswordLabel : showPasswordLabel}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md text-ink-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        )}
      </div>

      {hintId && (
        <p id={hintId} className="type-caption text-ink-muted">
          {hint}
        </p>
      )}
      {errorId && (
        <p id={errorId} className="type-caption flex items-center gap-1 text-error">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}