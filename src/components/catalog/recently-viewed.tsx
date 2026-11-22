"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import { ArchFrame } from "@/components/brand/arch-frame";
import { Link } from "@/i18n/routing";
import { safeMediaUrl } from "@/lib/api/storefront";

// Kept in memory for this visit only (gone after a reload). No prices: those always come fresh from the server.
type Viewed = { slug: string; title: string; image: string | null };

const MAX = 8;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
let items: Viewed[] = [];
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const snapshot = () => items;
const serverSnapshot = (): Viewed[] => [];

function remember(entry: Viewed) {
  if (!SLUG.test(entry.slug) || entry.slug.length > 200) return;
  items = [entry, ...items.filter((v) => v.slug !== entry.slug)].slice(0, MAX);
  listeners.forEach((l) => l());
}

/** Put on a product page: adds that product to the visitor's recently viewed list. Renders nothing. */
export function RememberView({ slug, title, image }: Viewed) {
  useEffect(() => {
    remember({ slug, title: title.slice(0, 200), image });
  }, [slug, title, image]);
  return null;
}

/** A row of the products viewed during this visit (hidden until there are at least 2). */
export function RecentlyViewed({ exclude }: { exclude?: string }) {
  const t = useTranslations("RecentlyViewed");
  const all = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const list = all.filter((v) => v.slug !== exclude);
  if (list.length < 2) return null;

  return (
    <section aria-labelledby="recent-title" className="flex flex-col gap-4">
      <h2 id="recent-title" className="type-h2 text-ink">
        {t("title")}
      </h2>
      <ul className="scroll-row -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {list.map((v) => {
          const photo = safeMediaUrl(v.image);
          return (
            <li key={v.slug} className="w-32 shrink-0 snap-start md:w-36 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
              <Link
                href={`/products/${v.slug}`}
                className="group flex flex-col gap-2 rounded-md p-1 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                <ArchFrame className="bg-highlight-soft">
                  {photo && (
                    <Image
                      src={photo}
                      alt=""
                      fill
                      unoptimized
                      sizes="144px"
                      className="object-cover transition-transform duration-300 ease-out motion-safe:group-hover:scale-105"
                    />
                  )}
                </ArchFrame>
                <span className="type-caption line-clamp-2 text-ink-secondary group-hover:text-brand">{v.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
