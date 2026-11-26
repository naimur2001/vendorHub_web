import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  eyebrow: string; // short line above the heading
  title: ReactNode; // the page's <h1> text
  text?: string;
  /** bordeaux: a dark hall with gold arches at its sides. ivory: a light card framed by a gold arch. */
  tone?: "bordeaux" | "ivory";
  children?: ReactNode; // e.g. a search box under the heading
  className?: string;
};

/** Gold line, keystone diamond, gold line: the brand's arch ornament. */
function Keystone({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("flex items-center gap-2", className)}>
      <span className="h-px w-8 bg-gold" />
      <span className="size-2 rotate-45 bg-gold" />
      <span className="h-px w-8 bg-gold" />
    </span>
  );
}

/**
 * Page header shared by the shopping pages, each choosing its own tone so pages feel distinct but
 * belong together. Decoration only uses the brand colours; the arches rise in once (CSS, motion-safe).
 */
export function PageHero({ eyebrow, title, text, tone = "bordeaux", children, className }: Props) {
  const dark = tone === "bordeaux";
  return (
    <header
      className={cn(
        "relative isolate flex flex-col items-center gap-3 overflow-hidden rounded-3xl px-5 py-10 text-center md:gap-4 md:px-12 md:py-14",
        dark ? "bg-brand text-primary-foreground shadow-card" : "border border-line bg-card shadow-card",
        className,
      )}
    >
      {dark ? (
        <>
          {/* Two gold arches standing at the sides, and a faint big one behind the words */}
          <span aria-hidden className="arch-up absolute bottom-0 -left-10 -z-10 h-[90%] w-32 rounded-t-full border border-b-0 border-gold/50 md:left-8 md:w-44" />
          <span aria-hidden className="arch-up absolute -right-10 bottom-0 -z-10 h-[90%] w-32 rounded-t-full border border-b-0 border-gold/50 md:right-8 md:w-44" />
          <span aria-hidden className="absolute bottom-0 left-1/2 -z-10 h-[130%] w-[70%] max-w-2xl -translate-x-1/2 rounded-t-full bg-brand-alt/60" />
        </>
      ) : (
        // A gold arch framing the heading, with a soft ivory glow inside it
        <span aria-hidden className="arch-up absolute top-4 left-1/2 -z-10 h-[150%] w-[85%] max-w-xl -translate-x-1/2 rounded-t-full border border-gold/60 bg-highlight-soft/40" />
      )}

      <Keystone />
      <p className={cn("type-caption tracking-[0.18em] uppercase", dark ? "text-primary-foreground/85" : "text-highlight")}>{eyebrow}</p>
      <h1 className={cn("type-display max-w-3xl wrap-break-word", dark ? "text-primary-foreground" : "text-ink")}>{title}</h1>
      {text && <p className={cn("type-body max-w-2xl", dark ? "text-primary-foreground/85" : "text-ink-secondary")}>{text}</p>}
      {children && <div className="mt-2 w-full max-w-2xl text-left">{children}</div>}
    </header>
  );
}
