"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, LoaderCircle, MapPinned, Star, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/core";
import {
  deliveryKeys,
  errorCode,
  listCities,
  listCouriers,
  listDeliveryZones,
  updateCourier,
  updateDeliveryZone,
  type CourierProvider,
  type DeliveryZone,
} from "@/lib/api/delivery";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";

const outline = "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60";
const solid = "type-body-medium inline-flex h-11 items-center justify-center gap-1.5 rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60";
const field = "type-body h-11 w-full rounded-sm border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";
const card = "flex flex-col gap-4 rounded-md border border-line bg-card p-4 shadow-card md:p-5";

function useErrorText() {
  const t = useTranslations("AdminDelivery");
  return (err: unknown) => {
    if (err instanceof ApiError) {
      const code = errorCode(err.details);
      if (code === "DEFAULT_MUST_BE_ACTIVE" || code === "DEFAULT_REQUIRED") return t(`errors.${code}`);
      if (err.status === 0) return t("errors.network");
      if (err.status === 400) return t("errors.check");
    }
    return t("errors.generic");
  };
}

/** Admin: which courier companies are switched on (one default), and what customers pay per zone. */
export function DeliverySettings() {
  const t = useTranslations("AdminDelivery");
  const couriers = useQuery({ queryKey: deliveryKeys.couriers, queryFn: listCouriers });
  const zones = useQuery({ queryKey: deliveryKeys.zones, queryFn: listDeliveryZones });

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="couriers-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="couriers-title" className="type-h2 flex items-center gap-2 text-ink">
            <Truck className="size-6 text-highlight" aria-hidden />
            {t("couriersTitle")}
          </h2>
          <p className="type-body text-ink-secondary">{t("couriersText")}</p>
        </div>
        {couriers.isPending ? (
          <div className="h-40 skeleton relative overflow-hidden rounded-md" aria-hidden />
        ) : couriers.isError ? (
          <Retry onRetry={() => couriers.refetch()} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {couriers.data.map((c) => (
              <li key={c.id}>
                <CourierCard c={c} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="zones-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="zones-title" className="type-h2 flex items-center gap-2 text-ink">
            <MapPinned className="size-6 text-highlight" aria-hidden />
            {t("zonesTitle")}
          </h2>
          <p className="type-body text-ink-secondary">{t("zonesText")}</p>
        </div>
        {zones.isPending ? (
          <div className="h-40 skeleton relative overflow-hidden rounded-md" aria-hidden />
        ) : zones.isError ? (
          <Retry onRetry={() => zones.refetch()} />
        ) : zones.data.length === 0 ? (
          <p className="type-body rounded-md border border-dashed border-line-strong p-6 text-center text-ink-secondary">{t("zonesEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {zones.data.map((z) => (
              <li key={z.id}>
                <ZoneCard z={z} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Retry({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("AdminDelivery");
  return (
    <div role="alert" className="flex items-center gap-3">
      <p className="type-body text-ink-secondary">{t("loadError")}</p>
      <button type="button" onClick={onRetry} className={outline}>{t("retry")}</button>
    </div>
  );
}

function CourierCard({ c }: { c: CourierProvider }) {
  const t = useTranslations("AdminDelivery");
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const save = useMutation({
    mutationFn: (patch: Parameters<typeof updateCourier>[1]) => updateCourier(c.id, patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: deliveryKeys.couriers }),
  });
  const isPathao = c.code === "PATHAO";

  return (
    <article className={cn(card, c.isDefault && "border-gold")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="type-h3 flex items-center gap-2 text-ink">
            {c.name}
            {c.isDefault && (
              <span className="type-caption inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 font-medium text-ink">
                <Star className="size-3" aria-hidden />
                {t("default")}
              </span>
            )}
          </h3>
          <span className="type-caption flex flex-wrap gap-2">
            <span className={cn("rounded-full px-2 py-0.5", c.isActive ? "bg-success-soft text-success-ink" : "bg-subtle text-ink-secondary")}>{c.isActive ? t("on") : t("off")}</span>
            {c.sandbox && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-warning">{t("sandbox")}</span>}
            {!isPathao && <span className="rounded-full bg-subtle px-2 py-0.5 text-ink-secondary">{t("comingSoon")}</span>}
          </span>
        </div>
        {save.isPending && <LoaderCircle className="size-5 animate-spin text-ink-muted" aria-label={t("saving")} />}
      </div>

      {isPathao ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => save.mutate({ isActive: !c.isActive })} disabled={save.isPending} className={outline}>
            {c.isActive ? t("switchOff") : t("switchOn")}
          </button>
          {!c.isDefault && (
            <button type="button" onClick={() => save.mutate({ isDefault: true })} disabled={save.isPending || !c.isActive} className={outline}>
              {t("makeDefault")}
            </button>
          )}
          <button type="button" onClick={() => save.mutate({ sandbox: !c.sandbox })} disabled={save.isPending} className={outline}>
            {c.sandbox ? t("goLive") : t("useSandbox")}
          </button>
        </div>
      ) : (
        <p className="type-caption text-ink-muted">{t("notConnected")}</p>
      )}
      {save.isError && <p role="alert" className="type-body text-error">{errorText(save.error)}</p>}
    </article>
  );
}

function ZoneCard({ z }: { z: DeliveryZone }) {
  const t = useTranslations("AdminDelivery");
  const locale = useLocale();
  const uid = useId();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState({ name: z.name, fee: String(z.customerFee), eta: z.etaText, cities: z.courierCityIds });
  const cities = useQuery({ queryKey: deliveryKeys.cities, queryFn: listCities, staleTime: 60 * 60_000, enabled: editing || z.courierCityIds.length > 0 });
  const cityName = (id: number) => cities.data?.find((c) => c.id === id)?.name ?? `#${id}`;

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof updateDeliveryZone>[1]) => updateDeliveryZone(z.id, patch),
    onSuccess: () => {
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.zones });
    },
  });
  const fee = Number(v.fee);
  const valid = v.name.trim().length >= 2 && Number.isInteger(fee) && fee >= 0 && fee <= 5000 && v.eta.trim().length >= 2;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (valid) save.mutate({ name: v.name.trim(), customerFee: fee, etaText: v.eta.trim(), courierCityIds: v.cities });
  }

  return (
    <article className={cn(card, !z.isActive && "opacity-70")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="type-h3 text-ink">{z.name}</h3>
          <span className="type-caption text-ink-muted">{t(`zoneCode.${z.code}`)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="type-price text-brand">{formatTaka(z.customerFee, locale)}</span>
          <span className="type-caption text-ink-secondary">{z.etaText}</span>
        </div>
      </div>
      {!editing && (
        <p className="type-caption text-ink-secondary">
          {z.courierCityIds.length ? t("citiesList", { cities: z.courierCityIds.map(cityName).join(", ") }) : z.code === "OUTSIDE_DHAKA" ? t("citiesRest") : t("citiesNone")}
          {z.courierZoneIds.length > 0 && ` · ${t("zoneIds", { count: z.courierZoneIds.length })}`}
        </p>
      )}

      {editing ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label htmlFor={`${uid}-n`} className="flex flex-col gap-1">
              <span className="type-body-medium text-ink">{t("name")}</span>
              <input id={`${uid}-n`} value={v.name} maxLength={60} onChange={(e) => setV({ ...v, name: e.target.value })} className={field} />
            </label>
            <label htmlFor={`${uid}-f`} className="flex flex-col gap-1">
              <span className="type-body-medium text-ink">{t("fee")}</span>
              <input id={`${uid}-f`} value={v.fee} inputMode="numeric" onChange={(e) => setV({ ...v, fee: e.target.value.replace(/\D/g, "") })} className={field} />
            </label>
            <label htmlFor={`${uid}-e`} className="flex flex-col gap-1">
              <span className="type-body-medium text-ink">{t("eta")}</span>
              <input id={`${uid}-e`} value={v.eta} maxLength={40} placeholder={t("etaPlaceholder")} onChange={(e) => setV({ ...v, eta: e.target.value })} className={field} />
            </label>
          </div>
          {z.code !== "OUTSIDE_DHAKA" && (
            <fieldset className="flex flex-col gap-2">
              <legend className="type-body-medium text-ink">{t("cities")}</legend>
              <p className="type-caption text-ink-muted">{t("citiesHint")}</p>
              {cities.isPending ? (
                <div className="h-11 skeleton relative overflow-hidden rounded-sm" aria-hidden />
              ) : (
                <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                  {(cities.data ?? []).map((c) => {
                    const on = v.cities.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setV({ ...v, cities: on ? v.cities.filter((x) => x !== c.id) : [...v.cities, c.id] })}
                        className={cn("type-body inline-flex h-11 items-center gap-1 rounded-full border px-3 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none", on ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-card text-ink hover:border-brand")}
                      >
                        {on && <Check className="size-4" aria-hidden />}
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!valid || save.isPending} className={solid}>{save.isPending ? t("saving") : t("save")}</button>
            <button type="button" onClick={() => { setEditing(false); setV({ name: z.name, fee: String(z.customerFee), eta: z.etaText, cities: z.courierCityIds }); }} className="type-body-medium h-11 rounded-sm px-4 text-ink-secondary hover:bg-subtle">{t("cancel")}</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing(true)} className={outline}>{t("edit")}</button>
          <button type="button" onClick={() => save.mutate({ isActive: !z.isActive })} disabled={save.isPending} className={cn(outline, z.isActive && "border-error text-error hover:bg-error-soft")}>
            {z.isActive ? t("zoneOff") : t("zoneOn")}
          </button>
        </div>
      )}
      {!z.isActive && <p className="type-caption text-ink-muted">{t("zoneOffNote")}</p>}
      {save.isError && <p role="alert" className="type-body text-error">{errorText(save.error)}</p>}
    </article>
  );
}
