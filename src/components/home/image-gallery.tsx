import { getLocale, getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion/reveal";
import { Link } from "@/i18n/routing";
import { getGallery, type HomeBanner } from "@/lib/api/catalog-cache";
import { safeMediaUrl } from "@/lib/api/storefront";
import { cn } from "@/lib/utils";

// Internal paths and https links only (the backend checks too).
function safeLink(
  value: string | null,
): { href: string; external: boolean } | null {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\"))
    return { href: value, external: false };
  try {
    const url = new URL(value);
    if (url.protocol === "https:")
      return { href: url.toString(), external: true };
  } catch {
    // not a URL
  }
  return null;
}

type Picture = {
  id: string;
  src: string;
  alt: string;
  link: ReturnType<typeof safeLink>;
};

/** One picture: zooms a little and shows its title on hover or keyboard focus (still with reduced motion). */
function Tile({
  picture,
  className,
}: {
  picture: Picture;
  className?: string;
}) {
  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- processed WebP from the media server */}
      <img
        src={picture.src}
        alt={picture.alt}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 -z-10 size-full object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105 motion-safe:group-focus-visible:scale-105"
      />
      {/* Bordeaux veil and title rise in on hover/focus */}
      <span
        aria-hidden
        className="flex translate-y-2 items-end bg-linear-to-t from-brand/85 via-brand/40 to-transparent p-4 pt-10 opacity-0 motion-safe:transition-[transform,opacity] motion-safe:duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
      >
        <span className="type-body-medium line-clamp-2 text-primary-foreground">
          {picture.alt}
        </span>
      </span>
      {/* Thin gold frame on hover/focus */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-2 rounded-2xl border border-gold/70 opacity-0 motion-safe:transition-opacity motion-safe:duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </>
  );
  const frame = cn(
    "group relative isolate flex min-h-0 flex-col justify-end overflow-hidden rounded-3xl bg-subtle shadow-card",
    "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
    className,
  );
  // A product picture goes straight to the product page (e.g. /products/t-shirt).
  if (!picture.link) return <figure className={frame}>{body}</figure>;
  return picture.link.external ? (
    <a
      href={picture.link.href}
      target="_blank"
      rel="noopener noreferrer"
      className={frame}
    >
      {body}
    </a>
  ) : (
    <Link href={picture.link.href} className={frame}>
      {body}
    </Link>
  );
}

// Top band (tablets and up): columns of one big picture or a stack of small ones,
// laid out like the designed frame [big | 2 stacked | 3 stacked | big] for 7 pictures.
const MOSAIC: Record<number, number[]> = {
  1: [1],
  2: [1, 1],
  3: [1, 2],
  4: [1, 2, 1],
  5: [1, 3, 1],
  6: [1, 2, 2, 1],
  7: [1, 2, 3, 1],
};

function Mosaic({ pictures, className }: { pictures: Picture[]; className?: string }) {
  const columns = MOSAIC[pictures.length] ?? MOSAIC[7];
  // Where each column starts in the list
  const starts = columns.map((_, c) => columns.slice(0, c).reduce((sum, n) => sum + n, 0));
  return (
    <div className={cn("flex h-72 gap-3 lg:h-80 lg:gap-4 xl:h-96", className)}>
      {columns.map((size, c) => {
        const group = pictures.slice(starts[c], starts[c] + size);
        return (
          // A big picture is twice as wide as a stack
          <div
            key={c}
            className={cn(
              "flex min-w-0 flex-col gap-3 lg:gap-4",
              size === 1 ? "flex-2" : "flex-1",
            )}
          >
            {group.map((p) => (
              <Tile key={p.id} picture={p} className="flex-1" />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** A row of equal pictures (the five under the mosaic, then the wide ones at the bottom). */
function Row({ pictures, tall }: { pictures: Picture[]; tall?: boolean }) {
  if (pictures.length === 0) return null;
  return (
    <div
      className={cn(
        "flex gap-3 lg:gap-4",
        tall ? "h-52 lg:h-64" : "h-40 lg:h-48",
      )}
    >
      {pictures.map((p) => (
        <Tile key={p.id} picture={p} className="min-w-0 flex-1" />
      ))}
    </div>
  );
}

// Wide screens: the gallery lines up with the banner row above it, which reaches into the page margins
// ("both": left panel and right column; "left": left panel only, ending where the slider ends).
type Edges = "page" | "left" | "both";
const EDGES: Record<Edges, string> = {
  page: "",
  left: "xl:-ml-6 xl:pr-10 2xl:-ml-24 2xl:pr-20",
  both: "xl:-mx-6 2xl:-mx-24",
};

/**
 * Admin image gallery under the slider (pictures only, 1-minute cache).
 * Phones: two columns with every third picture full width. Tablets and up: the designed mosaic.
 * Renders nothing when there are no pictures or the API is down.
 */
export async function ImageGallery({ edges = "page", hanging = false }: { edges?: Edges; hanging?: boolean }) {
  let banners: HomeBanner[];
  try {
    banners = await getGallery();
  } catch {
    return null;
  }
  const bn = (await getLocale()) === "bn";
  const pictures: Picture[] = banners.flatMap((b) => {
    const src = safeMediaUrl(b.media.url);
    return src
      ? [
          {
            id: b.id,
            src,
            alt: (bn && b.titleBn) || b.titleEn,
            link: safeLink(b.linkUrl),
          },
        ]
      : [];
  });
  if (pictures.length === 0) return null;
  const t = await getTranslations("Gallery");

  const top = pictures.slice(0, 7);
  const middle = pictures.slice(7, 12);
  const bottom = pictures.slice(12);

  return (
    <Reveal>
      <section aria-label={t("label")} className={EDGES[edges]}>
        {/* Phones */}
        <div className="grid grid-cols-2 gap-3 md:hidden">
          {pictures.map((p, i) => {
            // Wide: every third picture, and a last one that would sit alone
            const wide =
              i % 3 === 0 || (i === pictures.length - 1 && i % 3 === 1);
            return (
              <Tile
                key={p.id}
                picture={p}
                className={wide ? "col-span-2 aspect-2/1" : "aspect-square"}
              />
            );
          })}
        </div>
        {/* Tablets and up */}
        <div className="hidden flex-col gap-3 md:flex lg:gap-4">
          {/* The shop-to-let card (18rem) hangs about 14rem into the gallery from the right column; only the mosaic
              (24rem tall) keeps that column (13rem + 2.5rem gap) free, the rows below use the full width. */}
          <Mosaic pictures={top} className={cn(hanging && "xl:pr-[15.5rem]")} />
          <Row pictures={middle} />
          <Row pictures={bottom} tall />
        </div>
      </section>
    </Reveal>
  );
}
