import { Package, Zap } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PriceTicket } from "@/components/brand/price-ticket";
import { DealCountdown } from "@/components/motion/deal-countdown";
import { Link } from "@/i18n/routing";
import { getDeals, type PublicDeal } from "@/lib/api/catalog-cache";
import { safeMediaUrl } from "@/lib/api/storefront";

/** Home page "Flash deals": a sideways row of live deals, ending soonest first. Nothing shows when there are none. */
export async function FlashDeals() {
  const t = await getTranslations("Deals");
  let deals: PublicDeal[];
  try {
    deals = await getDeals();
  } catch {
    return null; // the rest of the home page still works
  }
  if (deals.length === 0) return null;

  return (
    <section aria-labelledby="deals-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="deals-title" className="type-h2 flex items-center gap-2 text-ink">
          <Zap className="size-6 text-gold" aria-hidden />
          {t("title")}
        </h2>
        <p className="type-body text-ink-secondary">{t("text")}</p>
      </div>
      <ul className="scroll-row -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-1 pb-2 md:mx-0 md:px-0">
        {deals.map((d) => (
          <li key={d.dealId} className="w-44 shrink-0 snap-start sm:w-52">
            <DealCard deal={d} />
          </li>
        ))}
      </ul>
    </section>
  );
}

async function DealCard({ deal }: { deal: PublicDeal }) {
  const t = await getTranslations("Deals");
  const photo = safeMediaUrl(deal.product.thumbUrl) ?? safeMediaUrl(deal.product.image);
  const fewLeft = deal.remaining !== null && deal.remaining <= 10;

  return (
    <Link
      href={`/products/${deal.product.slug}?listing=${deal.listingId}`}
      className="group lift flex h-full flex-col gap-2 rounded-md border border-line bg-card p-2 pb-3 shadow-card hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    >
      <span className="relative block aspect-4/5 overflow-hidden rounded-t-full rounded-b-sm bg-highlight-soft">
        {photo ? (
          <Image src={photo} alt="" fill unoptimized sizes="208px" className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" />
        ) : (
          <Package className="absolute inset-0 m-auto size-10 text-highlight" strokeWidth={1.25} aria-hidden />
        )}
        <span className="type-caption absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-2.5 py-0.5 font-medium text-ink">
          {t("off", { percent: deal.percentOff })}
        </span>
      </span>
      <span className="flex flex-col gap-1 px-1">
        <span className="type-body-medium line-clamp-2 text-ink group-hover:text-brand">{deal.product.title}</span>
        <span className="type-caption truncate text-ink-muted">{deal.shop.name}</span>
      </span>
      <span className="px-1">
        <PriceTicket amount={deal.price} msrp={deal.originalPrice} />
      </span>
      <span className="mt-auto flex flex-wrap items-center gap-2 px-1">
        <DealCountdown endsAt={deal.endsAt} />
        {fewLeft && <span className="type-caption text-error">{t("left", { count: deal.remaining ?? 0 })}</span>}
      </span>
    </Link>
  );
}
