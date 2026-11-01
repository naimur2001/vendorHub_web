import {
  Cable,
  Headphones,
  Laptop,
  Package,
  Shirt,
  Smartphone,
  Tablet,
  Watch,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArchFrame } from "@/components/brand/arch-frame";
import { PriceTicket } from "@/components/brand/price-ticket";
import { AvailabilityBadge } from "@/components/catalog/availability-badge";
import { Link } from "@/i18n/routing";
import type { ProductCardData } from "@/lib/api/catalog";

// A category icon stands in for missing product photos.
const PLACEHOLDERS: [RegExp, LucideIcon][] = [
  [/phone|mobile/, Smartphone],
  [/tablet/, Tablet],
  [/laptop|computer/, Laptop],
  [/watch|wearable/, Watch],
  [/audio|headphone|earbud|speaker/, Headphones],
  [/accessor|charger|cable/, Cable],
  [/fashion|cloth|wear|shirt/, Shirt],
];

function placeholderIcon(categorySlug: string): LucideIcon {
  return PLACEHOLDERS.find(([pattern]) => pattern.test(categorySlug))?.[1] ?? Package;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const t = useTranslations("Catalog");
  const Icon = placeholderIcon(product.category.slug);

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col gap-2 rounded-md border border-line bg-card p-2 pb-3 shadow-card transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    >
      <ArchFrame className="bg-highlight-soft">
        {product.image ? (
          // Photos come from our API (allowed by the CSP). Optimisation is switched on at deployment.
          <Image
            src={product.image}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-highlight">
            <Icon className="size-10" strokeWidth={1.25} aria-hidden />
            <span className="type-caption text-ink-muted">{t("noPhoto")}</span>
          </span>
        )}
        {product.bargainAvailable && (
          <span className="type-caption absolute bottom-2 left-2 rounded-sm bg-highlight px-1.5 py-0.5 text-primary-foreground">
            <span aria-hidden>🤝 </span>
            {t("bargain")}
            <span className="sr-only">: {t("bargainAvailable")}</span>
          </span>
        )}
      </ArchFrame>

      <div className="flex flex-col gap-1 px-1">
        {product.brand && <p className="type-caption text-ink-muted">{product.brand.name}</p>}
        <h3 className="type-body-medium line-clamp-2 text-ink group-hover:text-brand">{product.title}</h3>
      </div>

      <div className="flex flex-wrap items-baseline gap-1.5 px-1">
        {product.shopCount > 1 && <span className="type-caption text-ink-muted">{t("from")}</span>}
        <PriceTicket amount={product.lowestPrice} msrp={product.msrp} />
      </div>

      <div className="flex flex-wrap items-center gap-2 px-1">
        <AvailabilityBadge value={product.availability} />
        <span className="type-caption text-ink-muted">{t("shops", { count: product.shopCount })}</span>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-card p-2 pb-3" aria-hidden>
      <div className="aspect-[4/5] animate-pulse rounded-t-full rounded-b-sm bg-subtle" />
      <div className="h-4 w-3/4 animate-pulse rounded-sm bg-subtle" />
      <div className="h-6 w-1/2 animate-pulse rounded-sm bg-subtle" />
    </div>
  );
}