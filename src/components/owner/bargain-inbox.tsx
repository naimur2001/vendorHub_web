"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock, Inbox, LoaderCircle } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useSession } from "@/components/app-providers";
import { Negotiation } from "@/components/bargain/negotiation";
import { CategoryIcon } from "@/components/catalog/product-card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Link, useRouter } from "@/i18n/routing";
import type { BargainStatus } from "@/lib/api/bargains";
import { listShopBargains, ownerKeys, type InboxFilter, type ShopBargain } from "@/lib/api/owner";
import { getMyShops, shopKeys } from "@/lib/api/shops";
import { safeMediaUrl } from "@/lib/api/storefront";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;
const FILTERS: InboxFilter[] = ["AWAITING_SHOP", "COUNTERED", "ACCEPTED", "ALL"];
const LIVE: BargainStatus[] = ["AWAITING_SHOP", "COUNTERED", "ACCEPTED"];

const STATUS_STYLE: Record<BargainStatus, string> = {
  AWAITING_SHOP: "bg-highlight-soft text-highlight",
  COUNTERED: "bg-info-soft text-verified",
  ACCEPTED: "bg-success-soft text-success-ink",
  DECLINED: "bg-subtle text-ink-secondary",
  EXPIRED: "bg-error-soft text-error",
};

