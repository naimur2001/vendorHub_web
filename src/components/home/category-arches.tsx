import {
  Apple,
  Baby,
  Bike,
  BookOpen,
  Car,
  Dumbbell,
  Gem,
  Gift,
  Home,
  Laptop,
  type LucideIcon,
  PawPrint,
  Pill,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  Tv,
  Utensils,
  Watch,
  Wrench,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Stagger } from "@/components/motion/stagger";
import { Link } from "@/i18n/routing";
import type { Category } from "@/lib/api/catalog";
import { getCategories } from "@/lib/api/catalog-cache";

// Categories have no pictures: pick an icon from words in the slug, otherwise a basket.
const ICONS: [RegExp, LucideIcon][] = [
  [/phone|mobile/, Smartphone],
  [/laptop|computer|pc/, Laptop],
  [/tv|electronic|gadget/, Tv],
  [/watch/, Watch],
  [/fashion|cloth|shirt|wear|dress|saree|panjabi/, Shirt],
  [/jewel|gold|ornament/, Gem],
  [/beauty|cosmetic|skin|makeup/, Sparkles],
  [/grocer|food|fruit|vegetable/, Apple],
  [/kitchen|cook|utensil/, Utensils],
  [/furniture|sofa/, Sofa],
  [/home|living|decor/, Home],
  [/baby|kid|toy/, Baby],
  [/book|station/, BookOpen],
  [/sport|fitness|gym/, Dumbbell],
  [/health|medic|pharma/, Pill],
  [/pet/, PawPrint],
  [/bike|cycle/, Bike],
  [/car|auto|motor/, Car],
  [/tool|hardware/, Wrench],
  [/gift/, Gift],
];

function iconFor(slug: string): LucideIcon {
  return ICONS.find(([pattern]) => pattern.test(slug))?.[1] ?? ShoppingBasket;
}

/** Top-level categories with the most products, as arch-shaped doors (10-minute category cache). */
export async function CategoryArches({ heading }: { heading: ReactNode }) {
  const t = await getTranslations("Home");
  let categories: Category[];
  try {
    categories = await getCategories();
  } catch {
    return null; // the rest of the home page still works
  }
  const top = categories
    .filter((c) => !c.parentId && c.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, 8);
  if (top.length === 0) return null;

  return (
    <section aria-labelledby="categories-title" className="flex flex-col gap-5">
      {heading}
      {/* Phones: one swipeable row. Wide screens: up to eight in a line. */}
      <Stagger
        as="ul"
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-2 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-8"
      >
        {top.map((category) => {
          const Icon = iconFor(category.slug.toLowerCase());
          return (
            <li
              key={category.id}
              className="w-28 shrink-0 snap-start md:w-auto"
            >
              <Link
                href={`/search?category=${encodeURIComponent(category.slug)}`}
                className="group flex h-full flex-col items-center gap-2 rounded-t-full rounded-b-sm border border-line bg-card px-2 pt-5 pb-4 text-center shadow-card hover:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-1 motion-safe:focus-visible:-translate-y-1"
              >
                <span
                  aria-hidden
                  className="flex size-14 items-center justify-center rounded-full border border-gold bg-highlight-soft text-highlight motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-110"
                >
                  <Icon className="size-6" strokeWidth={1.5} />
                </span>
                <span className="type-body-medium line-clamp-2 text-ink group-hover:text-brand">
                  {category.name}
                </span>
                <span className="type-caption text-ink-muted">
                  {t("categoryCount", { count: category.productCount })}
                </span>
              </Link>
            </li>
          );
        })}
      </Stagger>
    </section>
  );
}

export function CategoryArchesSkeleton() {
  return (
    <div
      className="-mx-4 flex gap-3 overflow-hidden px-4 pt-2 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:px-0 lg:grid-cols-8"
      aria-hidden
    >
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="h-40 w-28 shrink-0 skeleton rounded-t-full rounded-b-sm md:w-auto"
        />
      ))}
    </div>
  );
}
