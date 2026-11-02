import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, SearchX, Search as SearchIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ProductCard, ProductCardSkeleton } from "@/components/catalog/product-card";
import { ActiveFilters, DesktopFilters, MobileFilters } from "@/components/search/search-filters";
import { getPathname, Link } from "@/i18n/routing";
import { listProducts, type Brand, type Category } from "@/lib/api/catalog";
import { getBrands, getCategories, getMarkets } from "@/lib/api/catalog-cache";
import type { Market } from "@/lib/api/shops";
import { parseSearchParams, searchHref, toProductQuery, type SearchState } from "@/lib/search-params";
import { cn } from "@/lib/utils";

type RawParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<RawParams> };

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4";

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Search" });
  // Search pages: do not index (thousands of variations), but follow links to products.
  return { title: t("metaTitle"), robots: { index: false, follow: true } };
}

// Lists for chips and filters come from a 10-minute cache; if one fails, search still works without it.
async function safeList<T>(load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch {
    return [];
  }
}

// Plain form: works even before JavaScript loads. Keeps category, filters and sort; starts at page 1.
function SearchForm({ locale, state, label, button }: { locale: string; state: SearchState; label: string; button: string }) {
  const keep: [string, string | undefined][] = [
    ["category", state.category],
    ["brand", state.brand],
    ["minPrice", state.minPrice?.toString()],
    ["maxPrice", state.maxPrice?.toString()],
    ["marketId", state.marketId],
    ["availableOnly", state.availableOnly ? "true" : undefined],
    ["sort", state.sort !== "newest" ? state.sort : undefined],
  ];

  return (
    <form role="search" action={getPathname({ href: "/search", locale })} method="get" className="flex gap-2">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
        <input
          type="search"
          name="q"
          defaultValue={state.q ?? ""}
          maxLength={100}
          placeholder={label}
          aria-label={label}
          autoComplete="off"
          className="type-body h-12 w-full rounded-md border border-input bg-card pr-3 pl-10 text-ink placeholder:text-ink-muted hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
        />
      </div>
      {keep.map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
      <button
        type="submit"
        className="type-body-medium h-12 shrink-0 rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {button}
      </button>
    </form>
  );
}

function CategoryChips({ state, categories, label, allLabel }: { state: SearchState; categories: Category[]; label: string; allLabel: string }) {
  const chips = [{ slug: undefined as string | undefined, name: allLabel }, ...categories.map((c) => ({ slug: c.slug, name: c.name }))];

  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex w-max gap-2 pb-1">
        {chips.map(({ slug, name }) => {
          const active = state.category === slug;
          return (
            <li key={slug ?? "all"}>
              <Link
                href={searchHref(state, { category: slug })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "type-body-medium flex h-10 items-center rounded-full border px-4 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
                  active ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand",
                )}
              >
                {name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

async function Pagination({ state, totalPages }: { state: SearchState; totalPages: number }) {
  const t = await getTranslations("Search");
  const linkClass =
    "type-body-medium flex h-11 items-center gap-1 rounded-sm border border-brand px-3 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none";

  return (
    <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3 border-t border-gold pt-5">
      {state.page > 1 ? (
        <Link href={searchHref(state, { page: state.page - 1 })} rel="prev" className={linkClass}>
          <ChevronLeft className="size-4" aria-hidden />
          {t("previous")}
        </Link>
      ) : (
        <span />
      )}
      <span className="type-body text-ink-secondary">{t("pageOf", { page: state.page, total: totalPages })}</span>
      {state.page < totalPages ? (
        <Link href={searchHref(state, { page: state.page + 1 })} rel="next" className={linkClass}>
          {t("next")}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

async function Results({ state }: { state: SearchState }) {
  const t = await getTranslations("Search");

  let result;
  try {
    result = await listProducts(toProductQuery(state));
  } catch {
    return (
      <p role="alert" className="type-body text-ink-secondary">
        {t("loadError")}
      </p>
    );
  }

  const products = result.data;
  const total = result.meta?.pagination?.total ?? products.length;
  const totalPages = result.meta?.pagination?.totalPages ?? 1;

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center">
        <SearchX className="size-10 text-highlight" strokeWidth={1.5} aria-hidden />
        <h2 className="type-h3 text-ink">{t("emptyTitle")}</h2>
        <p className="type-body max-w-sm text-ink-secondary">{t("emptyText")}</p>
        {(state.q || state.category) && (
          <Link href="/search" className="type-body-medium text-brand underline-offset-4 hover:underline">
            {t("clearSearch")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby="results-heading" className="flex flex-col gap-4">
      <h2 id="results-heading" className="sr-only">
        {t("resultsHeading")}
      </h2>
      <p className="type-body text-ink-secondary">{t("count", { count: total })}</p>
      <div className={GRID}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {totalPages > 1 && <Pagination state={state} totalPages={totalPages} />}
    </section>
  );
}

function ResultsSkeleton() {
  return (
    <div className={GRID} aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

async function SearchContent({ locale, searchParams }: { locale: string; searchParams: Promise<RawParams> }) {
  const t = await getTranslations("Search");
  const state = parseSearchParams(await searchParams);

  const [categories, markets, brands] = await Promise.all([
    safeList<Category>(getCategories),
    safeList<Market>(getMarkets),
    safeList<Brand>(getBrands),
  ]);

  const active = categories.find((c) => c.slug === state.category);
  // Main categories, plus the active one if it is a subcategory.
  const chips = categories.filter((c) => c.parentId === null || c.slug === state.category);
  const heading = state.q ? t("resultsFor", { q: state.q }) : (active?.name ?? t("allProducts"));
  const filterProps = { state, markets, brands };

  return (
    <div className="flex flex-col gap-5">
      <SearchForm locale={locale} state={state} label={t("searchPlaceholder")} button={t("searchButton")} />
      <h1 className="type-h2 break-words text-ink">{heading}</h1>
      {chips.length > 0 && (
        <CategoryChips state={state} categories={chips} label={t("categories")} allLabel={t("allCategories")} />
      )}

      <div className="md:hidden">
        <MobileFilters {...filterProps} />
      </div>
      <ActiveFilters state={state} markets={markets} />

      <div className="flex flex-col gap-5 md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:items-start md:gap-8">
        <aside className="hidden md:block">
          <DesktopFilters {...filterProps} />
        </aside>
        {/* key: a new search shows the skeleton again instead of old results */}
        <Suspense key={searchHref(state)} fallback={<ResultsSkeleton />}>
          <Results state={state} />
        </Suspense>
      </div>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <div className="h-12 animate-pulse rounded-md bg-subtle" />
      <div className="h-9 w-1/2 animate-pulse rounded-sm bg-subtle" />
      <ResultsSkeleton />
    </div>
  );
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Everything that reads the URL waits inside Suspense (needed with Cache Components).
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchContent locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}