"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { TextField } from "@/components/ui/text-field";
import { ApiError } from "@/lib/api/core";
import { createShop, getMarkets, shopKeys, type CreateShopInput } from "@/lib/api/shops";
import { cn } from "@/lib/utils";

type Translate = (key: string) => string;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Same limits as the backend's createShopSchema; "at least one service" is our own rule.
function createShopSchema(t: Translate) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(2, { error: t("errors.nameShort") })
        .max(100, { error: t("errors.nameLong") }),
      marketId: z.string().refine((v) => v === "" || UUID.test(v)),
      levelFloor: z.string().trim().max(30, { error: t("errors.fieldLong") }),
      shopNumber: z.string().trim().max(30, { error: t("errors.fieldLong") }),
      addressLine: z
        .string()
        .trim()
        .min(5, { error: t("errors.addressShort") })
        .max(200, { error: t("errors.addressLong") }),
      description: z.string().trim().max(1000, { error: t("errors.descriptionLong") }),
      supportsDelivery: z.boolean(),
      supportsPickup: z.boolean(),
    })
    .refine((v) => v.supportsDelivery || v.supportsPickup, {
      error: t("errors.serviceRequired"),
      path: ["supportsDelivery"],
    });
}

type ShopValues = z.infer<ReturnType<typeof createShopSchema>>;

function errorMessage(err: unknown, t: Translate, tAuth: Translate): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return t("errors.notOwner");
    if (err.status === 400) return tAuth("errors.checkFields");
    if (err.status === 429) return tAuth("errors.tooManyAttempts");
    if (err.status === 0) return tAuth("errors.network");
  }
  return tAuth("errors.generic");
}

const fieldClass =
  "type-body w-full rounded-md border border-input bg-card px-3 text-ink placeholder:text-ink-muted hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none disabled:bg-subtle disabled:text-ink-disabled aria-invalid:border-error";

export function ShopForm() {
  const t = useTranslations("OwnerSetup");
  const tAuth = useTranslations("Auth");
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const ids = { market: useId(), description: useId(), services: useId() };

  const markets = useQuery({ queryKey: shopKeys.markets, queryFn: getMarkets, staleTime: 5 * 60_000 });

  const schema = useMemo(() => createShopSchema(t), [t]);
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ShopValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      marketId: "",
      levelFloor: "",
      shopNumber: "",
      addressLine: "",
      description: "",
      supportsDelivery: true,
      supportsPickup: true,
    },
    mode: "onTouched",
  });

  // Picking a market fills an empty address with the market's address.
  const marketField = register("marketId", {
    onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
      const market = markets.data?.find((m) => m.id === event.target.value);
      if (market && getValues("addressLine").trim() === "") {
        const parts = [market.name, market.address ?? market.city].filter(Boolean);
        setValue("addressLine", parts.join(", "), { shouldValidate: true });
      }
    },
  });

  async function onSubmit(values: ShopValues) {
    setFormError(null);
    // Leave out empty optional fields: the backend rejects an empty marketId.
    const input: CreateShopInput = {
      name: values.name,
      addressLine: values.addressLine,
      supportsDelivery: values.supportsDelivery,
      supportsPickup: values.supportsPickup,
      ...(values.marketId && { marketId: values.marketId }),
      ...(values.levelFloor && { levelFloor: values.levelFloor }),
      ...(values.shopNumber && { shopNumber: values.shopNumber }),
      ...(values.description && { description: values.description }),
    };
    try {
      await createShop(input);
      // The wizard re-reads "my shops" and moves on to the documents step.
      await queryClient.invalidateQueries({ queryKey: shopKeys.mine });
    } catch (err) {
      setFormError(errorMessage(err, t, tAuth));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h2 className="type-h3 text-ink">{t("shopTitle")}</h2>
        <p className="type-body text-ink-secondary">{t("shopText")}</p>
      </header>

      {formError && (
        <div role="alert" className="type-body flex gap-2 rounded-md border border-error/30 bg-error-soft p-3 text-error">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>{formError}</p>
        </div>
      )}

      <TextField
        label={t("name")}
        placeholder={t("namePlaceholder")}
        maxLength={100}
        error={errors.name?.message}
        {...register("name")}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.market} className="type-body-medium text-ink">
          {t("market")}
        </label>
        <select
          id={ids.market}
          disabled={markets.isPending}
          aria-describedby={`${ids.market}-hint`}
          className={cn(fieldClass, "h-12")}
          {...marketField}
        >
          <option value="">{markets.isPending ? t("marketsLoading") : t("marketNone")}</option>
          {markets.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.city ? `${m.name} · ${m.city}` : m.name}
            </option>
          ))}
        </select>
        <p id={`${ids.market}-hint`} className="type-caption text-ink-muted">
          {t("marketHint")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t("levelFloor")}
          placeholder={t("levelFloorPlaceholder")}
          maxLength={30}
          error={errors.levelFloor?.message}
          {...register("levelFloor")}
        />
        <TextField
          label={t("shopNumber")}
          placeholder={t("shopNumberPlaceholder")}
          maxLength={30}
          error={errors.shopNumber?.message}
          {...register("shopNumber")}
        />
      </div>

      <TextField
        label={t("addressLine")}
        placeholder={t("addressLinePlaceholder")}
        hint={t("addressHint")}
        autoComplete="street-address"
        maxLength={200}
        error={errors.addressLine?.message}
        {...register("addressLine")}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.description} className="type-body-medium text-ink">
          {t("description")}
        </label>
        <textarea
          id={ids.description}
          rows={4}
          maxLength={1000}
          placeholder={t("descriptionPlaceholder")}
          aria-invalid={errors.description ? true : undefined}
          className={cn(fieldClass, "min-h-28 py-2.5")}
          {...register("description")}
        />
        {errors.description && <p className="type-caption text-error">{errors.description.message}</p>}
      </div>

      <fieldset
        className="flex flex-col gap-3"
        aria-describedby={errors.supportsDelivery ? `${ids.services}-error` : undefined}
      >
        <legend className="type-body-medium mb-1 text-ink">{t("services")}</legend>
        {(["supportsDelivery", "supportsPickup"] as const).map((name) => (
          <label key={name} className="type-body flex min-h-11 cursor-pointer items-center gap-3 text-ink">
            <input type="checkbox" className="size-5 accent-brand" {...register(name)} />
            {name === "supportsDelivery" ? t("delivery") : t("pickup")}
          </label>
        ))}
        {errors.supportsDelivery && (
          <p id={`${ids.services}-error`} className="type-caption flex items-center gap-1 text-error">
            <CircleAlert className="size-3.5 shrink-0" aria-hidden />
            {errors.supportsDelivery.message}
          </p>
        )}
      </fieldset>

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="type-body-medium flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-action text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-80"
      >
        {isSubmitting && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
        {isSubmitting ? t("saving") : t("saveButton")}
      </button>
    </form>
  );
}