"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock, Handshake, LoaderCircle } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/app-providers";
import { Negotiation } from "@/components/bargain/negotiation";
import { CategoryIcon } from "@/components/catalog/product-card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Link, useRouter } from "@/i18n/routing";
import { bargainKeys, listMyBargains, type Bargain, type BargainStatus } from "@/lib/api/bargains";
import { safeMediaUrl } from "@/lib/api/storefront";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;
const FILTERS: BargainStatus[] = ["COUNTERED", "AWAITING_SHOP", "ACCEPTED", "DECLINED", "EXPIRED"];
const LIVE: BargainStatus[] = ["AWAITING_SHOP", "COUNTERED", "ACCEPTED"];

const STATUS_STYLE: Record<BargainStatus, string> = {
  AWAITING_SHOP: "bg-info-soft text-verified",
  COUNTERED: "bg-highlight-soft text-highlight",
  ACCEPTED: "bg-success-soft text-success-ink",
  DECLINED: "bg-subtle text-ink-secondary",
  EXPIRED: "bg-error-soft text-error",
};

// URL values are checked; anything unexpected falls back to the default.
function readStatus(value: string | null): BargainStatus | undefined {
  return value && (FILTERS as string[]).includes(value) ? (value as BargainStatus) : undefined;
}
function readPage(value: string | null): number {
  const n = value && /^\d{1,3}$/.test(value) ? Number(value) : 1;
  return n >= 1 && n <= 500 ? n : 1;
}
function bargainsHref(status: BargainStatus | undefined, page: number): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/bargains?${query}` : "/bargains";
}

const panel = "flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center";
const chipClass = (active: boolean) =>
  cn(
    "type-body-medium flex h-10 items-center rounded-full border px-4 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
    active ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand",
  );

export function MyBargains() {
  const t = useTranslations("MyBargains");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: session } = useSession();
  const [openId, setOpenId] = useState<string | null>(null);

  const status = readStatus(searchParams.get("status"));
  const page = readPage(searchParams.get("page"));

  const bargains = useQuery({
    queryKey: bargainKeys.mine(status, page),
    queryFn: () => listMyBargains({ status, page, limit: PAGE_SIZE }),
    enabled: session === "authenticated",
    placeholderData: keepPreviousData,
    // While any negotiation is live, check for the shop's answers every 30 seconds.
    refetchInterval: (q) => (q.state.data?.data.some((b) => LIVE.includes(b.status)) ? 30_000 : false),
  });

  const go = (nextStatus: BargainStatus | undefined, nextPage: number) =>
    router.replace(bargainsHref(nextStatus, nextPage), { scroll: false });

  if (session === "loading" || (session === "authenticated" && bargains.isPending)) {
    return (
      <p role="status" className="type-body flex items-center justify-center gap-2 py-12 text-ink-secondary">
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
        {t("loading")}
      </p>
    );
  }

  if (session === "guest") {
    return (
      <div className={panel}>
        <Handshake className="size-10 text-highlight" strokeWidth={1.5} aria-hidden />
        <h2 className="type-h3 text-ink">{t("guestTitle")}</h2>
        <Link
          href={`/auth/login?next=${encodeURIComponent("/bargains")}`}
          className="type-body-medium flex h-12 items-center rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover"
        >
          {t("logIn")}
        </Link>
      </div>
    );
  }

  if (bargains.isError || !bargains.data) {
    return (
      <div role="alert" className={panel}>
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => bargains.refetch()} className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand hover:bg-subtle">
          {t("retry")}
        </button>
      </div>
    );
  }

  const list = bargains.data.data;
  const total = bargains.data.meta?.pagination?.total ?? list.length;
  const totalPages = bargains.data.meta?.pagination?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label={t("filterLabel")} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-2 pb-1">
          <li>
            <button type="button" onClick={() => go(undefined, 1)} aria-pressed={!status} className={chipClass(!status)}>
              {t("filters.ALL")}
            </button>
          </li>
          {FILTERS.map((s) => (
            <li key={s}>
              <button type="button" onClick={() => go(s, 1)} aria-pressed={status === s} className={chipClass(status === s)}>
                {t(`filters.${s}`)}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {list.length === 0 ? (
        <div className={panel}>
          <Handshake className="size-10 text-highlight" strokeWidth={1.5} aria-hidden />
          {status ? (
            <>
              <p className="type-body text-ink-secondary">{t("emptyFiltered")}</p>
              <button type="button" onClick={() => go(undefined, 1)} className="type-body-medium text-brand underline-offset-4 hover:underline">
                {t("showAll")}
              </button>
            </>
          ) : (
            <>
              <h2 className="type-h3 text-ink">{t("emptyTitle")}</h2>
              <p className="type-body text-ink-secondary">{t("emptyText")}</p>
              <Link href="/search" className="type-body-medium flex h-12 items-center rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover">
                {t("browse")}
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="type-body text-ink-secondary" aria-live="polite">
            {t("count", { count: total })}
          </p>
          <ul className={cn("flex flex-col gap-3 transition-opacity", bargains.isPlaceholderData && "opacity-60")}>
            {list.map((b) => (
              <li key={b.id}>
                <BargainRow bargain={b} onOpen={() => setOpenId(b.id)} />
              </li>
            ))}
          </ul>
        </>
      )}

      {totalPages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3 border-t border-gold pt-5">
          <button
            type="button"
            onClick={() => go(status, page - 1)}
            disabled={page <= 1}
            className="type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand hover:bg-subtle disabled:invisible"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {t("previous")}
          </button>
          <span className="type-body text-ink-secondary">{t("pageOf", { page, total: totalPages })}</span>
          <button
            type="button"
            onClick={() => go(status, page + 1)}
            disabled={page >= totalPages}
            className="type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand hover:bg-subtle disabled:invisible"
          >
            {t("next")}
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      )}

      {/* The same negotiation view as on the product page */}
      <Sheet open={openId !== null} onOpenChange={(open) => !open && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="type-h3 text-ink">{t("sheetTitle")}</SheetTitle>
            <SheetDescription className="sr-only">{t("subtitle")}</SheetDescription>
          </SheetHeader>
          <div className="px-4">{openId && <Negotiation bargainId={openId} />}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function BargainRow({ bargain: b, onOpen }: { bargain: Bargain; onOpen: () => void }) {
  const t = useTranslations("MyBargains");
  const tBargain = useTranslations("Bargain");
  const locale = useLocale();
  const money = (n: number) => formatTaka(n, locale);
  const image = safeMediaUrl(b.product.image);
  const live = LIVE.includes(b.status) && b.secondsLeft > 0;

  const where =
    b.status === "AWAITING_SHOP"
      ? t("youOffered", { amount: money(b.currentOffer) })
      : b.status === "COUNTERED"
        ? t("shopCountered", { amount: money(b.currentOffer) })
        : b.status === "ACCEPTED" && b.agreedPrice !== null
          ? t("agreedAt", { amount: money(b.agreedPrice) })
          : t("lastOffer", { amount: money(b.currentOffer) });

  const timeLeft =
    b.secondsLeft >= 3600
      ? t("hoursLeft", { count: Math.floor(b.secondsLeft / 3600) })
      : t("minutesLeft", { count: Math.max(1, Math.ceil(b.secondsLeft / 60)) });

  return (
    <article
      className={cn(
        "flex items-center gap-3 rounded-md border bg-card p-3 shadow-card md:gap-4 md:p-4",
        b.yourTurn ? "border-highlight" : "border-line",
      )}
    >
      <span className="relative flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-t-full rounded-b-sm bg-highlight-soft text-highlight">
        {image ? (
          <Image src={image} alt="" fill unoptimized sizes="64px" className="object-cover" />
        ) : (
          <CategoryIcon categorySlug="" className="size-7" strokeWidth={1.25} aria-hidden />
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("type-caption rounded-full px-2.5 py-0.5", STATUS_STYLE[b.status])}>{tBargain(`status.${b.status}`)}</span>
          {b.yourTurn && <span className="type-caption rounded-full bg-highlight px-2.5 py-0.5 text-primary-foreground">{t("yourTurn")}</span>}
        </div>
        <h2 className="type-body-medium truncate text-ink">{b.product.title}</h2>
        <p className="type-caption truncate text-ink-muted">{b.shop.name}</p>
        <p className="type-body text-ink">
          {where} <span className="type-caption text-ink-muted">· {t("listed", { amount: money(b.listPrice) })}</span>
        </p>
        {live && (
          <p className="type-caption flex items-center gap-1 text-highlight">
            <Clock className="size-3.5" aria-hidden />
            {timeLeft}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "type-body-medium flex h-11 shrink-0 items-center gap-1 rounded-sm px-4 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
          b.yourTurn ? "bg-action text-primary-foreground hover:bg-action-hover" : "border border-brand text-brand hover:bg-subtle",
        )}
      >
        {t("open")}
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </article>
  );
}