// URL values are checked; anything unexpected falls back to the default.
function readFilter(value: string | null): InboxFilter {
  return value && (FILTERS as string[]).includes(value) ? (value as InboxFilter) : "AWAITING_SHOP";
}
function readPage(value: string | null): number {
  const n = value && /^\d{1,3}$/.test(value) ? Number(value) : 1;
  return n >= 1 && n <= 500 ? n : 1;
}
function inboxHref(shopId: string | undefined, filter: InboxFilter, page: number): string {
  const params = new URLSearchParams();
  if (shopId) params.set("shop", shopId);
  if (filter !== "AWAITING_SHOP") params.set("status", filter);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/owner/bargains?${query}` : "/owner/bargains";
}

const panel = "flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center";
const primaryLink =
  "type-body-medium flex h-12 items-center rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none";
const chipClass = (active: boolean) =>
  cn(
    "type-body-medium flex h-10 items-center rounded-full border px-4 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
    active ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand",
  );

export function BargainInbox() {
  const t = useTranslations("OwnerBargains");
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectId = useId();
  const { status: session, user } = useSession();
  const [open, setOpen] = useState<ShopBargain | null>(null);

  const isTeam = user?.role === "SHOP_OWNER" || user?.role === "SHOP_STAFF";

  // Only the user's own shops can be chosen; a shop id typed into the URL is ignored otherwise.
  const shops = useQuery({ queryKey: shopKeys.mine, queryFn: getMyShops, enabled: session === "authenticated" && isTeam });
  const shopList = shops.data ?? [];
  const shop = shopList.find((s) => s.id === searchParams.get("shop")) ?? shopList[0];
  const filter = readFilter(searchParams.get("status"));
  const page = readPage(searchParams.get("page"));

  const inbox = useQuery({
    queryKey: ownerKeys.inbox(shop?.id ?? "", filter, page),
    queryFn: () => listShopBargains(shop?.id ?? "", { status: filter, page, limit: PAGE_SIZE }),
    enabled: Boolean(shop),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000, // new offers appear while the inbox is open
  });

  const go = (shopId: string | undefined, nextFilter: InboxFilter, nextPage: number) =>
    router.replace(inboxHref(shopList.length > 1 ? shopId : undefined, nextFilter, nextPage), { scroll: false });

  const loading = (
    <p role="status" className="type-body flex items-center justify-center gap-2 py-12 text-ink-secondary">
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      {t("loading")}
    </p>
  );

  if (session === "loading") return loading;

  if (session === "guest") {
    return (
      <div className={panel}>
        <h2 className="type-h3 text-ink">{t("guestTitle")}</h2>
        <Link href={`/auth/login?next=${encodeURIComponent("/owner/bargains")}`} className={primaryLink}>
          {t("logIn")}
        </Link>
      </div>
    );
  }

  if (!isTeam) {
    return (
      <div className={panel}>
        <h2 className="type-h3 text-ink">{t("notTeamTitle")}</h2>
        <p className="type-body text-ink-secondary">{t("notTeamText")}</p>
      </div>
    );
  }

  if (shops.isPending) return loading;

  if (shops.isError) {
    return (
      <div role="alert" className={panel}>
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => shops.refetch()} className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand">
          {t("retry")}
        </button>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className={panel}>
        <h2 className="type-h3 text-ink">{t("noShopTitle")}</h2>
        <p className="type-body text-ink-secondary">{t("noShopText")}</p>
        <Link href="/owner/setup" className={primaryLink}>
          {t("setup")}
        </Link>
      </div>
    );
  }

  const list = inbox.data?.data ?? [];
  const total = inbox.data?.meta?.pagination?.total ?? list.length;
  const totalPages = inbox.data?.meta?.pagination?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-5">
      {shopList.length > 1 && (
        <div className="flex flex-col gap-1.5 sm:max-w-sm">
          <label htmlFor={selectId} className="type-body-medium text-ink">
            {t("shopLabel")}
          </label>
          <select
            id={selectId}
            value={shop.id}
            onChange={(e) => go(e.target.value, filter, 1)}
            className="type-body h-12 rounded-md border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
          >
            {shopList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <nav aria-label={t("filterLabel")} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-2 pb-1">
          {FILTERS.map((f) => (
            <li key={f}>
              <button type="button" onClick={() => go(shop.id, f, 1)} aria-pressed={filter === f} className={chipClass(filter === f)}>
                {t(`filters.${f}`)}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {inbox.isPending ? (
        loading
      ) : inbox.isError ? (
        <div role="alert" className={panel}>
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => inbox.refetch()} className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand">
            {t("retry")}
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className={panel}>
          <Inbox className="size-10 text-highlight" strokeWidth={1.5} aria-hidden />
          <p className="type-body max-w-sm text-ink-secondary">{filter === "AWAITING_SHOP" ? t("emptyWaiting") : t("empty")}</p>
        </div>
      ) : (
        <>
          <p className="type-body text-ink-secondary" aria-live="polite">
            {t("count", { count: total })}
          </p>
          <ul className={cn("flex flex-col gap-3 transition-opacity", inbox.isPlaceholderData && "opacity-60")}>
            {list.map((b) => (
              <li key={b.id}>
                <InboxRow bargain={b} onOpen={() => setOpen(b)} />
              </li>
            ))}
          </ul>
        </>
      )}

      {totalPages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3 border-t border-gold pt-5">
          <button
            type="button"
            onClick={() => go(shop.id, filter, page - 1)}
            disabled={page <= 1}
            className="type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand hover:bg-subtle disabled:invisible"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {t("previous")}
          </button>
          <span className="type-body text-ink-secondary">{t("pageOf", { page, total: totalPages })}</span>
          <button
            type="button"
            onClick={() => go(shop.id, filter, page + 1)}
            disabled={page >= totalPages}
            className="type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand hover:bg-subtle disabled:invisible"
          >
            {t("next")}
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      )}

      {/* The shop's side of the negotiation */}
      <Sheet open={open !== null} onOpenChange={(isOpen) => !isOpen && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="type-h3 text-ink">{t("sheetTitle", { name: open?.customer?.name ?? "" })}</SheetTitle>
            <SheetDescription className="sr-only">{t("subtitle")}</SheetDescription>
          </SheetHeader>
          <div className="px-4">{open && <Negotiation bargainId={open.id} side="SHOP" />}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InboxRow({ bargain: b, onOpen }: { bargain: ShopBargain; onOpen: () => void }) {
  const t = useTranslations("OwnerBargains");
  const locale = useLocale();
  const money = (n: number) => formatTaka(n, locale);
  const image = safeMediaUrl(b.product.image);
  const live = LIVE.includes(b.status) && b.secondsLeft > 0;
  const name = b.customer?.name ?? "";

  const where =
    b.status === "AWAITING_SHOP"
      ? t("customerOffered", { name, amount: money(b.currentOffer) })
      : b.status === "COUNTERED"
        ? t("youCountered", { amount: money(b.currentOffer) })
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
          <span className={cn("type-caption rounded-full px-2.5 py-0.5", STATUS_STYLE[b.status])}>{t(`status.${b.status}`)}</span>
          {b.yourTurn && <span className="type-caption rounded-full bg-highlight px-2.5 py-0.5 text-primary-foreground">{t("yourTurn")}</span>}
        </div>
        <h2 className="type-body-medium truncate text-ink">{b.product.title}</h2>
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
        {b.yourTurn ? t("answer") : t("open")}
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </article>
  );
}