"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, Clock, LoaderCircle, ShoppingCart } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
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
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<BargainStatus, string> = {
  AWAITING_SHOP: "bg-info-soft text-verified",
  COUNTERED: "bg-highlight-soft text-highlight",
  ACCEPTED: "bg-success-soft text-success-ink",
  DECLINED: "bg-subtle text-ink-secondary",
  EXPIRED: "bg-error-soft text-error",
};

function clock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Counts down from the server's secondsLeft; red in the last minute; reloads the real state at zero. */
function TimerBar({ seconds, label, onDone }: { seconds: number; label: (time: string) => string; onDone: () => void }) {
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
  return (
    <p
      className={cn(
        "type-body-medium flex items-center gap-2 rounded-sm px-3 py-2",
        urgent ? "bg-error-soft text-error" : "bg-highlight-soft text-highlight",
      )}
    >
      <Clock className={cn("size-4 shrink-0", urgent && "motion-safe:animate-pulse")} aria-hidden />
      <span aria-live={urgent ? "polite" : "off"}>{label(clock(left))}</span>
    </p>
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

/** One negotiation: status, offer history, countdown and the actions allowed right now. */
export function Negotiation({ bargainId, onNewOffer }: { bargainId: string; onNewOffer?: () => void }) {
  const t = useTranslations("Bargain");
  const locale = useLocale();
  const format = useFormatter();
  const queryClient = useQueryClient();
  const counterId = useId();

  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [countering, setCountering] = useState(false);
  const [counterText, setCounterText] = useState("");

  const query = useQuery({
    queryKey: bargainKeys.bargain(bargainId),
    queryFn: () => getBargain(bargainId),
    // While the shop has to answer, check for its reply every 10 seconds.
    refetchInterval: (q) => (q.state.data?.status === "AWAITING_SHOP" ? 10_000 : false),
  });

  function updated(b: Bargain) {
    queryClient.setQueryData(bargainKeys.bargain(bargainId), b);
    void queryClient.invalidateQueries({ queryKey: ["bargains"] });
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

  const b = query.data;
  const events = b.events ?? [];
  const offersMade = events.filter((e) => e.amount !== null).length;
  const lastOwn = [...events].reverse().find((e) => e.actor === "CUSTOMER" && e.amount !== null)?.amount ?? 0;
  const counterMin = lastOwn + 1;
  const counterMax = b.currentOffer - 1;
  const money = (n: number) => formatTaka(n, locale);

  function eventText(e: BargainEvent): string {
    const amount = e.amount !== null ? money(e.amount) : "";
    if (e.actor === "SYSTEM") {
      if (e.note?.startsWith("Accepted automatically")) return t("event.autoAccepted");
      if (e.note === "Offer expired") return t("event.expired");
      if (e.note === "Agreed price expired unused") return t("event.agreedExpired");
      return e.note ?? "";
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

  const timerLabel =
    b.status === "AWAITING_SHOP"
      ? (time: string) => t("timerShop", { time })
      : b.status === "COUNTERED"
        ? (time: string) => t("timerYou", { time })
        : (time: string) => t("timerAgreed", { time });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href={`/products/${b.product.slug}?listing=${b.listing.id}`} className="type-body-medium text-ink hover:text-brand">
          {b.product.title}
        </Link>
        <p className="type-caption text-ink-muted">
          {b.shop.name} · {t("listPrice", { price: money(b.listPrice) })}
        </p>
        <span className={cn("type-caption mt-1 self-start rounded-full px-2.5 py-0.5", STATUS_STYLE[b.status])}>
          {t(`status.${b.status}`)}
          {b.status === "ACCEPTED" && b.agreedPrice !== null && ` · ${money(b.agreedPrice)}`}
        </span>
      </div>

      <ol aria-label={t("feedLabel")} className="flex max-h-56 flex-col gap-3 overflow-y-auto rounded-md border border-line bg-surface p-3">
        {events.map((e) => {
          const time = format.dateTime(new Date(e.createdAt), { hour: "numeric", minute: "2-digit" });
          if (e.actor === "SYSTEM") {
            return (
              <li key={e.id} className="type-caption text-center text-ink-muted">
                {eventText(e)} · {time}
              </li>
            );
          }
          const mine = e.actor === "CUSTOMER";
          return (
            <li key={e.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "flex max-w-[80%] flex-col gap-0.5 rounded-md px-3 py-2",
                  mine ? "bg-success-soft text-ink" : "border border-line bg-card text-ink",
                )}
              >
                <span className="type-body-medium">{eventText(e)}</span>
                <span className="type-caption text-ink-muted">{time}</span>
              </div>
            </li>
          );
        })}
      </ol>

      {(b.status === "AWAITING_SHOP" || b.status === "COUNTERED" || b.status === "ACCEPTED") && b.secondsLeft > 0 && (
        // key: a fresh server value restarts the countdown
        <TimerBar key={query.dataUpdatedAt} seconds={b.secondsLeft} label={timerLabel} onDone={() => void query.refetch()} />
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

      {/* The shop countered: the customer's turn */}
      {b.status === "COUNTERED" && b.yourTurn && !countering && (
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

      {b.status === "COUNTERED" && b.yourTurn && countering && (
        <form onSubmit={onCounter} noValidate className="flex flex-col gap-2 rounded-md border border-line p-3">
          <label htmlFor={counterId} className="type-body-medium text-ink">
            {t("counterLabel")}
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
            {t("counterRange", { min: money(lastOwn), max: money(b.currentOffer) })}
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

      {/* Waiting for the shop: the customer may withdraw */}
      {b.status === "AWAITING_SHOP" && (
        <button type="button" onClick={() => decline.mutate()} disabled={busy} className={outline("error")}>
          {decline.isPending && <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden />}
          {t("withdraw")}
        </button>
      )}

      {/* Agreed: one unit at this price into the cart */}
      {b.status === "ACCEPTED" && b.agreedPrice !== null && (
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => toCart.mutate()} disabled={busy} aria-busy={toCart.isPending} className={primary}>
            {toCart.isPending ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <ShoppingCart className="size-5" aria-hidden />}
            {t("addToCart", { amount: money(b.agreedPrice) })}
          </button>
          <p className="type-caption text-ink-muted">{t("agreedNote")}</p>
        </div>
      )}

      {(b.status === "DECLINED" || b.status === "EXPIRED") && onNewOffer && (
        <button type="button" onClick={onNewOffer} className={outline("ink")}>
          {t("newOffer")}
        </button>
      )}
    </div>
  );
}