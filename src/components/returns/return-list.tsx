"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/app-providers";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
import { ReturnDetail, ReturnStatusPill } from "@/components/returns/return-detail";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Link } from "@/i18n/routing";
import { listReturns, returnKeys, RETURN_STATUSES, type ReturnFilter, type ReturnRequest, type ReturnScope } from "@/lib/api/returns";
import { getMyShops, shopKeys } from "@/lib/api/shops";
import { cn } from "@/lib/utils";

/** A list of returns (mine, a shop's, or the admin dispute queue) with a detail panel. */
export function ReturnList({ scope, defaultFilter = "ALL" }: { scope: ReturnScope; defaultFilter?: ReturnFilter }) {
  const t = useTranslations("Returns");
  const format = useFormatter();
  const [filter, setFilter] = useState<ReturnFilter>(defaultFilter);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<ReturnRequest | null>(null);

  const list = useQuery({ queryKey: returnKeys.list(scope, filter, page), queryFn: () => listReturns(scope, filter, page), placeholderData: keepPreviousData, refetchInterval: 60_000 });
  const rows = list.data?.data ?? [];
  const totalPages = list.data?.meta?.pagination?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="scroll-row -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex w-max gap-2 pb-1">
          {(["ALL", ...RETURN_STATUSES] as ReturnFilter[]).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => { setFilter(f); setPage(1); }} className={cn("type-body-medium flex h-10 items-center rounded-full border px-4 whitespace-nowrap", filter === f ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand")}>
              {t(`filters.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {list.isPending ? (
        <OwnerSkeleton label={t("loading")} />
      ) : list.isError ? (
        <button type="button" onClick={() => list.refetch()} className="type-body-medium self-start text-brand">{t("retry")}</button>
      ) : rows.length === 0 ? (
        <p className="type-body rounded-md border border-line bg-card px-6 py-12 text-center text-ink-secondary">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => {
            const action = r.actions.respond || r.actions.escalate || r.actions.resolve;
            return (
              <li key={r.id} className={cn("flex flex-col gap-2 rounded-md border bg-card p-4 shadow-card sm:flex-row sm:items-center", action ? "border-highlight" : "border-line")}>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="type-body-medium text-ink">{t("order", { number: r.order.orderNumber })}</span>
                    <ReturnStatusPill status={r.status} />
                    {action && <span className="type-caption rounded-full bg-highlight px-2 py-0.5 text-primary-foreground">{t("needsAction")}</span>}
                  </div>
                  <span className="type-caption text-ink-muted">{t("from", { customer: r.customer.name, shop: r.shop.name })} · {t(`reason.${r.reason}`)} · {format.dateTime(new Date(r.createdAt), { day: "numeric", month: "short" })}</span>
                </div>
                <button type="button" onClick={() => setOpen(r)} className={cn("type-body-medium h-10 rounded-sm px-4", action ? "bg-action text-primary-foreground hover:bg-action-hover" : "border border-brand text-brand hover:bg-subtle")}>{t("open")}</button>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between border-t border-gold pt-4">
          <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="type-body-medium flex h-10 items-center gap-1 rounded-sm border border-brand px-3 text-brand disabled:invisible"><ChevronLeft className="size-4" aria-hidden /></button>
          <span className="type-caption text-ink-secondary">{page} / {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="type-body-medium flex h-10 items-center gap-1 rounded-sm border border-brand px-3 text-brand disabled:invisible"><ChevronRight className="size-4" aria-hidden /></button>
        </nav>
      )}

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="type-h3 text-ink">{t("sheetTitle", { number: open?.order.orderNumber ?? "" })}</SheetTitle>
            <SheetDescription className="sr-only">{t("thread")}</SheetDescription>
          </SheetHeader>
          <div className="px-4">{open && <ReturnDetail key={open.id} id={open.id} />}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Customer: their own returns (guests are asked to log in). */
export function MyReturns() {
  const t = useTranslations("Returns");
  const { status } = useSession();
  if (status === "loading") return <OwnerSkeleton label={t("loading")} />;
  if (status === "guest") return <p className="type-body text-ink-secondary">{t("guest")} <Link href={`/auth/login?next=${encodeURIComponent("/account/returns")}`} className="text-brand underline">{t("logIn")}</Link></p>;
  return <ReturnList scope={{ kind: "mine" }} />;
}

/** Shop team: the selected shop's returns. */
export function ShopReturns() {
  const t = useTranslations("Returns");
  const searchParams = useSearchParams();
  const { status, user } = useSession();
  const isTeam = user?.role === "SHOP_OWNER" || user?.role === "SHOP_STAFF";
  const shops = useQuery({ queryKey: shopKeys.mine, queryFn: getMyShops, enabled: status === "authenticated" && isTeam });
  const shop = (shops.data ?? []).find((s) => s.id === searchParams.get("shop")) ?? shops.data?.[0];
  if (!shop) return <OwnerSkeleton label={t("loading")} />;
  return <ReturnList key={shop.id} scope={{ kind: "shop", shopId: shop.id }} defaultFilter="REQUESTED" />;
}