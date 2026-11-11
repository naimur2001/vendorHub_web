"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, ImagePlus, LoaderCircle, Trash2, UserPlus } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useSession } from "@/components/app-providers";
import { OwnerSkeleton } from "@/components/owner/owner-skeleton";
import { TextField } from "@/components/ui/text-field";
import { listAllMarkets } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/core";
import { addStaff, listStaff, removeShopImage, removeStaff, updateShop, uploadShopImage, type ShopUpdate } from "@/lib/api/shop-settings";
import { getMyShops, shopKeys } from "@/lib/api/shops";
import { getStorefront, safeMediaUrl, type Storefront } from "@/lib/api/storefront";
import { cn } from "@/lib/utils";
import { OwnerShopPhotos } from "@/components/shop/shop-photos";



const inputClass =
  "type-body h-11 w-full rounded-md border border-input bg-card px-3 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-md border border-line bg-card p-4 shadow-card md:p-5">
      <h2 className="type-h3 border-b border-line pb-2 text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Note({ kind, text }: { kind: "ok" | "error"; text: string }) {
  return (
    <p role={kind === "error" ? "alert" : "status"} className={cn("type-body flex items-start gap-2", kind === "error" ? "text-error" : "text-success-ink")}>
      {kind === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
      {text}
    </p>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Logo or banner: current picture, choose → preview → upload, remove. */
function ImageSlot({ shopId, kind, current, onChanged }: { shopId: string; kind: "logo" | "banner"; current: string | null; onChanged: () => void }) {
  const t = useTranslations("OwnerSettings.images");
  const inputId = useId();
  const [picked, setPicked] = useState<{ file: File; preview: string } | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const errorKey = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.status === 413) return "errors.size";
      if (err.status === 422) return "errors.small";
      if (err.status === 400) return "errors.rejected";
      if (err.status === 429) return "errors.rateLimit";
    }
    return "errors.generic";
  };
  const upload = useMutation({
    mutationFn: (file: File) => uploadShopImage(shopId, kind, file),
    onSuccess: () => { setPicked(null); onChanged(); },
    onError: (err) => setNote({ kind: "error", text: t(errorKey(err)) }),
  });
  const remove = useMutation({ mutationFn: () => removeShopImage(shopId, kind), onSuccess: onChanged, onError: (err) => setNote({ kind: "error", text: t(errorKey(err)) }) });

  async function pick(file: File | undefined) {
    setNote(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setNote({ kind: "error", text: t("errors.type") });
    if (file.size > 5 * 1024 * 1024) return setNote({ kind: "error", text: t("errors.size") });
    setPicked({ file, preview: await readAsDataUrl(file) });
  }

  const shape = kind === "logo" ? "aspect-square w-32 rounded-t-full rounded-b-sm" : "aspect-[16/6] w-full rounded-md";
  const busy = upload.isPending || remove.isPending;

  return (
    <div className="flex flex-col gap-2">
      <span className="type-body-medium text-ink">{t(kind)}</span>
      <div className={cn("relative overflow-hidden border border-line bg-brand", shape)}>
        {picked ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview, not uploaded yet
          <img src={picked.preview} alt={t("previewAlt")} className="h-full w-full object-cover" />
        ) : current ? (
          <Image src={current} alt="" fill unoptimized sizes={kind === "logo" ? "8rem" : "48rem"} className="object-cover" />
        ) : (
          <span className="type-caption absolute inset-0 flex items-center justify-center text-primary-foreground/80">{t("none")}</span>
        )}
      </div>
      <p className="type-caption text-ink-muted">{t(kind === "logo" ? "logoHint" : "bannerHint")} {t("rules")}</p>
      <div className="flex flex-wrap gap-2">
        {picked ? (
          <>
            <button type="button" onClick={() => upload.mutate(picked.file)} disabled={busy} className="type-body-medium flex h-10 items-center gap-2 rounded-sm bg-action px-3 text-primary-foreground disabled:opacity-60">
              {upload.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {upload.isPending ? t("uploading") : t("upload")}
            </button>
            <button type="button" onClick={() => setPicked(null)} disabled={busy} className="type-body-medium h-10 rounded-sm border border-ink px-3 text-ink">{t("chooseAnother")}</button>
          </>
        ) : (
          <label htmlFor={inputId} className="type-body-medium flex h-10 cursor-pointer items-center gap-2 rounded-sm border border-brand px-3 text-brand hover:bg-subtle has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand">
            <ImagePlus className="size-4" aria-hidden />
            {t("choose")}
            <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        )}
        {current && !picked && (
          <button type="button" onClick={() => remove.mutate()} disabled={busy} className="type-body-medium flex h-10 items-center gap-1 rounded-sm px-3 text-error hover:bg-error-soft disabled:opacity-60">
            <Trash2 className="size-4" aria-hidden />
            {t("remove")}
          </button>
        )}
      </div>
      {note && <Note kind={note.kind} text={note.text} />}
    </div>
  );
}

