import { getTranslations, setRequestLocale } from "next-intl/server";
import { Logo } from "@/components/layout/top-nav";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// A doorway under an arch: gold outline, red door, gold keystone.
function Doorway({ className, door }: { className?: string; door: string }) {
  return (
    <svg viewBox="0 0 400 520" className={className} aria-hidden="true">
      <path d="M60 518 V220 A140 140 0 0 1 340 220 V518" fill="none" strokeWidth="3" className="stroke-gold" />
      <path d="M104 518 V226 A96 96 0 0 1 296 226 V518 Z" className={door} />
      <path d="M186 70 H214 L208 100 H192 Z" className="fill-gold" />
      <line x1="20" y1="518" x2="380" y2="518" strokeWidth="3" className="stroke-gold" />
    </svg>
  );
}

// Logo for the red panel: ivory tile, red arch.
function LightLogo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 512 512" className="size-9" aria-hidden="true">
        <rect width="512" height="512" rx="72" className="fill-surface" />
        <path d="M176 400 V256 A80 80 0 0 1 336 256 V400" fill="none" strokeWidth="28" className="stroke-brand" />
        <path d="M240 160 H272 L266 192 H246 Z" className="fill-gold" />
        <rect x="152" y="400" width="208" height="16" className="fill-gold" />
      </svg>
      <span className="font-heading text-[1.5rem] leading-none font-semibold text-primary-foreground">Vendors Hub</span>
    </span>
  );
}

const linkFocus = "rounded-sm focus-visible:ring-2 focus-visible:outline-none";

export default async function AuthLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Desktop: the red panel with the doorway */}
      <aside className="hidden flex-col justify-between gap-10 bg-brand p-12 lg:flex">
        <Link href="/" aria-label={t("backHome")} className={cn(linkFocus, "self-start focus-visible:ring-surface")}>
          <LightLogo />
        </Link>
        <Doorway door="fill-brand-alt" className="mx-auto h-[min(52vh,500px)] w-auto" />
        <div className="flex max-w-md flex-col gap-3">
          <p className="font-heading text-[1.875rem] leading-tight text-primary-foreground">{t("panelTagline")}</p>
          <p className="type-body text-primary-foreground/80">{t("panelNote")}</p>
        </div>
      </aside>

      {/* The form side */}
      <div className="flex flex-col">
        <header className="flex items-center justify-between gap-4 px-5 pt-[calc(env(safe-area-inset-top)+1rem)] lg:px-12 lg:pt-8">
          <Link href="/" aria-label={t("backHome")} className={cn(linkFocus, "focus-visible:ring-brand lg:invisible")}>
            <Logo />
          </Link>
          <Link
            href="/"
            className={cn(linkFocus, "type-body-medium text-ink-secondary hover:text-brand focus-visible:ring-brand")}
          >
            {t("backHome")}
          </Link>
        </header>

        <main
          id="main"
          className="flex flex-1 justify-center px-5 pt-8 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] sm:items-center lg:px-12"
        >
          <div className="flex w-full max-w-sm flex-col gap-6">
            <Doorway door="fill-brand" className="mx-auto h-20 w-auto lg:hidden" />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}