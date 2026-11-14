"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, Clock, LoaderCircle, ShoppingCart } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
import { CART_LANDED_EVENT } from "@/components/cart/cart-badge";
import { Link } from "@/i18n/routing";
import {
  acceptBargain,
  bargainKeys,
  bargainToCart,
  counterBargain,
  declineBargain,
  getBargain,
  MAX_OFFERS,
  parseAmount,
  type Bargain,
  type BargainEvent,
  type BargainStatus,
} from "@/lib/api/bargains";
import { cartKeys } from "@/lib/api/cart";
import { ApiError } from "@/lib/api/core";
import type { ShopBargain } from "@/lib/api/owner";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

type Side = "CUSTOMER" | "SHOP";

const STATUS_STYLE: Record<BargainStatus, string> = {
  AWAITING_SHOP: "bg-info-soft text-verified",
  COUNTERED: "bg-highlight-soft text-highlight",
  ACCEPTED: "bg-success-soft text-success-ink",
  DECLINED: "bg-subtle text-ink-secondary",
  EXPIRED: "bg-error-soft text-error",
};

const ACTIVE: BargainStatus[] = ["AWAITING_SHOP", "COUNTERED"];

function clock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const AMBER_BELOW = 300; // seconds: the bar turns amber in the last 5 minutes, red in the last minute

/**
 * Counts down from the server's secondsLeft; reloads the real state at zero.
 * The thin bar empties smoothly (scaleX), gold, then amber, then red with a gentle pulse in the last minute.
 * `total` is the whole reply window, so the bar keeps its place when fresh data arrives.
 */
function TimerBar({
  seconds,
  total,
  label,
  onDone,
}: {
  seconds: number;
  total: number;
  label: (time: string) => string;
  onDone: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const left = Math.max(0, seconds - elapsed);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  useEffect(() => {
    if (seconds > 0 && left === 0) onDone();
  }, [left, seconds, onDone]);

  const urgent = left < 60;
  const amber = !urgent && left < AMBER_BELOW;
  const share = Math.min(1, left / Math.max(total, seconds, 1));
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-sm",
        urgent ? "bg-error-soft text-error" : "bg-highlight-soft text-highlight",
      )}
    >
      <p className="type-body-medium flex items-center gap-2 px-3 py-2">
        <Clock className={cn("size-4 shrink-0", urgent && "motion-safe:animate-pulse")} aria-hidden />
        <span aria-live={urgent ? "polite" : "off"}>{label(clock(left))}</span>
      </p>
      {/* Decorative: the text above already says the time. Three stacked colours cross-fade (opacity only). */}
      <div aria-hidden className={cn("h-1 w-full", urgent && "timer-urgent")}>
        <div className="timer-fill relative h-full" style={{ transform: `scaleX(${share})` }}>
          <span className={cn("absolute inset-0 bg-gold", (amber || urgent) && "opacity-0")} />
          <span className={cn("absolute inset-0 bg-warning", !amber && "opacity-0")} />
          <span className={cn("absolute inset-0 bg-error", !urgent && "opacity-0")} />
        </div>
      </div>
    </div>
  );
}

function errorKey(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400) return "errors.range";
    if (err.status === 0) return "errors.network";
  }
  return "errors.generic";
}

const primary =
  "type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60";
const outline = (tone: "error" | "ink") =>
  cn(
    "type-body-medium flex h-12 items-center justify-center rounded-sm border px-4 hover:bg-subtle focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
    tone === "error" ? "border-error text-error focus-visible:ring-error" : "border-ink text-ink focus-visible:ring-brand",
  );

/**
 * One negotiation: status, offer history, countdown and the actions allowed right now.
 * side="CUSTOMER" (default): the buyer's view. side="SHOP": the shop team's mirrored view.
 */
