"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, LoaderCircle, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { useSession } from "@/components/app-providers";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { Link } from "@/i18n/routing";
import { addressKeys, createAddress, deleteAddress, listAddresses, updateAddress, type Address, type AddressInput } from "@/lib/api/addresses";
import { cn } from "@/lib/utils";
import { BD_MOBILE, normalizePhone } from "@/lib/validation";

function AddressForm({ address, onSaved, onCancel }: { address?: Address; onSaved: () => void; onCancel: () => void }) {
  const t = useTranslations("Addresses");
  const { user } = useSession();
  const [label, setLabel] = useState(address?.label ?? "");
  const [line1, setLine1] = useState(address?.line1 ?? "");
  const [area, setArea] = useState(address?.area ?? "");
  const [city, setCity] = useState(address?.city ?? "Dhaka");
  const [phone, setPhone] = useState(address?.phone ?? user?.phone ?? "");
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (input: AddressInput) => (address ? updateAddress(address.id, input) : createAddress(input)),
    onSuccess: onSaved,
    onError: () => setErrors({ form: t("errors.generic") }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const p = normalizePhone(phone);
    if (line1.trim().length < 5 || line1.trim().length > 200) next.line1 = t("errors.line1");
    if (city.trim().length < 2 || city.trim().length > 60) next.city = t("errors.city");
    if (!BD_MOBILE.test(p)) next.phone = t("errors.phone");
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    save.mutate({
      label: label.trim() || (address ? null : undefined),
      line1: line1.trim(),
      area: area.trim() || (address ? null : undefined),
      city: city.trim(),
      phone: p,
      isDefault,
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <TextField label={t("form.label")} placeholder={t("form.labelPlaceholder")} maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} />
      <TextField label={t("form.line1")} placeholder={t("form.line1Placeholder")} autoComplete="address-line1" maxLength={200} value={line1} onChange={(e) => setLine1(e.target.value)} error={errors.line1} />
      <TextField label={t("form.area")} autoComplete="address-level3" maxLength={100} value={area} onChange={(e) => setArea(e.target.value)} />
      <TextField label={t("form.city")} autoComplete="address-level2" maxLength={60} value={city} onChange={(e) => setCity(e.target.value)} error={errors.city} />
      <TextField label={t("form.phone")} type="tel" inputMode="tel" autoComplete="tel" maxLength={25} value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="size-5 accent-brand" />
        <span className="type-body text-ink">{t("form.isDefault")}</span>
      </label>
      {errors.form && (
        <p role="alert" className="type-body flex items-start gap-2 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {errors.form}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} disabled={save.isPending} className="type-body-medium h-12 rounded-sm border border-ink text-ink hover:bg-subtle">{t("form.cancel")}</button>
        <button type="submit" disabled={save.isPending} className="type-body-medium flex h-12 items-center justify-center gap-2 rounded-sm bg-action text-primary-foreground hover:bg-action-hover disabled:opacity-60">
          {save.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {save.isPending ? t("form.saving") : t("form.save")}
        </button>
      </div>
    </form>
  );
}

export function AddressBook() {
  const t = useTranslations("Addresses");
  const { status } = useSession();
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<{ address?: Address } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const addresses = useQuery({ queryKey: addressKeys.all, queryFn: listAddresses, enabled: status === "authenticated" });
  const refresh = (text: string) => {
    setNotice(text);
    void queryClient.invalidateQueries({ queryKey: addressKeys.all });
  };
  const remove = useMutation({ mutationFn: deleteAddress, onSuccess: () => { setConfirmId(null); refresh(t("deleted")); } });
  const makeDefault = useMutation({ mutationFn: (id: string) => updateAddress(id, { isDefault: true }), onSuccess: () => refresh(t("saved")) });

  if (status === "guest") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center">
        <h2 className="type-h3 text-ink">{t("guestTitle")}</h2>
        <Link href={`/auth/login?next=${encodeURIComponent("/account/addresses")}`} className="type-body-medium flex h-12 items-center rounded-sm bg-action px-6 text-primary-foreground">{t("logIn")}</Link>
      </div>
    );
  }
  if (status === "loading" || addresses.isPending) return <OwnerSkeleton label={t("loading")} />;
  if (addresses.isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center">
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => addresses.refetch()} className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand">{t("retry")}</button>
      </div>
    );
  }

  const list = [...addresses.data].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => { setNotice(null); setPanel({}); }} className="type-body-medium flex h-12 items-center justify-center gap-2 self-start rounded-sm bg-action px-5 text-primary-foreground hover:bg-action-hover">
        <Plus className="size-5" aria-hidden />
        {t("add")}
      </button>
      {notice && (
        <p role="status" className="type-body flex items-center gap-2 text-success-ink">
          <CircleCheck className="size-4" aria-hidden />
          {notice}
        </p>
      )}
      {list.length === 0 ? (
        <p className="type-body rounded-md border border-line bg-card px-6 py-12 text-center text-ink-secondary">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((a) => (
            <li key={a.id} className={cn("flex flex-col gap-3 rounded-md border bg-card p-4 shadow-card", a.isDefault ? "border-brand" : "border-line")}>
              <div className="flex items-start justify-between gap-2">
                <p className="type-body-medium flex items-center gap-2 text-ink">
                  <MapPin className="size-4 text-highlight" aria-hidden />
                  {a.label || t("form.addTitle")}
                </p>
                {a.isDefault && <span className="type-caption rounded-full bg-brand px-2 py-0.5 text-primary-foreground">{t("default")}</span>}
              </div>
              {/* Plain text */}
              <p className="type-body text-ink-secondary">{[a.line1, a.area, a.city].filter(Boolean).join(", ")}</p>
              <p className="type-caption text-ink-muted">{a.phone}</p>
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                <button type="button" onClick={() => { setNotice(null); setPanel({ address: a }); }} className="type-body-medium flex h-10 items-center gap-1 rounded-sm border border-brand px-3 text-brand hover:bg-subtle">
                  <Pencil className="size-4" aria-hidden />
                  {t("edit")}
                </button>
                {!a.isDefault && (
                  <button type="button" onClick={() => makeDefault.mutate(a.id)} disabled={makeDefault.isPending} className="type-body-medium flex h-10 items-center gap-1 rounded-sm px-3 text-ink-secondary hover:bg-subtle">
                    <Star className="size-4" aria-hidden />
                    {t("makeDefault")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (confirmId === a.id ? remove.mutate(a.id) : setConfirmId(a.id))}
                  onBlur={() => setConfirmId(null)}
                  disabled={remove.isPending}
                  className={cn("type-body-medium ml-auto flex h-10 items-center gap-1 rounded-sm px-3", confirmId === a.id ? "bg-error text-primary-foreground" : "text-error hover:bg-error-soft")}
                >
                  <Trash2 className="size-4" aria-hidden />
                  {confirmId === a.id ? t("confirmDelete") : t("delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={panel !== null} onOpenChange={(open) => !open && setPanel(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="type-h3 text-ink">{panel?.address ? t("form.editTitle") : t("form.addTitle")}</SheetTitle>
            <SheetDescription className="sr-only">{t("subtitle")}</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            {panel && <AddressForm key={panel.address?.id ?? "new"} address={panel.address} onCancel={() => setPanel(null)} onSaved={() => { setPanel(null); refresh(t("saved")); }} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}