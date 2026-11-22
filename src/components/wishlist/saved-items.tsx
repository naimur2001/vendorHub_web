"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Heart, LoaderCircle, TrendingDown } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "@/components/app-providers";
import { ArchFrame } from "@/components/brand/arch-frame";
import { PriceTicket } from "@/components/brand/price-ticket";
import { AvailabilityBadge } from "@/components/catalog/availability-badge";
import { HeartButton } from "@/components/wishlist/heart-button";
import { Link, useRouter } from "@/i18n/routing";
import { safeMediaUrl } from "@/lib/api/storefront";
import { listWishlist, wishlistKeys, type WishlistItem } from "@/lib/api/wishlist";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;
const button =
  "type-body-medium inline-flex h-11 items-center justify-center gap-1 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

function readPage(value: string | null): number {
  const n = value && /^\d{1,3}$/.test(value) ? Number(value) : 1;
  return n >= 1 && n <= 50 ? n : 1;
}

export function SavedItems() {
  const t = useTranslations("Wishlist");
  const router = useRouter();
  const page = readPage(useSearchParams().get("page"));
  const { status, user } = useSession();
  const isCustomer = status === "authenticated" && user?.role === "CUSTOMER";

  const list = useQuery({
    queryKey: wishlistKeys.list(page),
    queryFn: () => listWishlist({ page, limit: PAGE_SIZE }),
    enabled: isCustomer,
    placeholderData: keepPreviousData,
  });

  const go = (next: number) => router.replace(next > 1 ? `/account/saved?page=${next}` : "/account/saved", { scroll: false });

  if (status === "loading" || (isCustomer && list.isPending)) {
    return (
      <p role="status" className="type-body flex items-center justify-center gap-2 py-12 text-ink-secondary">
        <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden />
        {t("loading")}
      </p>
    );
  }
  if (status !== "authenticated") {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="type-h3 text-ink">{t("guestTitle")}</p>
        <Link href={`/auth/login?next=${encodeURIComponent("/account/saved")}`} className={button}>
          {t("logIn")}
        </Link>
      </div>
    );
  }
  if (!isCustomer) return <p className="type-body py-12 text-center text-ink-secondary">{t("customersOnly")}</p>;
  if (list.isError || !list.data) {
    return (
      <div role="alert" className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="type-h3 text-ink">{t("loadError")}</p>
        <button type="button" onClick={() => list.refetch()} className={button}>
          {t("retry")}
        </button>
      </div>
    );
  }

  const items = list.data.data;
  const totalPages = list.data.meta?.pagination?.totalPages ?? 1;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Heart className="size-10 text-highlight" strokeWidth={1.25} aria-hidden />
        <p className="type-h3 text-ink">{t("emptyTitle")}</p>
        <p className="type-body max-w-sm text-ink-secondary">{t("emptyText")}</p>
        <Link href="/search" className={button}>
          {t("browse")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3 transition-opacity", list.isPlaceholderData && "opacity-60")}>
        {items.map((item) => (
          <li key={item.listingId}>
            <SavedCard item={item} />
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-center gap-3">
          <button type="button" onClick={() => go(page - 1)} disabled={page <= 1} className={button}>
            <ChevronLeft className="size-4" aria-hidden />
            {t("previous")}
          </button>
          <span className="type-body text-ink-secondary">{t("pageOf", { page, total: totalPages })}</span>
          <button type="button" onClick={() => go(page + 1)} disabled={page >= totalPages} className={button}>
            {t("next")}
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      )}
    </div>
  );
}

function SavedCard({ item }: { item: WishlistItem }) {
  const t = useTranslations("Wishlist");
  const locale = useLocale();
  const photo = safeMediaUrl(item.product.thumbUrl) ?? safeMediaUrl(item.product.image);

  return (
    <article className="relative flex h-full gap-3 rounded-md border border-line bg-card p-3 shadow-card">
      <Link
        href={`/products/${item.product.slug}`}
        className="group flex min-w-0 flex-1 gap-3 rounded-sm focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        <ArchFrame className="w-20 shrink-0 bg-highlight-soft">
          {photo && <Image src={photo} alt="" fill unoptimized sizes="80px" className="object-cover" />}
        </ArchFrame>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="type-body-medium line-clamp-2 text-ink group-hover:text-brand">{item.product.title}</p>
          <p className="type-caption truncate text-ink-muted">{item.shop.name}</p>
          <PriceTicket amount={item.price} msrp={null} />
          {item.priceDropped && (
            <p className="type-caption inline-flex items-center gap-1 self-start rounded-full bg-success-soft px-2 py-0.5 text-success-ink">
              <TrendingDown className="size-3.5" aria-hidden />
              {t("dropped", { from: formatTaka(item.priceAtSave, locale) })}
            </p>
          )}
          <AvailabilityBadge value={item.availability} className="self-start" />
        </div>
      </Link>
      <HeartButton listingId={item.listingId} title={item.shop.name} />
    </article>
  );
}
