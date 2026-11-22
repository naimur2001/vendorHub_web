"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, LoaderCircle, LocateFixed, MapPinOff, Store } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { VerificationSeal } from "@/components/brand/verification-seal";
import { OpenBadge } from "@/components/shop/open-badge";
import { Link } from "@/i18n/routing";
import { getNearShops, NEAR_RADII, type NearRadius, type NearShop } from "@/lib/api/nearby";
import { safeMediaUrl } from "@/lib/api/storefront";
import { cn } from "@/lib/utils";

type Spot = { lat: number; lng: number };
type Phase = "idle" | "locating" | "denied" | "unavailable" | "ready";

const button =
  "type-body-medium inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60";

/** Home page: the visitor shares their location (only when they tap) and sees verified shops nearby. */
export function ShopsNearYou() {
  const t = useTranslations("NearYou");
  const [phase, setPhase] = useState<Phase>("idle");
  const [spot, setSpot] = useState<Spot | null>(null);
  const [radius, setRadius] = useState<NearRadius>(5);

  const shops = useQuery({
    queryKey: ["shops", "near", spot?.lat, spot?.lng, radius],
    queryFn: () => getNearShops(spot!.lat, spot!.lng, radius),
    enabled: spot !== null,
    staleTime: 5 * 60_000,
  });

  function locate() {
    if (!("geolocation" in navigator)) return setPhase("unavailable");
    setPhase("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSpot({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPhase("ready");
      },
      (err) => setPhase(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }

  return (
    <section aria-labelledby="near-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="near-title" className="type-h2 text-ink">
          {t("title")}
        </h2>
        <p className="type-body text-ink-secondary">{t("subtitle")}</p>
      </div>

      {phase !== "ready" ? (
        <div className="flex flex-col items-start gap-3 rounded-3xl border border-dashed border-line-strong bg-card p-5 md:flex-row md:items-center md:justify-between">
          <p className="type-body flex items-start gap-2 text-ink-secondary" role={phase === "denied" || phase === "unavailable" ? "alert" : undefined}>
            {phase === "denied" || phase === "unavailable" ? (
              <MapPinOff className="mt-0.5 size-5 shrink-0 text-error" aria-hidden />
            ) : (
              <LocateFixed className="mt-0.5 size-5 shrink-0 text-highlight" aria-hidden />
            )}
            {phase === "denied" ? t("denied") : phase === "unavailable" ? t("unavailable") : t("privacy")}
          </p>
          <button type="button" onClick={locate} disabled={phase === "locating"} aria-busy={phase === "locating"} className={button}>
            {phase === "locating" ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden /> : <LocateFixed className="size-4" aria-hidden />}
            {phase === "locating" ? t("locating") : t("useLocation")}
          </button>
        </div>
      ) : (
        <>
          <div role="group" aria-label={t("radiusLabel")} className="flex flex-wrap gap-2">
            {NEAR_RADII.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadius(r)}
                aria-pressed={radius === r}
                className={cn(
                  "type-body-medium h-11 rounded-full border px-4 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
                  radius === r ? "border-brand bg-brand text-primary-foreground" : "border-line bg-card text-ink-secondary hover:border-brand",
                )}
              >
                {t("within", { km: r })}
              </button>
            ))}
          </div>

          {shops.isPending ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
              {Array.from({ length: 3 }, (_, i) => (
                <li key={i} className="h-24 skeleton rounded-2xl" />
              ))}
            </ul>
          ) : shops.isError ? (
            <div role="alert" className="flex items-center gap-3">
              <p className="type-body text-ink-secondary">{t("loadError")}</p>
              <button type="button" onClick={() => shops.refetch()} className="type-body-medium h-11 rounded-sm border border-brand px-4 text-brand hover:bg-subtle">
                {t("retry")}
              </button>
            </div>
          ) : shops.data.length === 0 ? (
            <p className="type-body text-ink-secondary">{t("none", { km: radius })}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shops.data.map((s) => (
                <li key={s.id}>
                  <NearCard shop={s} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function NearCard({ shop }: { shop: NearShop }) {
  const t = useTranslations("NearYou");
  const locale = useLocale();
  const photo = safeMediaUrl(shop.coverPhoto?.url) ?? safeMediaUrl(shop.logoUrl);
  const km = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(shop.distanceKm);

  return (
    <Link
      href={`/shops/${shop.slug}`}
      className="group flex items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-card hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    >
      <span className="relative flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden rounded-t-full rounded-b-sm bg-brand">
        {photo ? <Image src={photo} alt="" fill unoptimized sizes="56px" className="object-cover" /> : <Store className="size-5 text-primary-foreground" aria-hidden />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1.5">
          <span className="type-body-medium truncate text-ink group-hover:text-brand">{shop.name}</span>
          {shop.verificationLevel !== "UNVERIFIED" && <VerificationSeal level={shop.verificationLevel} size="sm" />}
        </span>
        {shop.market && <span className="type-caption truncate text-ink-muted">{shop.market.name}</span>}
        <span className="flex flex-wrap items-center gap-2">
          <span className="type-caption rounded-full bg-highlight-soft px-2 py-0.5 text-highlight">{t("distance", { km })}</span>
          <OpenBadge shop={shop} />
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
    </Link>
  );
}
