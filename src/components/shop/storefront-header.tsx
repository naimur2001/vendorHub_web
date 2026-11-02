"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Handshake, LoaderCircle, MapPin, Star, Users } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useSession } from "@/components/app-providers";
import { VerificationSeal } from "@/components/brand/verification-seal";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api/client";
import { safeMediaUrl, shopPlace, type Storefront } from "@/lib/api/storefront";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

// Banner without a photo: a field of gold arch outlines on bordeaux.
function ArchPattern() {
  const id = useId();
  return (
    <svg className="absolute inset-0 size-full" aria-hidden="true">
      <defs>
        <pattern id={id} width="72" height="88" patternUnits="userSpaceOnUse">
          <path d="M10 88 V38 A26 26 0 0 1 62 38 V88" fill="none" strokeWidth="1.5" className="stroke-gold" opacity="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function ShopLogo({ shop }: { shop: Storefront }) {
  const logo = safeMediaUrl(shop.logoUrl);
  return (
    <span className="relative flex h-24 w-20 shrink-0 items-end justify-center overflow-hidden rounded-t-full rounded-b-sm border-4 border-surface bg-brand pb-3 shadow-card">
      {logo ? (
        <Image src={logo} alt="" fill unoptimized sizes="80px" className="object-cover" />
      ) : (
        <span className="font-heading text-[1.5rem] text-primary-foreground" aria-hidden>
          {initials(shop.name)}
        </span>
      )}
    </span>
  );
}

type FollowResult = { following: boolean; followers: number };

/** Follow: guests log in first; logged-in users see their real state (the server page does not know it). */
function FollowButton({ slug, onFollowers }: { slug: string; onFollowers: (n: number) => void }) {
  const t = useTranslations("Shop");
  const { status } = useSession();
  const queryClient = useQueryClient();
  const key = ["shop-follow", slug];

  const state = useQuery({
    queryKey: key,
    queryFn: () => api.get<Storefront>(`/shops/${encodeURIComponent(slug)}`),
    enabled: status === "authenticated",
    select: (shop) => shop.isFollowing,
  });

  const toggle = useMutation({
    mutationFn: (follow: boolean) =>
      follow
        ? api.post<FollowResult>(`/shops/${encodeURIComponent(slug)}/follow`)
        : api.delete<FollowResult>(`/shops/${encodeURIComponent(slug)}/follow`),
    onSuccess: (result) => {
      queryClient.setQueryData<Storefront>(key, (old) => (old ? { ...old, isFollowing: result.following } : old));
      onFollowers(result.followers);
    },
  });

  const base =
    "type-body-medium flex h-11 w-full items-center justify-center gap-2 rounded-sm px-5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none md:w-auto ";

  if (status !== "authenticated") {
    return (
      <Link
        href={`/auth/login?next=${encodeURIComponent(`/shops/${slug}`)}`}
        aria-disabled={status === "loading"}
        className={cn(base, "bg-action text-primary-foreground hover:bg-action-hover")}
      >
        {t("follow")}
      </Link>
    );
  }

  const following = state.data === true;
  const busy = state.isPending || toggle.isPending;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => toggle.mutate(!following)}
        disabled={busy}
        aria-pressed={following}
        className={cn(
          base,
          following
            ? "  border border-brand bg-card text-brand hover:bg-subtle"
            : "bg-action text-primary-foreground hover:bg-action-hover",
          "disabled:cursor-not-allowed disabled:opacity-70",
        )}
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          following && <Check className="size-4" aria-hidden />
        )}
        {following ? t("following") : t("follow")}
      </button>
      {toggle.isError && (
        <p role="alert" className="type-caption text-error">
          {t("followError")}
        </p>
      )}
    </div>
  );
}

export function StorefrontHeader({ shop }: { shop: Storefront }) {
  const t = useTranslations("Shop");
  const format = useFormatter();
  const [followers, setFollowers] = useState(shop.stats.followers);

  // Banner: the shop's banner, else its cover photo from the trust gallery, else the arch pattern.
  const bannerPhoto = safeMediaUrl(shop.bannerUrl);
  const coverPhoto = safeMediaUrl(shop.coverPhoto?.url);
  const photo = bannerPhoto ?? coverPhoto;
  const photoNote = !bannerPhoto && coverPhoto && shop.coverPhoto;

  const place = shopPlace(shop.address.levelFloor, shop.address.shopNumber);
  const level = shop.verification.level;

  const stats = [
    {
      icon: Star,
      text:
        shop.stats.ratingAverage !== null
          ? t("rating", { average: shop.stats.ratingAverage.toFixed(1), count: shop.stats.reviewCount })
          : t("noReviews"),
    },
    ...(shop.stats.avgResponseMins ? [{ icon: Clock, text: t("responds", { minutes: shop.stats.avgResponseMins }) }] : []),
    { icon: Users, text: t("followers", { count: followers }) },
    { icon: Handshake, text: t("openToOffers", { count: shop.stats.activeBargains }) },
  ];

  return (
    <header className="-mx-4 -mt-6 flex flex-col md:-mx-10">
      <div className="relative h-40 overflow-hidden bg-brand md:h-60">
        {photo ? (
          <>
            <Image src={photo} alt={t("bannerAlt", { name: shop.name })} fill unoptimized priority sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
          </>
        ) : (
          <ArchPattern />
        )}
        {photoNote && (
          <p className="type-caption absolute right-3 bottom-3 rounded-sm bg-ink/70 px-2 py-1 text-surface">
            {shop.coverPhoto?.verified ? t("photoVerified") : t("photoUnverified")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 px-4 md:px-10">
        {/* //changed mt 12 to 11 */}
        <div className="-mt-11 flex items-end justify-between gap-4">  
          <ShopLogo shop={shop} />
          <div className="hidden pb-1 md:block ">
            <FollowButton slug={shop.slug} onFollowers={setFollowers} />
          </div>
        </div>
          <div className="flex min-w-0 flex-col gap-2">
            {/* Name with the seal beside it on desktop; seal below the name on phones */}
            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-x-4">
              <h1 className="type-display break-words text-ink">{shop.name}</h1>
              {level !== "UNVERIFIED" && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <VerificationSeal level={level} size="md" withLabel className="mt-4" />
                  {shop.verification.lastAuditedAt && (
                    <span className="type-caption text-ink-muted mt-4">
                      {t("audited", {
                        date: format.dateTime(new Date(shop.verification.lastAuditedAt), { month: "short", year: "numeric" }),
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="type-caption inline-flex items-center gap-1 self-start rounded-sm bg-info-soft px-2 py-1 text-verified">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {[place, shop.market?.name].filter(Boolean).join(" · ") || shop.address.addressLine}
            </p>
            {shop.market && (
              <Link href={`/markets/${shop.market.slug}`} className="type-body-medium self-start text-brand underline-offset-4 hover:underline">
                {t("allShopsIn", { market: shop.market.name })} →
              </Link>
            )}
          </div>

        <div className="md:hidden">
          <FollowButton slug={shop.slug} onFollowers={setFollowers} />
        </div>

        <ul aria-label={t("trustStats")} className="flex flex-wrap gap-x-6 gap-y-2 border-y border-line py-3">
          {stats.map(({ icon: Icon, text }) => (
            <li key={text} className="type-body flex items-center gap-2 text-ink-secondary">
              <Icon className="size-4 shrink-0 text-highlight" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}