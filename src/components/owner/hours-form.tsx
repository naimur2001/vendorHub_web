"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, Copy, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/core";
import { saveShopHours, type OpeningDayInput } from "@/lib/api/shop-settings";
import { cn } from "@/lib/utils";

const DAY_ORDER = [6, 0, 1, 2, 3, 4, 5]; // Saturday first, as the Bangladeshi week starts
const DEFAULT = { open: "10:00", close: "20:00" };

type Row = { day: number; isOpen: boolean; open: string; close: string };

function initialRows(hours: OpeningDayInput[] | null | undefined): Row[] {
  return DAY_ORDER.map((day) => {
    const d = hours?.find((h) => h.day === day);
    if (!d) return { day, isOpen: !hours, ...DEFAULT };
    return { day, isOpen: !d.closed, open: d.open ?? DEFAULT.open, close: d.close ?? DEFAULT.close };
  });
}

const timeInput =
  "type-body h-11 w-full rounded-md border border-input bg-card px-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none disabled:opacity-50";

/** Owner settings: the shop's weekly opening hours and its weekly holiday. */
export function HoursForm({
  shopId,
  hours,
  weeklyHoliday,
  onSaved,
}: {
  shopId: string;
  hours: OpeningDayInput[] | null | undefined;
  weeklyHoliday: number | null | undefined;
  onSaved: () => void;
}) {
  const t = useTranslations("OwnerHours");
  const tDays = useTranslations("ShopHours");
  const holidayId = useId();
  const [rows, setRows] = useState<Row[]>(() => initialRows(hours));
  const [holiday, setHoliday] = useState<number | null>(weeklyHoliday ?? null);
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const save = useMutation({
    mutationFn: (clear: boolean) =>
      saveShopHours(
        shopId,
        clear
          ? null
          : rows
              .map((r) => (r.isOpen && r.day !== holiday ? { day: r.day, open: r.open, close: r.close, closed: false } : { day: r.day, open: null, close: null, closed: true }))
              .sort((a, b) => a.day - b.day),
        holiday,
      ),
    onMutate: () => setNote(null),
    onSuccess: (_d, clear) => {
      if (clear) setRows(initialRows(null));
      setNote({ kind: "ok", text: clear ? t("cleared") : t("saved") });
      onSaved();
    },
    onError: (err) => setNote({ kind: "error", text: err instanceof ApiError && err.status === 400 ? t("invalid") : t("error") }),
  });

  const update = (day: number, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.day === day ? { ...r, ...patch } : r)));
  const copyFirst = () => setRows((list) => list.map((r) => ({ ...r, isOpen: list[0].isOpen, open: list[0].open, close: list[0].close })));

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const bad = rows.find((r) => r.isOpen && r.day !== holiday && (!r.open || !r.close || r.open === r.close));
    if (bad) return setNote({ kind: "error", text: t("sameTime", { day: tDays(`days.${bad.day}`) }) });
    save.mutate(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="type-caption text-ink-muted">{t("hint")}</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={holidayId} className="type-body-medium text-ink">
          {t("holiday")}
        </label>
        <select
          id={holidayId}
          value={holiday ?? ""}
          onChange={(e) => setHoliday(e.target.value === "" ? null : Number(e.target.value))}
          className="type-body h-11 max-w-xs rounded-md border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
        >
          <option value="">{t("noHoliday")}</option>
          {DAY_ORDER.map((d) => (
            <option key={d} value={d}>
              {tDays(`days.${d}`)}
            </option>
          ))}
        </select>
      </div>

      <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
        {rows.map((r) => {
          const off = r.day === holiday;
          const name = tDays(`days.${r.day}`);
          return (
            <li key={r.day} className={cn("grid grid-cols-[6.5rem_1fr] items-center gap-2 p-2 sm:grid-cols-[8rem_auto_1fr_1fr]", off && "bg-subtle")}>
              <span className="type-body-medium text-ink">{name}</span>
              <label className="flex min-h-11 items-center gap-2 sm:pr-2">
                <input
                  type="checkbox"
                  checked={r.isOpen && !off}
                  disabled={off}
                  onChange={(e) => update(r.day, { isOpen: e.target.checked })}
                  className="size-5 accent-brand"
                />
                <span className="type-caption text-ink-secondary">{off ? tDays("holiday") : r.isOpen ? t("open") : t("closed")}</span>
              </label>
              <label className="col-start-2 flex flex-col gap-0.5 sm:col-start-auto">
                <span className="sr-only">{t("opensAt", { day: name })}</span>
                <input type="time" value={r.open} disabled={!r.isOpen || off} onChange={(e) => update(r.day, { open: e.target.value })} className={timeInput} />
              </label>
              <label className="col-start-2 flex flex-col gap-0.5 sm:col-start-auto">
                <span className="sr-only">{t("closesAt", { day: name })}</span>
                <input type="time" value={r.close} disabled={!r.isOpen || off} onChange={(e) => update(r.day, { close: e.target.value })} className={timeInput} />
              </label>
            </li>
          );
        })}
      </ul>
      <p className="type-caption -mt-2 text-ink-muted">{t("overnight")}</p>

      {note && (
        <p role={note.kind === "error" ? "alert" : "status"} className={cn("type-body flex items-start gap-2", note.kind === "error" ? "text-error" : "text-success-ink")}>
          {note.kind === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {note.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={save.isPending}
          aria-busy={save.isPending}
          className="type-body-medium inline-flex h-11 items-center gap-2 rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
        >
          {save.isPending && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
          {t("save")}
        </button>
        <button
          type="button"
          onClick={copyFirst}
          className="type-body-medium inline-flex h-11 items-center gap-2 rounded-sm border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          <Copy className="size-4" aria-hidden />
          {t("copy", { day: tDays(`days.${DAY_ORDER[0]}`) })}
        </button>
        {hours && hours.length > 0 && (
          <button
            type="button"
            onClick={() => save.mutate(true)}
            disabled={save.isPending}
            className="type-body-medium inline-flex h-11 items-center rounded-sm px-3 text-error hover:bg-error-soft focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none"
          >
            {t("clear")}
          </button>
        )}
      </div>
    </form>
  );
}
