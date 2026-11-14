import {
  Cable,
  Headphones,
  Laptop,
  Package,
  Shirt,
  Smartphone,
  Tablet,
  Watch,
  type LucideProps,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArchFrame } from "@/components/brand/arch-frame";
import { PriceTicket } from "@/components/brand/price-ticket";
import { AvailabilityBadge } from "@/components/catalog/availability-badge";
import { Reveal } from "@/components/motion/reveal";
import { Link } from "@/i18n/routing";
import type { ProductCardData } from "@/lib/api/catalog";

type CategoryKind = "phone" | "tablet" | "laptop" | "watch" | "audio" | "accessory" | "fashion" | "other";

const KINDS: [RegExp, CategoryKind][] = [
  [/phone|mobile/, "phone"],
  [/tablet/, "tablet"],
  [/laptop|computer/, "laptop"],
  [/watch|wearable/, "watch"],
  [/audio|headphone|earbud|speaker/, "audio"],
  [/accessor|charger|cable/, "accessory"],
  [/fashion|cloth|wear|shirt/, "fashion"],
];

function categoryKind(categorySlug: string): CategoryKind {
  return KINDS.find(([pattern]) => pattern.test(categorySlug))?.[1] ?? "other";
}

/** Icon standing in for a missing product photo. A fixed component (React rule: no components chosen during render). */
export function CategoryIcon({ categorySlug, ...props }: { categorySlug: string } & LucideProps) {
  switch (categoryKind(categorySlug)) {
    case "phone":
      return <Smartphone {...props} />;
    case "tablet":
      return <Tablet {...props} />;
    case "laptop":
      return <Laptop {...props} />;
    case "watch":
      return <Watch {...props} />;
    case "audio":
      return <Headphones {...props} />;
    case "accessory":
      return <Cable {...props} />;
    case "fashion":
      return <Shirt {...props} />;
    default:
      return <Package {...props} />;
  }
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const t = useTranslations("Catalog");

  return (
    // Reveal: rises in on scroll, neighbours one after another. The link lifts on hover (.lift).
    <Reveal className="flex">
    <Link
      href={`/products/${product.slug}`}
      className="group lift flex w-full flex-col gap-2 rounded-md border border-line bg-card p-2 pb-3 shadow-card transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
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
            className="object-cover transition-transform duration-300 ease-out motion-safe:group-hover:scale-105"
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-highlight">
            <CategoryIcon categorySlug={product.category.slug} className="size-10" strokeWidth={1.25} aria-hidden />
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
    </Reveal>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-card p-2 pb-3" aria-hidden>
      <div className="skeleton aspect-[4/5] rounded-t-full rounded-b-sm" />
      <div className="skeleton h-4 w-3/4 rounded-sm" />
      <div className="skeleton h-6 w-1/2 rounded-sm" />
    </div>
  );
}