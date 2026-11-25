"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, Clock, LoaderCircle, Truck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { AreaPicker, type AreaValue } from "@/components/delivery/area-picker";
import type { AdminShop } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/core";
import { createCourierStore, errorCode, type CourierCode } from "@/lib/api/delivery";

const COURIER_NAME: Record<CourierCode, string> = { PATHAO: "Pathao", STEADFAST: "Steadfast", REDX: "RedX", PAPERFLY: "Paperfly", ECOURIER: "eCourier" };
type Result = { provider: CourierCode; courierStoreId: string | null; state: "READY" | "PENDING_APPROVAL" };

/**
 * Creates the shop's pickup store at the default courier (Pathao now), or fetches its id once the
 * courier has approved it. The pickup area is asked for only when the courier has no store yet.
 */
export function CourierStore({ shopId, saved, onChanged }: { shopId: string; saved?: AdminShop; onChanged: () => void }) {
  const t = useTranslations("AdminShops.courier");
  const format = useFormatter();
  const [needsArea, setNeedsArea] = useState(false);
  const [loc, setLoc] = useState<AreaValue>({ city: null, zone: null, area: null });
  const [areaError, setAreaError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const create = useMutation({
    mutationFn: (where?: { courierCityId: number; courierZoneId: number; courierAreaId: number }) => createCourierStore(shopId, where),
    onMutate: () => setError(null),
    onSuccess: (r) => {
      setResult(r);
      setNeedsArea(false);
      onChanged();
    },
    onError: (err) => {
      const code = err instanceof ApiError ? errorCode(err.details) : null;
      if (code === "LOCATION_REQUIRED") return setNeedsArea(true);
      if (code === "SHOP_PHONE_MISSING") return setError(t("errors.phone"));
      if (err instanceof ApiError && err.status === 400) return setError(t("errors.area"));
      if (err instanceof ApiError && err.status >= 500) return setError(t("errors.courier"));
      setError(err instanceof ApiError && err.status === 0 ? t("errors.network") : t("errors.generic"));
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!loc.city || !loc.zone || !loc.area) return setAreaError(t("errors.pickArea"));
    setAreaError(undefined);
    create.mutate({ courierCityId: loc.city, courierZoneId: loc.zone, courierAreaId: loc.area });
  }

  const name = result ? COURIER_NAME[result.provider] : null;
  // What the server has saved (shown until this panel gets a fresh answer).
  const savedState = saved?.courierStoreState ?? "NONE";
  const ready = result ? result.state === "READY" : savedState === "READY";
  const where = saved?.courierStoreLocation;
  const savedLine = result
    ? null
    : savedState === "READY"
      ? t("savedReady", { id: saved?.courierStoreId ?? "" })
      : savedState === "PENDING_APPROVAL"
        ? t("savedPending", {
            date: saved?.courierStoreRequestedAt ? format.dateTime(new Date(saved.courierStoreRequestedAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—",
          })
        : null;

  return (
    <section aria-label={t("title")} className="flex flex-col gap-3 rounded-md bg-surface p-3">
      <p className="type-caption text-ink-secondary">{t("hint")}</p>

      {savedLine && (
        <p className={`type-body flex items-start gap-2 ${savedState === "READY" ? "text-success-ink" : "text-highlight"}`}>
          {savedState === "READY" ? <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {savedLine}
        </p>
      )}
      {where && !result && (
        // Courier names from the courier's own lists: plain text
        <p className="type-caption text-ink-muted">{t("pickupAt", { area: [where.areaName, where.zoneName, where.cityName].join(", ") })}</p>
      )}

      {result && (
        <p role="status" className={`type-body flex items-start gap-2 ${result.state === "READY" ? "text-success-ink" : "text-highlight"}`}>
          {result.state === "READY" ? <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {result.state === "READY" ? t("ready", { name: name ?? "", id: result.courierStoreId ?? "" }) : t("pending", { name: name ?? "" })}
        </p>
      )}

      {needsArea ? (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
          <AreaPicker value={loc} onChange={setLoc} error={areaError} legend={t("areaLegend")} hint={t("areaHint")} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={create.isPending} aria-busy={create.isPending} className="type-body-medium flex h-11 items-center gap-2 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60">
              {create.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Truck className="size-4" aria-hidden />}
              {t("create")}
            </button>
            <button type="button" onClick={() => setNeedsArea(false)} disabled={create.isPending} className="type-body-medium h-11 rounded-sm px-3 text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
              {t("cancel")}
            </button>
          </div>
        </form>
      ) : (
        !ready && (
          <button type="button" onClick={() => create.mutate(undefined)} disabled={create.isPending} aria-busy={create.isPending} className="type-body-medium flex h-11 items-center gap-2 self-start rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60">
            {create.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Truck className="size-4" aria-hidden />}
            {result || savedState === "PENDING_APPROVAL" ? t("checkAgain") : t("start")}
          </button>
        )
      )}

      {error && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </section>
  );
}
