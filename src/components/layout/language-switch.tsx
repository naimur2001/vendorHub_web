"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/routing";

/** English ⇄ বাংলা, staying on the same page (and keeping ?filters). */
export function LanguageSwitch() {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const next = locale === "bn" ? "en" : "bn";

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`${t("language")}: ${next === "bn" ? "বাংলা" : "English"}`}
      onClick={() => start(() => router.replace(`${pathname}${window.location.search}`, { locale: next }))}
      className="type-body-medium flex h-11 items-center gap-1.5 rounded-full px-3 text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60"
    >
      <Languages className="size-4" aria-hidden />
      <span lang={next}>{next === "bn" ? "বাংলা" : "EN"}</span>
    </button>
  );
}