"use client";

import { useQuery } from "@tanstack/react-query";
import { Copy, Gift, LoaderCircle, Share2 } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/app-providers";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api/client";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

// Exact shape of myCredit() in referrals.service.js
export type MyCredit = {
  balance: number;
  referralCode: string;
  rewardPerReferral: number;
  maxSharePerOrder: number; // 0.2 = at most 20% of an order's items
  referrals: { invited: number; rewarded: number };
  history: { amount: number; kind: string; note: string | null; orderId: string | null; createdAt: string }[];
};
export const creditKey = ["me", "credit"] as const;
export const getMyCredit = () => api.get<MyCredit>("/me/credit");

const box = "flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center";

/** Customer: credit balance, invite code and link, and the credit history. */
export function CreditView() {
  const t = useTranslations("Credit");
  const locale = useLocale();
  const format = useFormatter();
  const { status, user } = useSession();
  const [notice, setNotice] = useState<string | null>(null);
  const credit = useQuery({ queryKey: creditKey, queryFn: getMyCredit, enabled: status === "authenticated" && user?.role === "CUSTOMER" });

  if (status === "loading" || (status === "authenticated" && user?.role === "CUSTOMER" && credit.isPending)) {
    return (
      <p role="status" className="type-body flex items-center justify-center gap-2 py-12 text-ink-secondary">
        <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden />
        {t("loading")}
      </p>
    );
  }
  if (status === "guest") {
    return (
      <div className={box}>
        <h2 className="type-h3 text-ink">{t("guestTitle")}</h2>
        <Link href={`/auth/login?next=${encodeURIComponent("/account/credit")}`} className="type-body-medium flex h-11 items-center rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover">
          {t("logIn")}
        </Link>
      </div>
    );
  }
  if (user?.role !== "CUSTOMER") return <div className={box}><p className="type-body text-ink-secondary">{t("customersOnly")}</p></div>;
  if (credit.isError || !credit.data) {
    return (
      <div role="alert" className={box}>
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => credit.refetch()} className="type-body-medium h-11 rounded-sm border border-brand px-4 text-brand hover:bg-subtle">{t("retry")}</button>
      </div>
    );
  }

  const c = credit.data;
  const link = `${typeof window === "undefined" ? "" : window.location.origin}/${locale}/auth/register?ref=${encodeURIComponent(c.referralCode)}`;
  const reward = formatTaka(c.rewardPerReferral, locale);

  async function copy(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(msg);
    } catch {
      setNotice(t("copyFailed"));
    }
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: t("shareTitle"), text: t("shareText", { reward }), url: link });
      } catch {
        /* closed by the user */
      }
    } else void copy(link, t("linkCopied"));
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="relative isolate flex flex-col gap-2 overflow-hidden rounded-md bg-brand p-6 text-primary-foreground">
        <span aria-hidden className="absolute -right-6 bottom-0 -z-10 h-[90%] w-32 rounded-t-full border border-b-0 border-gold/50" />
        <p className="type-caption tracking-[0.12em] text-primary-foreground/80 uppercase">{t("balance")}</p>
        <p className="font-heading text-[2.75rem] leading-none">{formatTaka(c.balance, locale)}</p>
        <p className="type-caption text-primary-foreground/85">{t("rule", { percent: Math.round(c.maxSharePerOrder * 100) })}</p>
      </section>

      <section aria-labelledby="invite-h" className="flex flex-col gap-4 rounded-md border border-gold bg-card p-5 shadow-card">
        <h2 id="invite-h" className="type-h3 flex items-center gap-2 text-ink">
          <Gift className="size-5 text-gold" aria-hidden />
          {t("inviteTitle", { reward })}
        </h2>
        <p className="type-body text-ink-secondary">{t("inviteText", { reward })}</p>
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-heading rounded-sm border border-dashed border-gold px-4 py-2 text-[1.5rem] tracking-[0.15em] text-brand">{c.referralCode}</p>
          <button type="button" onClick={() => copy(c.referralCode, t("codeCopied"))} className="type-body-medium inline-flex h-11 items-center gap-2 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
            <Copy className="size-4" aria-hidden />
            {t("copyCode")}
          </button>
          <button type="button" onClick={share} className="type-body-medium inline-flex h-11 items-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none">
            <Share2 className="size-4" aria-hidden />
            {t("share")}
          </button>
        </div>
        <p className="type-caption text-ink-muted">{t("stats", { invited: c.referrals.invited, rewarded: c.referrals.rewarded })}</p>
        {notice && <p role="status" className="type-caption text-success-ink">{notice}</p>}
      </section>

      <section aria-labelledby="history-h" className="flex flex-col gap-3">
        <h2 id="history-h" className="type-h3 text-ink">{t("history")}</h2>
        {c.history.length === 0 ? (
          <p className="type-body rounded-md border border-dashed border-line-strong p-6 text-center text-ink-secondary">{t("historyEmpty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-card">
            {c.history.map((h, i) => (
              <li key={i} className="flex items-center justify-between gap-3 p-3">
                <span className="flex min-w-0 flex-col">
                  <span className="type-body text-ink">{t.has(`kinds.${h.kind}`) ? t(`kinds.${h.kind}`) : h.kind}</span>
                  <span className="type-caption text-ink-muted">{format.dateTime(new Date(h.createdAt), { day: "numeric", month: "short", year: "numeric" })}</span>
                </span>
                <span className={cn("type-price shrink-0", h.amount >= 0 ? "text-success-ink" : "text-ink")}>
                  {h.amount >= 0 ? "+" : "−"}
                  {formatTaka(Math.abs(h.amount), locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
