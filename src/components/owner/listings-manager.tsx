"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, LoaderCircle, PackagePlus, PackageSearch } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { useSession } from "@/components/app-providers";
import { AvailabilityBadge } from "@/components/catalog/availability-badge";
import { CategoryIcon } from "@/components/catalog/product-card";
import { ListingForm, ProductPicker } from "@/components/owner/listing-form";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Link, useRouter } from "@/i18n/routing";
import { listingKeys, listOwnerListings, updateListing, type CatalogPick, type OwnerListing } from "@/lib/api/listings";
import { getMyShops, shopKeys } from "@/lib/api/shops";
import { safeMediaUrl } from "@/lib/api/storefront";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter = "ACTIVE" | "INACTIVE" | "ALL";
const FILTERS: Filter[] = ["ACTIVE", "INACTIVE", "ALL"];

// What the side panel shows: adding (search, then form) or editing one listing.
type Panel = { kind: "add"; product: CatalogPick | null } | { kind: "edit"; listing: OwnerListing } | null;

const panelBox = "flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center";
const primaryButton =
  "type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none";
const chipClass = (active: boolean) =>
  cn(
    "type-body-medium flex h-10 items-center rounded-full border px-4 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
    active ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand",
  );

export function ListingsManager() {
  const t = useTranslations("OwnerListings");
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const selectId = useId();
  const findId = useId();
  const { status: session, user } = useSession();

  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const [find, setFind] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isTeam = user?.role === "SHOP_OWNER" || user?.role === "SHOP_STAFF";

  // Only the user's own shops can be chosen; a shop id typed into the URL is ignored otherwise.
  const shops = useQuery({ queryKey: shopKeys.mine, queryFn: getMyShops, enabled: session === "authenticated" && isTeam });
  const shopList = shops.data ?? [];
  const shop = shopList.find((s) => s.id === searchParams.get("shop")) ?? shopList[0];

  const listings = useQuery({
    queryKey: listingKeys.mine(shop?.id ?? ""),
    queryFn: () => listOwnerListings(shop?.id ?? ""),
    enabled: Boolean(shop),
  });

  const toggle = useMutation({
    mutationFn: (l: OwnerListing) => updateListing(l.shopId, l.id, { isActive: !l.isActive }),
    onSuccess: (updated) => {
      afterSave(updated);
    },
  });

  const all = useMemo(() => listings.data ?? [], [listings.data]);
  const listedIds = useMemo(() => new Set(all.filter((l) => l.isActive).map((l) => l.productId)), [all]);
  const visible = useMemo(() => {
    const term = find.trim().toLowerCase();
    return all.filter(
      (l) =>
        (filter === "ALL" || (filter === "ACTIVE" ? l.isActive : !l.isActive)) &&
        (!term || l.product.title.toLowerCase().includes(term)),
    );
  }, [all, filter, find]);

  function afterSave(updated: OwnerListing) {
    queryClient.setQueryData<OwnerListing[]>(listingKeys.mine(updated.shopId), (old) => {
      if (!old) return [updated];
      return old.some((l) => l.id === updated.id) ? old.map((l) => (l.id === updated.id ? updated : l)) : [updated, ...old];
    });
    void queryClient.invalidateQueries({ queryKey: ["owner", "dashboard"] });
    setPanel(null);
    setNotice(t("saved"));
  }

  const loading = (
    <p role="status" className="type-body flex items-center justify-center gap-2 py-12 text-ink-secondary">
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      {t("loading")}
    </p>
  );

  if (session === "loading") return loading;

  if (session === "guest") {
    return (
      <div className={panelBox}>
        <h2 className="type-h3 text-ink">{t("guestTitle")}</h2>
        <Link href={`/auth/login?next=${encodeURIComponent("/owner/listings")}`} className={primaryButton}>
          {t("logIn")}
        </Link>
      </div>
    );
  }

  if (!isTeam) {
    return (
      <div className={panelBox}>
        <h2 className="type-h3 text-ink">{t("notTeamTitle")}</h2>
        <p className="type-body text-ink-secondary">{t("notTeamText")}</p>
      </div>
    );
  }

  if (shops.isPending) return loading;

  if (shops.isError || (shop && listings.isError)) {
    return (
      <div role="alert" className={panelBox}>
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button
          type="button"
          onClick={() => (shops.isError ? shops.refetch() : listings.refetch())}
          className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand"
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className={panelBox}>
        <h2 className="type-h3 text-ink">{t("noShopTitle")}</h2>
        <p className="type-body text-ink-secondary">{t("noShopText")}</p>
        <Link href="/owner/setup" className={primaryButton}>
          {t("setup")}
        </Link>
      </div>
    );
  }

  if (listings.isPending) return loading;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {shopList.length > 1 ? (
          <div className="flex flex-col gap-1.5 sm:w-72">
            <label htmlFor={selectId} className="type-body-medium text-ink">
              {t("shopLabel")}
            </label>
            <select
              id={selectId}
              value={shop.id}
              onChange={(e) => router.replace(`/owner/listings?shop=${e.target.value}`, { scroll: false })}
              className="type-body h-12 rounded-md border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
            >
              {shopList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => setPanel({ kind: "add", product: null })} className={primaryButton}>
          <PackagePlus className="size-5" aria-hidden />
          {t("add")}
        </button>
      </div>

      {notice && (
        <p role="status" className="type-body flex items-center gap-2 text-success-ink">
          <CircleCheck className="size-4" aria-hidden />
          {notice}
        </p>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <nav aria-label={t("filterLabel")} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex w-max gap-2 pb-1">
            {FILTERS.map((f) => (
              <li key={f}>
                <button type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} className={chipClass(filter === f)}>
                  {t(`filters.${f}`)}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="md:w-72">
          <label htmlFor={findId} className="sr-only">
            {t("findLabel")}
          </label>
          <input
            id={findId}
            type="search"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            maxLength={100}
            placeholder={t("findPlaceholder")}
            className="type-body h-11 w-full rounded-md border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className={panelBox}>
          <PackageSearch className="size-10 text-highlight" strokeWidth={1.5} aria-hidden />
          <p className="type-body max-w-sm text-ink-secondary">{all.length === 0 ? t("emptyAll") : t("empty")}</p>
        </div>
      ) : (
        <>
          <p className="type-body text-ink-secondary">{t("count", { count: visible.length })}</p>
          <ul className="flex flex-col gap-3">
            {visible.map((l) => (
              <li key={l.id}>
                <ListingRow listing={l} onEdit={() => setPanel({ kind: "edit", listing: l })} />
              </li>
            ))}
          </ul>
        </>
      )}

      <Sheet open={panel !== null} onOpenChange={(isOpen) => !isOpen && setPanel(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="type-h3 text-ink">{panel?.kind === "edit" ? t("editTitle") : t("addTitle")}</SheetTitle>
            <SheetDescription className="type-body text-ink-secondary">{panel?.kind === "edit" ? "" : t("addText")}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            {panel?.kind === "add" && !panel.product && (
              <ProductPicker listedIds={listedIds} onPick={(product) => setPanel({ kind: "add", product })} />
            )}
            {panel?.kind === "add" && panel.product && (
              <ListingForm
                shopId={shop.id}
                product={panel.product}
                onSaved={afterSave}
                onCancel={() => setPanel({ kind: "add", product: null })}
              />
            )}
            {panel?.kind === "edit" && (
              <>
                <ListingForm
                  key={panel.listing.id}
                  shopId={shop.id}
                  product={{ ...panel.listing.product, image: panel.listing.product.images[0] ?? null }}
                  listing={panel.listing}
                  onSaved={afterSave}
                  onCancel={() => setPanel(null)}
                />
                <div className="flex flex-col gap-2 border-t border-line pt-4">
                  <button
                    type="button"
                    onClick={() => toggle.mutate(panel.listing)}
                    disabled={toggle.isPending}
                    className={cn(
                      "type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm border px-4 disabled:opacity-60",
                      panel.listing.isActive ? "border-error text-error hover:bg-error-soft" : "border-success-ink text-success-ink hover:bg-success-soft",
                    )}
                  >
                    {toggle.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                    {panel.listing.isActive ? t("switchOff") : t("switchOn")}
                  </button>
                  {panel.listing.isActive && <p className="type-caption text-ink-muted">{t("switchOffNote")}</p>}
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ListingRow({ listing: l, onEdit }: { listing: OwnerListing; onEdit: () => void }) {
  const t = useTranslations("OwnerListings");
  const locale = useLocale();
  const image = safeMediaUrl(l.product.images[0] ?? null);
  const low = l.isActive && (l.availability === "LIMITED" || l.availability === "OUT_OF_STOCK");

  return (
    <article
      className={cn(
        "flex items-center gap-3 rounded-md border bg-card p-3 shadow-card md:gap-4 md:p-4",
        low ? "border-highlight" : "border-line",
        !l.isActive && "opacity-70",
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
        <h2 className="type-body-medium line-clamp-2 text-ink">{l.product.title}</h2>
        <p className="type-price text-ink">{formatTaka(l.price, locale)}</p>
        <div className="flex flex-wrap items-center gap-2">
          {l.isActive ? (
            <AvailabilityBadge value={l.availability} />
          ) : (
            <span className="type-caption rounded-full bg-subtle px-2.5 py-0.5 text-ink-secondary">{t("off")}</span>
          )}
          <span className="type-caption text-ink-muted">
            {l.stockQty !== null ? t("stock", { count: l.stockQty }) : t("stockUntracked")}
          </span>
        </div>
        <p className="type-caption text-ink-secondary">
          {l.bargainEnabled ? `🤝 ${t("offersOn", { percent: l.minOfferPercent })}` : t("offersOff")}
        </p>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="type-body-medium flex h-11 shrink-0 items-center rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        {t("edit")}
      </button>
    </article>
  );
}