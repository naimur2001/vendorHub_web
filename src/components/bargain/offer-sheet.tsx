"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { useSession } from "@/components/app-providers";
import { Negotiation } from "@/components/bargain/negotiation";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/routing";
import { bargainKeys, createBargain, getBargainInfo, parseAmount, type Bargain, type BargainInfo } from "@/lib/api/bargains";
import { ApiError } from "@/lib/api/core";
import { formatTaka } from "@/lib/format";

const triggerClass =
  "type-body-medium flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-highlight px-4 text-highlight hover:bg-highlight-soft focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-none";

// Slider step: coarse for big prices, fine for small ones (the field takes any exact amount).
const stepFor = (price: number) => (price >= 10_000 ? 50 : price >= 1_000 ? 10 : 1);

function offerErrorKey(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400 && /own shop/i.test(err.message)) return "errors.ownShop";
    if (err.status === 400) return "errors.range";
    if (err.status === 409 && /out of stock/i.test(err.message)) return "errors.outOfStock";
    if (err.status === 409) return "errors.notAccepting";
    if (err.status === 0) return "errors.network";
  }
  return "errors.generic";
}

function NewOfferForm({
  info,
  onCreated,
  onExisting,
}: {
  info: BargainInfo;
  onCreated: (b: Bargain) => void;
  onExisting: (id: string) => void;
}) {
  const t = useTranslations("Bargain");
  const locale = useLocale();
  const id = useId();
  const step = stepFor(info.listPrice);
  const start = Math.min(info.maxOffer, Math.max(info.minOffer, Math.round((info.listPrice * 0.9) / step) * step));

  const [amount, setAmount] = useState(start);
  const [text, setText] = useState(String(start));
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (offer: number) => createBargain(info.listingId, offer),
    onSuccess: onCreated,
    onError: (err) => {
      // Already negotiating this item: open that negotiation instead.
      const details = err instanceof ApiError ? (err.details as { bargainId?: unknown } | undefined) : undefined;
      if (err instanceof ApiError && err.status === 409 && typeof details?.bargainId === "string") {
        onExisting(details.bargainId);
        return;
      }
      setError(t(offerErrorKey(err)));
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = parseAmount(text);
    if (value === null || value < info.minOffer || value > info.maxOffer) {
      setError(t("errors.range"));
      return;
    }
    setError(null);
    create.mutate(value);
  }

  const typed = parseAmount(text);
  const percent = Math.max(0, Math.round((1 - amount / info.listPrice) * 100));
  const money = (n: number) => formatTaka(n, locale);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="type-body text-ink-secondary">{t("listed", { price: money(info.listPrice) })}</p>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-amount`} className="type-body-medium text-ink">
          {t("yourOffer")}
        </label>
        <input
          id={`${id}-amount`}
          type="text"
          inputMode="numeric"
          maxLength={12}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const v = parseAmount(e.target.value);
            if (v !== null && v >= info.minOffer && v <= info.maxOffer) setAmount(v);
          }}
          aria-describedby={`${id}-range`}
          aria-invalid={error ? true : undefined}
          className="type-price h-14 w-full rounded-md border border-input bg-card px-3 text-[1.5rem] text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none aria-invalid:border-error"
        />
        <input
          type="range"
          min={info.minOffer}
          max={info.maxOffer}
          step={step}
          value={amount}
          onChange={(e) => {
            const v = Number(e.target.value);
            setAmount(v);
            setText(String(v));
          }}
          aria-label={t("yourOffer")}
          aria-valuetext={money(amount)}
          className="h-11 w-full accent-brand"
        />
        <div className="type-caption flex justify-between text-ink-muted">
          <span>{money(info.minOffer)}</span>
          <span>{money(info.maxOffer)}</span>
        </div>
        <p id={`${id}-range`} className="type-caption text-ink-muted">
          {t("offerRange", { min: money(info.minOffer), max: money(info.maxOffer) })} · {t("belowList", { percent })}
        </p>
      </div>

      <p className="type-caption rounded-sm bg-info-soft px-3 py-2 text-verified">
        {t("replyWindow", { minutes: info.responseWindowMinutes })}
      </p>

      {error && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={create.isPending}
        aria-busy={create.isPending}
        className="type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
      >
        {create.isPending && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
        {create.isPending ? t("sending") : t("sendOffer", { amount: money(typed ?? amount) })}
      </button>
    </form>
  );
}

/** Inside the sheet: an open negotiation for this item, or the new-offer form. */
function OfferPanel({ listingId }: { listingId: string }) {
  const t = useTranslations("Bargain");
  const queryClient = useQueryClient();
  const [bargainId, setBargainId] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);

  const info = useQuery({ queryKey: bargainKeys.info(listingId), queryFn: () => getBargainInfo(listingId) });

  if (info.isPending) {
    return (
      <p role="status" className="type-body flex items-center justify-center gap-2 py-8 text-ink-secondary">
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
        {t("loading")}
      </p>
    );
  }
  if (info.isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => info.refetch()} className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand">
          {t("retry")}
        </button>
      </div>
    );
  }

  const openId = bargainId ?? (fresh ? null : (info.data.activeBargain?.id ?? null));
  if (openId) {
    return (
      <Negotiation
        bargainId={openId}
        onNewOffer={() => {
          setBargainId(null);
          setFresh(true);
          void queryClient.invalidateQueries({ queryKey: bargainKeys.info(listingId) });
        }}
      />
    );
  }

  if (!info.data.bargainEnabled) return <p className="type-body py-6 text-ink-secondary">{t("notAccepting")}</p>;

  return (
    <NewOfferForm
      info={info.data}
      onCreated={(b) => {
        queryClient.setQueryData(bargainKeys.bargain(b.id), b);
        void queryClient.invalidateQueries({ queryKey: ["bargains"] });
        setBargainId(b.id);
      }}
      onExisting={(id) => setBargainId(id)}
    />
  );
}

/** "Make an offer" on the product page: guests log in first; others open the offer sheet. */
export function MakeOfferButton({ listingId, productSlug }: { listingId: string; productSlug: string }) {
  const t = useTranslations("Bargain");
  const { status } = useSession();
  const [open, setOpen] = useState(false);

  if (status !== "authenticated") {
    return (
      <Link
        href={`/auth/login?next=${encodeURIComponent(`/products/${productSlug}?listing=${listingId}`)}`}
        aria-disabled={status === "loading"}
        className={triggerClass}
      >
        <span aria-hidden>🤝</span>
        {t("loginToOffer")}
      </Link>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={triggerClass}>
        <span aria-hidden>🤝</span>
        {t("makeOffer")}
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-lg bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mx-auto flex w-full max-w-lg flex-col">
          <SheetHeader>
            <SheetTitle className="type-h3 text-ink">{t("sheetTitle")}</SheetTitle>
            <SheetDescription className="type-body text-ink-secondary">{t("sheetText")}</SheetDescription>
          </SheetHeader>
          <div className="px-4">{open && <OfferPanel listingId={listingId} />}</div>
        </div>
      </SheetContent>
    </Sheet>
  );
}