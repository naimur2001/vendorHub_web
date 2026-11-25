import { getLocale } from "next-intl/server";
import { OrbitRing, type OrbitItem } from "@/components/motion/orbit-ring";
import { getLatestProducts, getShelf } from "@/lib/api/catalog-cache";
import { safeMediaUrl } from "@/lib/api/storefront";
import { formatTaka } from "@/lib/format";

/** The shopping bag in the middle of the orbit: bordeaux body, gold handle and the arch motif. */
function BagArt() {
  return (
    <div className="relative">
      <span aria-hidden className="absolute inset-0 -z-10 scale-150 rounded-full bg-gold/20 blur-3xl" />
      <svg viewBox="0 0 200 230" aria-hidden className="w-32 drop-shadow-xl md:w-48">
        <ellipse cx="100" cy="222" rx="72" ry="7" className="fill-ink/10" />
        <path d="M68 74V52a32 32 0 0 1 64 0v22" fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-gold" />
        <path d="M34 72h132l13 136q1 9-8 9H29q-9 0-8-9Z" className="fill-brand" />
        <path d="M34 72h132l2 18H32Z" className="fill-brand-alt" />
        <circle cx="68" cy="82" r="4" className="fill-gold" />
        <circle cx="132" cy="82" r="4" className="fill-gold" />
        {/* Arch window with its keystone */}
        <path d="M74 196v-48a26 26 0 0 1 52 0v48" fill="none" strokeWidth="3" className="stroke-gold" />
        <path d="M95 116h10l-2 9h-6Z" className="fill-gold" />
        <path d="M150 104c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9Z" className="fill-gold" />
      </svg>
    </div>
  );
}

/**
 * Top of the home page: real products (trending first, then the newest; only those with a photo)
 * circling a shopping bag. Prices come from the server. Nothing shows with fewer than 4 products.
 */
export async function BagOrbit() {
  const locale = await getLocale();
  const [trending, latest] = await Promise.all([getShelf("trending").catch(() => []), getLatestProducts().catch(() => [])]);

  const items: OrbitItem[] = [];
  const seen = new Set<string>();
  for (const product of [...trending, ...latest]) {
    const image = safeMediaUrl(product.image);
    if (!image || seen.has(product.id)) continue;
    seen.add(product.id);
    items.push({ id: product.id, slug: product.slug, title: product.title, image, price: formatTaka(product.lowestPrice, locale) });
    if (items.length === 8) break;
  }
  if (items.length < 4) return null;

  return (
    <section className="-mx-4 overflow-hidden md:mx-0">
      <OrbitRing items={items} centre={<BagArt />} />
    </section>
  );
}