function ProfileForm({ shop, onSaved }: { shop: Storefront; onSaved: () => void }) {
  const t = useTranslations("OwnerSettings");
  const ids = { market: useId(), description: useId(), policy: useId() };
  const markets = useQuery({ queryKey: ["admin", "markets"], queryFn: listAllMarkets, staleTime: 5 * 60_000 });

  const [name, setName] = useState(shop.name);
  const [description, setDescription] = useState(shop.description ?? "");
  const [marketId, setMarketId] = useState(shop.market?.id ?? "");
  const [levelFloor, setLevelFloor] = useState(shop.address.levelFloor ?? "");
  const [shopNumber, setShopNumber] = useState(shop.address.shopNumber ?? "");
  const [addressLine, setAddressLine] = useState(shop.address.addressLine);
  const [location, setLocation] = useState(shop.address.latitude != null && shop.address.longitude != null ? `${shop.address.latitude}, ${shop.address.longitude}` : "");
  const [delivery, setDelivery] = useState(shop.supportsDelivery);
  const [pickup, setPickup] = useState(shop.supportsPickup);
  const [policy, setPolicy] = useState(shop.returnPolicy?.text ?? "");
  const [windowDays, setWindowDays] = useState(String(shop.returnPolicy?.windowDays ?? 0));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const save = useMutation({
    mutationFn: (patch: ShopUpdate) => updateShop(shop.id, patch),
    onSuccess: () => { setNote({ kind: "ok", text: t("saved") }); onSaved(); },
    onError: () => setNote({ kind: "error", text: t("errors.generic") }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNote(null);
    const next: Record<string, string> = {};
    if (name.trim().length < 2 || name.trim().length > 100) next.name = t("errors.name");
    if (addressLine.trim().length < 5 || addressLine.trim().length > 200) next.address = t("errors.address");
    if (description.length > 1000) next.description = t("errors.description");
    if (policy.length > 2000) next.policy = t("errors.returnPolicy");
    const days = /^\d{1,2}$/.test(windowDays.trim()) ? Number(windowDays) : NaN;
    if (!(days >= 0 && days <= 60)) next.window = t("errors.returnWindow");
    const loc = location.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
    if (location.trim() && (!loc || Math.abs(Number(loc[1])) > 90 || Math.abs(Number(loc[2])) > 180)) next.location = t("errors.location");
    if (!delivery && !pickup) next.service = t("errors.service");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    save.mutate({
      name: name.trim(),
      description: description.trim() || null,
      marketId: marketId || null,
      levelFloor: levelFloor.trim() || null,
      shopNumber: shopNumber.trim() || null,
      addressLine: addressLine.trim(),
      latitude: loc ? Number(loc[1]) : null,
      longitude: loc ? Number(loc[2]) : null,
      supportsDelivery: delivery,
      supportsPickup: pickup,
      returnPolicy: policy.trim() || null,
      returnWindowDays: days,
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <TextField label={t("profile.name")} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.description} className="type-body-medium text-ink">{t("profile.description")}</label>
        <textarea id={ids.description} rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} className="type-body w-full rounded-md border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none" />
        {errors.description && <p className="type-caption text-error">{errors.description}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.market} className="type-body-medium text-ink">{t("profile.market")}</label>
        <select id={ids.market} value={marketId} onChange={(e) => setMarketId(e.target.value)} className={inputClass}>
          <option value="">{t("profile.noMarket")}</option>
          {(markets.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("profile.levelFloor")} maxLength={30} value={levelFloor} onChange={(e) => setLevelFloor(e.target.value)} />
        <TextField label={t("profile.shopNumber")} maxLength={30} value={shopNumber} onChange={(e) => setShopNumber(e.target.value)} />
      </div>
      <TextField label={t("profile.addressLine")} maxLength={200} value={addressLine} onChange={(e) => setAddressLine(e.target.value)} error={errors.address} />
      <TextField label={t("profile.location")} hint={t("profile.locationHint")} inputMode="decimal" maxLength={40} value={location} onChange={(e) => setLocation(e.target.value)} error={errors.location} />
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-3"><input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} className="size-5 accent-brand" /><span className="type-body text-ink">{t("profile.delivery")}</span></label>
        <label className="flex items-center gap-3"><input type="checkbox" checked={pickup} onChange={(e) => setPickup(e.target.checked)} className="size-5 accent-brand" /><span className="type-body text-ink">{t("profile.pickup")}</span></label>
        {errors.service && <p className="type-caption text-error">{errors.service}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.policy} className="type-body-medium text-ink">{t("profile.returnPolicy")}</label>
        <textarea id={ids.policy} rows={3} maxLength={2000} value={policy} onChange={(e) => setPolicy(e.target.value)} className="type-body w-full rounded-md border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none" />
        {errors.policy && <p className="type-caption text-error">{errors.policy}</p>}
      </div>
      <TextField label={t("profile.returnWindow")} inputMode="numeric" maxLength={2} value={windowDays} onChange={(e) => setWindowDays(e.target.value)} error={errors.window} />
      {note && <Note kind={note.kind} text={note.text} />}
      <button type="submit" disabled={save.isPending} className="type-body-medium flex h-12 items-center justify-center gap-2 self-start rounded-sm bg-action px-6 text-primary-foreground hover:bg-action-hover disabled:opacity-60">
        {save.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
        {save.isPending ? t("profile.saving") : t("profile.save")}
      </button>
    </form>
  );
}

function StaffSection({ shopId }: { shopId: string }) {
  const t = useTranslations("OwnerSettings");
  const queryClient = useQueryClient();
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const staff = useQuery({ queryKey: ["owner", "staff", shopId], queryFn: () => listStaff(shopId) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["owner", "staff", shopId] });

  const add = useMutation({
    mutationFn: (e: string) => addStaff(shopId, e),
    onSuccess: () => { setEmail(""); setNote({ kind: "ok", text: t("staff.added") }); refresh(); },
    onError: (err) => setNote({ kind: "error", text: err instanceof ApiError && err.status === 404 ? t("staff.notFound") : err instanceof ApiError && err.status === 409 ? t("staff.already") : t("errors.generic") }),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => removeStaff(shopId, userId),
    onSuccess: () => { setConfirmId(null); setNote({ kind: "ok", text: t("staff.removed") }); refresh(); },
    onError: () => setNote({ kind: "error", text: t("errors.generic") }),
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="type-caption text-ink-muted">{t("staff.text")}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = email.trim().toLowerCase();
          if (!EMAIL.test(v) || v.length > 254) return setNote({ kind: "error", text: t("errors.email") });
          setNote(null);
          add.mutate(v);
        }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={emailId} className="type-caption text-ink-secondary">{t("staff.email")}</label>
          <input id={emailId} type="email" autoComplete="off" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <button type="submit" disabled={add.isPending} className="type-body-medium flex h-11 items-center justify-center gap-2 rounded-sm bg-action px-4 text-primary-foreground disabled:opacity-60">
          {add.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
          {t("staff.add")}
        </button>
      </form>
      {note && <Note kind={note.kind} text={note.text} />}
      {staff.isPending ? (
        <LoaderCircle className="size-5 animate-spin text-ink-muted" aria-hidden />
      ) : (staff.data ?? []).length === 0 ? (
        <p className="type-body text-ink-muted">{t("staff.empty")}</p>
      ) : (
        <ul className="flex flex-col">
          {staff.data?.map((m) => {
            const isOwner = (m.role ?? m.membership) === "OWNER";
            return (
              <li key={m.userId} className="flex flex-wrap items-center gap-2 border-t border-line py-2 first:border-t-0">
                <div className="min-w-0 flex-1">
                  <p className="type-body text-ink">{m.name}</p>
                  <p className="type-caption text-ink-muted">{m.email}</p>
                </div>
                <span className="type-caption rounded-full bg-subtle px-2 py-0.5 text-ink-secondary">{isOwner ? t("staff.owner") : t("staff.member")}</span>
                {!isOwner && (
                  <button
                    type="button"
                    onClick={() => (confirmId === m.userId ? remove.mutate(m.userId) : setConfirmId(m.userId))}
                    onBlur={() => setConfirmId(null)}
                    disabled={remove.isPending}
                    className={cn("type-body-medium h-9 rounded-sm px-3", confirmId === m.userId ? "bg-error text-primary-foreground" : "text-error hover:bg-error-soft")}
                  >
                    {confirmId === m.userId ? t("staff.confirmRemove") : t("staff.remove")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ShopSettings() {
  const t = useTranslations("OwnerSettings");
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { status, user } = useSession();
  const isOwner = user?.role === "SHOP_OWNER";

  const shops = useQuery({ queryKey: shopKeys.mine, queryFn: getMyShops, enabled: status === "authenticated" && isOwner });
  const owned = (shops.data ?? []).filter((s) => s.membership === "OWNER");
  const shop = owned.find((s) => s.id === searchParams.get("shop")) ?? owned[0];
  const profile = useQuery({ queryKey: ["owner", "profile", shop?.slug ?? ""], queryFn: () => getStorefront(shop?.slug ?? ""), enabled: Boolean(shop) });
  const tPhotos = useTranslations("ShopPhotos");
  const changed = () => {
    void queryClient.invalidateQueries({ queryKey: ["owner", "profile"] });
    void queryClient.invalidateQueries({ queryKey: shopKeys.mine });
  };

  if (status === "loading" || (isOwner && (shops.isPending || profile.isPending))) return <OwnerSkeleton label={t("loading")} />;
  if (!isOwner || !shop) return <p className="type-body rounded-md border border-line bg-card px-6 py-12 text-center text-ink-secondary">{t("ownerOnly")}</p>;
  if (profile.isError || !profile.data) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-md border border-line bg-card px-6 py-12 text-center">
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => profile.refetch()} className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand">{t("retry")}</button>
      </div>
    );
  }

  const p = profile.data;
  return (
    <div className="flex flex-col gap-6">
      <Section title={t("images.title")}>
        <div className="grid gap-6 md:grid-cols-[10rem_1fr]">
          
          <ImageSlot shopId={p.id} kind="logo" current={safeMediaUrl(p.logoUrl)} onChanged={changed} />
                <Section title={tPhotos("title")}>
        <OwnerShopPhotos shopId={p.id} slug={p.slug} />
      </Section>

          <ImageSlot shopId={p.id} kind="banner" current={safeMediaUrl(p.bannerUrl)} onChanged={changed} />
        </div>
      </Section>
      <Section title={t("profile.title")}>
        <ProfileForm key={p.id} shop={p} onSaved={changed} />
      </Section>
      <Section title={t("staff.title")}>
        <StaffSection shopId={p.id} />
      </Section>
    </div>
  );
}