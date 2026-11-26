"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type KeyboardEvent } from "react";
import type { ListingOptionGroup } from "@/lib/api/catalog";
import { cn } from "@/lib/utils";

const MAX_GROUPS = 3;
const MAX_VALUES = 20;
const MAX_TEXT = 30;
const BAD = /[=|\u0000-\u001f\u007f]/; // the server refuses these (they are used in the cart key)

const SIZE_PRESET = ["S", "M", "L", "XL", "XXL"];

const field =
  "type-body h-11 w-full rounded-sm border border-line-strong bg-card px-3 text-ink placeholder:text-ink-muted focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none";
const small =
  "type-body-medium inline-flex min-h-11 items-center gap-1.5 rounded-full border border-brand px-4 text-brand hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const lower = (s: string) => s.trim().toLocaleLowerCase("en");

/** null when the groups can be saved, else the message key of the first problem (same rules as the server). */
export function optionsProblem(groups: ListingOptionGroup[]): string | null {
  const names = new Set<string>();
  for (const g of groups) {
    const name = g.name.trim();
    if (!name || name.length > MAX_TEXT || BAD.test(name)) return "errors.name";
    if (names.has(lower(name))) return "errors.sameName";
    names.add(lower(name));
    if (g.values.length === 0) return "errors.noValues";
    const values = new Set<string>();
    for (const v of g.values) {
      if (values.has(lower(v.value))) return "errors.sameValue";
      values.add(lower(v.value));
    }
  }
  return null;
}

/** Groups as the API wants them (trimmed), or null for "no variations". */
export function optionsForApi(groups: ListingOptionGroup[]): ListingOptionGroup[] | null {
  const clean = groups.map((g) => ({ name: g.name.trim(), values: g.values.map((v) => ({ value: v.value.trim(), inStock: v.inStock !== false })) }));
  return clean.length > 0 ? clean : null;
}

/**
 * Sizes, colours or any other choice customers must make (up to 3 groups of up to 20 values).
 * Tap a value to mark it sold out (or back in stock); × removes it.
 */
export function OptionsEditor({ value, onChange }: { value: ListingOptionGroup[]; onChange: (groups: ListingOptionGroup[]) => void }) {
  const t = useTranslations("ListingOptionsEditor");
  const id = useId();

  const update = (i: number, group: ListingOptionGroup) => onChange(value.map((g, gi) => (gi === i ? group : g)));
  const addGroup = (name: string, values: string[] = []) =>
    onChange([...value, { name, values: values.map((v) => ({ value: v, inStock: true })) }]);
  const has = (name: string) => value.some((g) => lower(g.name) === lower(name));

  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <legend className="type-body-medium px-1 text-ink">{t("title")}</legend>
      <p className="type-caption -mt-1 text-ink-muted">{t("hint")}</p>

      {value.map((group, i) => (
        <GroupEditor key={i} id={`${id}-${i}`} group={group} onChange={(g) => update(i, g)} onRemove={() => onChange(value.filter((_, gi) => gi !== i))} />
      ))}

      {value.length < MAX_GROUPS && (
        <div className="flex flex-wrap gap-2">
          {!has(t("size")) && (
            <button type="button" onClick={() => addGroup(t("size"), SIZE_PRESET)} className={small}>
              <Plus className="size-4" aria-hidden />
              {t("addSize")}
            </button>
          )}
          {!has(t("colour")) && (
            <button type="button" onClick={() => addGroup(t("colour"))} className={small}>
              <Plus className="size-4" aria-hidden />
              {t("addColour")}
            </button>
          )}
          <button type="button" onClick={() => addGroup("")} className={small}>
            <Plus className="size-4" aria-hidden />
            {t("addOther")}
          </button>
        </div>
      )}
    </fieldset>
  );
}

function GroupEditor({
  id,
  group,
  onChange,
  onRemove,
}: {
  id: string;
  group: ListingOptionGroup;
  onChange: (group: ListingOptionGroup) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("ListingOptionsEditor");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);

  // "S, M, L" adds three values at once; duplicates and bad ones are skipped with a note.
  function addValues() {
    const parts = draft
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const values = [...group.values];
    let skipped = false;
    for (const p of parts) {
      if (p.length > MAX_TEXT || BAD.test(p) || values.some((v) => lower(v.value) === lower(p)) || values.length >= MAX_VALUES) {
        skipped = true;
        continue;
      }
      values.push({ value: p, inStock: true });
    }
    onChange({ ...group, values });
    setDraft("");
    setNote(skipped ? t("skipped", { max: MAX_VALUES }) : null);
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault(); // add the value, don't send the whole form
      addValues();
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-3">
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={`${id}-name`} className="type-caption text-ink-secondary">
            {t("groupName")}
          </label>
          <input
            id={`${id}-name`}
            value={group.name}
            onChange={(e) => onChange({ ...group, name: e.target.value })}
            maxLength={MAX_TEXT}
            placeholder={t("groupPlaceholder")}
            className={field}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("removeGroup", { name: group.name || t("thisGroup") })}
          className="flex size-11 shrink-0 items-center justify-center rounded-sm border border-line text-error hover:bg-error-soft focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      {group.values.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t("valuesOf", { name: group.name || t("thisGroup") })}>
          {group.values.map((v, vi) => {
            const soldOut = v.inStock === false;
            return (
              <li key={`${v.value}-${vi}`} className={cn("inline-flex items-center rounded-full border", soldOut ? "border-dashed border-line-strong" : "border-brand bg-highlight-soft")}>
                <button
                  type="button"
                  onClick={() => onChange({ ...group, values: group.values.map((x, xi) => (xi === vi ? { ...x, inStock: soldOut } : x)) })}
                  aria-pressed={!soldOut}
                  aria-label={soldOut ? t("markInStock", { value: v.value }) : t("markSoldOut", { value: v.value })}
                  className={cn(
                    "type-body-medium min-h-11 rounded-l-full px-3 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
                    soldOut ? "text-ink-disabled line-through" : "text-ink",
                  )}
                >
                  {v.value}
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...group, values: group.values.filter((_, xi) => xi !== vi) })}
                  aria-label={t("removeValue", { value: v.value })}
                  className="flex size-11 items-center justify-center rounded-r-full text-ink-muted hover:text-error focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2">
        <label htmlFor={`${id}-value`} className="sr-only">
          {t("addValueLabel")}
        </label>
        <input
          id={`${id}-value`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          maxLength={200}
          placeholder={t("valuePlaceholder")}
          className={field}
        />
        <button type="button" onClick={addValues} disabled={!draft.trim() || group.values.length >= MAX_VALUES} className={cn(small, "shrink-0")}>
          <Plus className="size-4" aria-hidden />
          {t("add")}
        </button>
      </div>
      <p className="type-caption text-ink-muted">{note ?? t("valueHint")}</p>
    </div>
  );
}
