"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Hide the description visually (still read by screen readers). */
  srOnlyDescription?: boolean;
  /** Width on larger screens, e.g. "sm:max-w-lg". */
  size?: string;
  children: ReactNode;
};

/** A centred modal for add / edit forms and order details. The body scrolls inside; the header stays put. */
export function FormModal({ open, onClose, title, description, srOnlyDescription, size = "sm:max-w-xl", children }: Props) {
  const t = useTranslations("Modal");
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl bg-card p-0 shadow-modal ring-1 ring-gold/40 motion-reduce:animate-none",
          size,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="type-h3 text-ink">{title}</DialogTitle>
            <DialogDescription className={cn("type-body text-ink-secondary", (srOnlyDescription || !description) && "sr-only")}>
              {description ?? title}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
