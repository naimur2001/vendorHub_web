"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleAlert, Hourglass, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useSession } from "@/components/app-providers";
import { VerificationSeal } from "@/components/brand/verification-seal";
import { DocumentsForm } from "@/components/owner/documents-form";
import { ShopForm } from "@/components/owner/shop-form";
import { Link, useRouter } from "@/i18n/routing";
import { getMyShops, shopKeys, type MyShop } from "@/lib/api/shops";
import { cn } from "@/lib/utils";

type StepState = "done" | "current" | "upcoming";

// Small arch per step: filled red with a check when done, red outline when current, grey when not started.
function StepArch({ state }: { state: StepState }) {
  const arch = "M8 38 V20 A12 12 0 0 1 32 20 V38";
  return (
    <svg viewBox="0 0 40 40" className="size-10" aria-hidden="true">
      {state === "done" ? (
        <>
          <path d={`${arch} Z`} className="fill-brand" />
          <path d="M14 27 l4 4 8-8" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-surface" />
        </>
      ) : (
        <>
          <path d={arch} fill="none" strokeWidth="2.5" className={state === "current" ? "stroke-brand" : "stroke-line-strong"} />
          {state === "current" && <path d="M18 4 H22 L21 9 H19 Z" className="fill-gold" />}
        </>
      )}
    </svg>
  );
}

function SetupProgress({ current }: { current: number }) {
  const t = useTranslations("OwnerSetup");
  const steps = [t("stepAccount"), t("stepShop"), t("stepDocuments"), t("stepReview")];

  return (
    <ol aria-label={t("progressLabel")} className="grid grid-cols-4 gap-2 border-b border-gold pb-5">
      {steps.map((label, i) => {
        const n = i + 1;
        const state: StepState = n < current ? "done" : n === current ? "current" : "upcoming";
        const stateText = state === "done" ? t("stateDone") : state === "current" ? t("stateCurrent") : t("stateUpcoming");
        return (
          <li
            key={label}
            aria-current={state === "current" ? "step" : undefined}
            className="flex flex-col items-center gap-1.5 text-center"
          >
            <StepArch state={state} />
            <span className={cn("type-caption", state === "upcoming" ? "text-ink-muted" : "text-ink")}>{label}</span>
            <span className="sr-only">({stateText})</span>
          </li>
        );
      })}
    </ol>
  );
}

function StatusCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-card p-6 text-center">
      {icon}
      <h2 className="type-h3 text-ink">{title}</h2>
      {children}
    </div>
  );
}

function ShopSummary({ shop }: { shop: MyShop }) {
  const t = useTranslations("OwnerSetup");
  // "17" -> "Shop 17"; "Shop 17" stays as it is.
  const number = shop.shopNumber
    ? /^shop\b/i.test(shop.shopNumber)
      ? shop.shopNumber
      : t("shopNumberLabel", { number: shop.shopNumber })
    : null;
  const place = [shop.market?.name, shop.levelFloor, number].filter(Boolean).join(" · ");

  return (
    <p className="type-body text-ink-secondary">
      <span className="type-body-medium text-ink">{shop.name}</span>
      {place && <> · {place}</>}
    </p>
  );
}

// What the review step says, depending on the latest request (or the level reached).
function ReviewStatus({ shop }: { shop: MyShop }) {
  const t = useTranslations("OwnerSetup");
  const status = shop.latestVerification?.status ?? "APPROVED";

  if (status === "PENDING" || status === "AUTO_FLAGGED") {
    return (
      <StatusCard icon={<Hourglass className="size-8 text-highlight" aria-hidden />} title={t("status.reviewTitle")}>
        <ShopSummary shop={shop} />
        <p className="type-body text-ink-secondary">{t("status.reviewText")}</p>
      </StatusCard>
    );
  }

  if (status === "APPROVED") {
    return (
      <StatusCard icon={<VerificationSeal level={shop.verificationLevel} size="lg" />} title={t("status.approvedTitle")}>
        <ShopSummary shop={shop} />
        <p className="type-body text-ink-secondary">{t("status.approvedText")}</p>
      </StatusCard>
    );
  }

  const key = status === "CORRECTION_REQUESTED" ? "correction" : status === "REJECTED" ? "rejected" : "revoked";
  return (
    <StatusCard
      icon={<CircleAlert className={cn("size-8", key === "correction" ? "text-highlight" : "text-error")} aria-hidden />}
      title={t(`status.${key}Title`)}
    >
      <ShopSummary shop={shop} />
      <p className="type-body text-ink-secondary">{t(`status.${key}Text`)}</p>
    </StatusCard>
  );
}

export function SetupWizard() {
  const t = useTranslations("OwnerSetup");
  const router = useRouter();
  const { status, user } = useSession();
  const isOwner = user?.role === "SHOP_OWNER";

  // Guests log in first and come back here.
  useEffect(() => {
    if (status === "guest") router.replace(`/auth/login?next=${encodeURIComponent("/owner/setup")}`);
  }, [status, router]);

  const shops = useQuery({
    queryKey: shopKeys.mine,
    queryFn: getMyShops,
    enabled: status === "authenticated" && isOwner,
  });

  const loading = (
    <p role="status" className="type-body flex items-center justify-center gap-2 py-12 text-ink-secondary">
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      {t("loading")}
    </p>
  );

  if (status !== "authenticated") return loading;

  if (!isOwner) {
    return (
      <StatusCard icon={<CircleAlert className="size-8 text-highlight" aria-hidden />} title={t("notOwnerTitle")}>
        <p className="type-body text-ink-secondary">{t("notOwnerText")}</p>
        <Link href="/auth/register/shop" className="type-body-medium text-brand underline-offset-4 hover:underline">
          {t("registerShop")}
        </Link>
      </StatusCard>
    );
  }

  if (shops.isPending) return loading;

  if (shops.isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="type-body text-error">{t("loadError")}</p>
        <button
          type="button"
          onClick={() => shops.refetch()}
          className="type-body-medium rounded-sm border border-brand px-4 py-2 text-brand hover:bg-subtle"
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  // Setup is about the shop this owner owns (staff memberships do not count here).
  const shop = shops.data.find((s) => s.membership === "OWNER");
  // Documents step only for a new, unverified shop without any request yet.
  const needsDocuments = shop && !shop.latestVerification && shop.verificationLevel === "UNVERIFIED";
  const step = !shop ? 2 : needsDocuments ? 3 : 4;

  return (
    <div className="flex flex-col gap-8">
      <SetupProgress current={step} />

      {step === 2 && <ShopForm />}

      {step === 3 && shop && (
        <div className="flex flex-col gap-6">
          <div className="rounded-md border border-line bg-card p-4">
            <ShopSummary shop={shop} />
          </div>
          <DocumentsForm shop={shop} />
        </div>
      )}

      {step === 4 && shop && <ReviewStatus shop={shop} />}
    </div>
  );
}