export function Negotiation({
  bargainId,
  onNewOffer,
  side = "CUSTOMER",
}: {
  bargainId: string;
  onNewOffer?: () => void;
  side?: Side;
}) {
  const t = useTranslations("Bargain");
  const tShop = useTranslations("OwnerBargains.negotiation");
  const tShopStatus = useTranslations("OwnerBargains");
  const locale = useLocale();
  const format = useFormatter();
  const queryClient = useQueryClient();
  const counterId = useId();
  const isShop = side === "SHOP";

  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [countering, setCountering] = useState(false);
  const [counterText, setCounterText] = useState("");
  // How many messages were there when the feed first showed: only later ones slide in.
  const [seenCount, setSeenCount] = useState<number | null>(null);

  const query = useQuery({
    queryKey: bargainKeys.bargain(bargainId),
    queryFn: () => getBargain(bargainId),
    // While the other side has to answer, check for their reply every 10 seconds.
    refetchInterval: (q) => {
      const data = q.state.data;
      return data && ACTIVE.includes(data.status) && !data.yourTurn ? 10_000 : false;
    },
  });

  function updated(b: Bargain) {
    queryClient.setQueryData(bargainKeys.bargain(bargainId), b);
    void queryClient.invalidateQueries({ queryKey: ["bargains"] });
    void queryClient.invalidateQueries({ queryKey: ["owner", "bargains"] });
    setMessage(null);
    setCountering(false);
    setCounterText("");
  }

  function failed(err: unknown) {
    if (err instanceof ApiError && err.status === 409) {
      // The other side acted first, or time ran out: show the real state.
      void query.refetch();
      setMessage({ kind: "error", text: t("errors.closed") });
      return;
    }
    setMessage({ kind: "error", text: t(errorKey(err)) });
  }

  const accept = useMutation({ mutationFn: () => acceptBargain(bargainId), onSuccess: updated, onError: failed });
  const decline = useMutation({ mutationFn: () => declineBargain(bargainId), onSuccess: updated, onError: failed });
  const counter = useMutation({ mutationFn: (amount: number) => counterBargain(bargainId, amount), onSuccess: updated, onError: failed });
  const toCart = useMutation({
    mutationFn: () => bargainToCart(bargainId),
    onSuccess: (cart) => {
      queryClient.setQueryData(cartKeys.cart, cart); // the cart badge updates at once
      window.dispatchEvent(new Event(CART_LANDED_EVENT)); // ...and bounces
      setMessage({ kind: "ok", text: t("addedToCart") });
    },
    onError: failed,
  });
  const busy = accept.isPending || decline.isPending || counter.isPending || toCart.isPending;

  if (query.isPending) {
    return (
      <p role="status" className="type-body flex items-center justify-center gap-2 py-8 text-ink-secondary">
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
        {t("loading")}
      </p>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="type-body text-ink-secondary">{notFound ? t("notFound") : t("loadError")}</p>
        {!notFound && (
          <button type="button" onClick={() => query.refetch()} className={outline("ink")}>
            {t("retry")}
          </button>
        )}
      </div>
    );
  }

  const b = query.data as ShopBargain;
  const events = b.events ?? [];
  if (seenCount === null) setSeenCount(events.length);
  const firstNew = seenCount ?? events.length;

  // Whole reply window = from the last message to the deadline (for the timer bar).
  const lastEventAt = events.length > 0 ? new Date(events[events.length - 1].createdAt).getTime() : NaN;
  const windowSeconds = Math.round((new Date(b.expiresAt).getTime() - lastEventAt) / 1000);
  const timerTotal = Number.isFinite(windowSeconds) && windowSeconds > 0 ? windowSeconds : b.secondsLeft;
  const offersMade = events.filter((e) => e.amount !== null).length;
  const money = (n: number) => formatTaka(n, locale);

  // Counter range: the customer goes above their own last offer and below the shop's counter;
  // the shop goes above the customer's offer and below the list price.
  const lastCustomer = [...events].reverse().find((e) => e.actor === "CUSTOMER" && e.amount !== null)?.amount ?? 0;
  const counterMin = isShop ? b.currentOffer + 1 : lastCustomer + 1;
  const counterMax = isShop ? b.listPrice - 1 : b.currentOffer - 1;
  const rangeLow = isShop ? b.currentOffer : lastCustomer;
  const rangeHigh = isShop ? b.listPrice : b.currentOffer;

  function eventText(e: BargainEvent): string {
    const amount = e.amount !== null ? money(e.amount) : "";
    if (e.actor === "SYSTEM") {
      if (e.note?.startsWith("Accepted automatically")) return t("event.autoAccepted");
      if (e.note === "Offer expired") return t("event.expired");
      if (e.note === "Agreed price expired unused") return t("event.agreedExpired");
      return e.note ?? "";
    }
    if (isShop) {
      if (e.actor === "CUSTOMER") {
        if (e.note === "Accepted") return tShop("customerAccepted", { amount });
        if (e.note === "Withdrawn") return tShop("customerWithdrew");
        if (e.note === "Declined") return tShop("customerDeclined");
        return tShop("customerOffered", { amount });
      }
      if (e.note === "Accepted") return tShop("youAccepted", { amount });
      if (e.note === "Declined") return tShop("youDeclined");
      return tShop("youCountered", { amount });
    }
    if (e.actor === "CUSTOMER") {
      if (e.note === "Accepted") return t("event.youAccepted", { amount });
      if (e.note === "Withdrawn") return t("event.youWithdrew");
      if (e.note === "Declined") return t("event.youDeclined");
      return t("event.youOffered", { amount });
    }
    if (e.note === "Accepted") return t("event.shopAccepted", { amount });
    if (e.note === "Declined") return t("event.shopDeclined");
    return t("event.shopCountered", { amount });
  }

  function onCounter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseAmount(counterText);
    if (amount === null || amount < counterMin || amount > counterMax) {
      setMessage({ kind: "error", text: t("errors.range") });
      return;
    }
    counter.mutate(amount);
  }

  const timerLabel = (time: string) => {
    if (b.status === "ACCEPTED") return isShop ? tShop("timerAgreed", { time }) : t("timerAgreed", { time });
    if (b.yourTurn) return isShop ? tShop("timerYou", { time }) : t("timerYou", { time });
    return isShop ? tShop("timerCustomer", { time }) : t("timerShop", { time });
  };

  const statusText = isShop ? tShopStatus(`status.${b.status}`) : t(`status.${b.status}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href={`/products/${b.product.slug}?listing=${b.listing.id}`} className="type-body-medium text-ink hover:text-brand">
          {b.product.title}
        </Link>
        <p className="type-caption text-ink-muted">
          {isShop && b.customer ? tShop("customer", { name: b.customer.name }) : b.shop.name} ·{" "}
          {t("listPrice", { price: money(b.listPrice) })}
        </p>
        <span className={cn("type-caption mt-1 self-start rounded-full px-2.5 py-0.5", STATUS_STYLE[b.status])}>
          {statusText}
          {b.status === "ACCEPTED" && b.agreedPrice !== null && ` · ${money(b.agreedPrice)}`}
        </span>
      </div>

      <ol aria-label={t("feedLabel")} className="flex max-h-56 flex-col gap-3 overflow-x-hidden overflow-y-auto rounded-md border border-line bg-surface p-3">
        {events.map((e, index) => {
          const isNew = index >= firstNew;
          const time = format.dateTime(new Date(e.createdAt), { hour: "numeric", minute: "2-digit" });
          if (e.actor === "SYSTEM") {
            return (
              <li key={e.id} className="type-caption text-center text-ink-muted">
                {eventText(e)} · {time}
              </li>
            );
          }
          // Your own messages on the right, the other side's on the left.
          const mine = e.actor === side;
          return (
            <li key={e.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "flex max-w-[80%] flex-col gap-0.5 rounded-md px-3 py-2",
                  mine ? "bg-success-soft text-ink" : "border border-line bg-card text-ink",
                  // A new offer slides in from its own side with a soft gold flash (once).
                  isNew && (mine ? "offer-in-right" : "offer-in-left"),
                )}
              >
                <span className="type-body-medium">{eventText(e)}</span>
                <span className="type-caption text-ink-muted">{time}</span>
              </div>
            </li>
          );
        })}
      </ol>

      {(ACTIVE.includes(b.status) || b.status === "ACCEPTED") && b.secondsLeft > 0 && (
        // key: a fresh server value restarts the countdown
        <TimerBar
          key={query.dataUpdatedAt}
          seconds={b.secondsLeft}
          total={timerTotal}
          label={timerLabel}
          onDone={() => void query.refetch()}
        />
      )}

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={cn("type-body flex items-start gap-2", message.kind === "error" ? "text-error" : "text-success-ink")}
        >
          {message.kind === "error" ? (
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          {message.text}
          {message.kind === "ok" && (
            <Link href="/cart" className="type-body-medium text-brand underline-offset-4 hover:underline">
              {t("viewCart")}
            </Link>
          )}
        </p>
      )}

      {/* Your turn (customer after a counter, shop after an offer): decline, counter or accept */}
      {ACTIVE.includes(b.status) && b.yourTurn && !countering && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2">
            <button type="button" onClick={() => decline.mutate()} disabled={busy} className={outline("error")}>
              {t("decline")}
            </button>
            <button type="button" onClick={() => setCountering(true)} disabled={busy || offersMade >= MAX_OFFERS} className={outline("ink")}>
              {t("counter")}
            </button>
            <button type="button" onClick={() => accept.mutate()} disabled={busy} aria-busy={accept.isPending} className={primary}>
              {accept.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {t("accept", { amount: money(b.currentOffer) })}
            </button>
          </div>
          {offersMade >= MAX_OFFERS && <p className="type-caption text-ink-muted">{t("maxOffers")}</p>}
        </div>
      )}

      {ACTIVE.includes(b.status) && b.yourTurn && countering && (
        <form onSubmit={onCounter} noValidate className="flex flex-col gap-2 rounded-md border border-line p-3">
          <label htmlFor={counterId} className="type-body-medium text-ink">
            {isShop ? tShop("counterLabel") : t("counterLabel")}
          </label>
          <input
            id={counterId}
            type="text"
            inputMode="numeric"
            maxLength={12}
            value={counterText}
            onChange={(e) => setCounterText(e.target.value)}
            aria-describedby={`${counterId}-range`}
            className="type-price h-12 w-full rounded-md border border-input bg-card px-3 text-[1.25rem] text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
          />
          <p id={`${counterId}-range`} className="type-caption text-ink-muted">
            {isShop
              ? tShop("counterRange", { min: money(rangeLow), max: money(rangeHigh) })
              : t("counterRange", { min: money(rangeLow), max: money(rangeHigh) })}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setCountering(false)} disabled={busy} className={outline("ink")}>
              {t("cancel")}
            </button>
            <button type="submit" disabled={busy} aria-busy={counter.isPending} className={primary}>
              {counter.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {t("sendCounter")}
            </button>
          </div>
        </form>
      )}

      {/* Waiting for the other side: the customer may withdraw; the shop just waits */}
      {ACTIVE.includes(b.status) && !b.yourTurn && !isShop && (
        <button type="button" onClick={() => decline.mutate()} disabled={busy} className={outline("error")}>
          {decline.isPending && <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden />}
          {t("withdraw")}
        </button>
      )}
      {ACTIVE.includes(b.status) && !b.yourTurn && isShop && (
        <p className="type-caption text-ink-muted">{tShop("waitingCustomer")}</p>
      )}

      {/* Agreed: the customer adds one unit to the cart; the shop just sees the result */}
      {b.status === "ACCEPTED" && b.agreedPrice !== null && !isShop && (
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => toCart.mutate()} disabled={busy} aria-busy={toCart.isPending} className={primary}>
            {toCart.isPending ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <ShoppingCart className="size-5" aria-hidden />}
            {t("addToCart", { amount: money(b.agreedPrice) })}
          </button>
          <p className="type-caption text-ink-muted">{t("agreedNote")}</p>
        </div>
      )}
      {b.status === "ACCEPTED" && isShop && <p className="type-caption text-ink-muted">{tShop("agreedNote")}</p>}

      {(b.status === "DECLINED" || b.status === "EXPIRED") && onNewOffer && !isShop && (
        <button type="button" onClick={onNewOffer} className={outline("ink")}>
          {t("newOffer")}
        </button>
      )}
    </div>
  );
}