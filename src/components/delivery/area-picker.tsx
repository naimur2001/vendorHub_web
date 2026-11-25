"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { deliveryKeys, listAreas, listCities, listZones } from "@/lib/api/delivery";

export type AreaValue = { city: number | null; zone: number | null; area: number | null };

const select = "type-body h-11 w-full rounded-sm border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none disabled:bg-subtle disabled:text-ink-disabled";

/**
 * City, then zone, then area, from the courier's own lists. Used for delivery addresses (the fee
 * depends on it) and for a shop's pickup store. `legend` and `hint` replace the address wording.
 */
export function AreaPicker({ value, onChange, error, legend, hint }: { value: AreaValue; onChange: (v: AreaValue) => void; error?: string; legend?: string; hint?: string }) {
  const t = useTranslations("Addresses");
  const id = useId();
  const cities = useQuery({ queryKey: deliveryKeys.cities, queryFn: listCities, staleTime: 60 * 60_000 });
  const zones = useQuery({ queryKey: deliveryKeys.zonesOf(value.city ?? 0), queryFn: () => listZones(value.city as number), enabled: value.city !== null, staleTime: 60 * 60_000 });
  const areas = useQuery({ queryKey: deliveryKeys.areasOf(value.zone ?? 0), queryFn: () => listAreas(value.zone as number), enabled: value.zone !== null, staleTime: 60 * 60_000 });
  const num = (v: string) => (/^\d{1,9}$/.test(v) ? Number(v) : null);
  const failed = cities.isError || zones.isError || areas.isError;

  return (
    <fieldset className="flex flex-col gap-3 rounded-sm border border-line p-3" aria-describedby={`${id}-hint`}>
      <legend className="type-body-medium px-1 text-ink">{legend ?? t("form.deliveryArea")}</legend>
      <p id={`${id}-hint`} className="type-caption -mt-1 text-ink-muted">{hint ?? t("form.deliveryAreaHint")}</p>
      <label htmlFor={`${id}-c`} className="flex flex-col gap-1">
        <span className="type-caption text-ink-secondary">{t("form.cityPick")}</span>
        <select id={`${id}-c`} value={value.city ?? ""} disabled={cities.isPending} onChange={(e) => onChange({ city: num(e.target.value), zone: null, area: null })} className={select}>
          <option value="">{cities.isPending ? t("form.loadingList") : t("form.choose")}</option>
          {(cities.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label htmlFor={`${id}-z`} className="flex flex-col gap-1">
        <span className="type-caption text-ink-secondary">{t("form.zonePick")}</span>
        <select id={`${id}-z`} value={value.zone ?? ""} disabled={value.city === null || zones.isPending} onChange={(e) => onChange({ ...value, zone: num(e.target.value), area: null })} className={select}>
          <option value="">{value.city !== null && zones.isPending ? t("form.loadingList") : t("form.choose")}</option>
          {(zones.data ?? []).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
      </label>
      <label htmlFor={`${id}-a`} className="flex flex-col gap-1">
        <span className="type-caption text-ink-secondary">{t("form.areaPick")}</span>
        <select id={`${id}-a`} value={value.area ?? ""} disabled={value.zone === null || areas.isPending} onChange={(e) => onChange({ ...value, area: num(e.target.value) })} className={select}>
          <option value="">{value.zone !== null && areas.isPending ? t("form.loadingList") : t("form.choose")}</option>
          {(areas.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      {failed && <p role="alert" className="type-caption text-error">{t("errors.areaList")}</p>}
      {error && <p role="alert" className="type-caption text-error">{error}</p>}
    </fieldset>
  );
}
