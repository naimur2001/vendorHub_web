"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/app-providers";
import { ToLetThread } from "@/components/to-let/to-let-thread";
import { getInquiryMessages, sendInquiryMessage, TOKEN, toLetKeys } from "@/lib/api/to-let";

/** The renter's enquiry thread with the Vendors Hub team: by login, or by the private link (?token=) for guests. */
export function InquiryFollow({ inquiryId }: { inquiryId: string }) {
  const t = useTranslations("ToLet");
  const searchParams = useSearchParams();
  const { status } = useSession();
  const raw = searchParams.get("token");
  const token = raw && TOKEN.test(raw) ? raw : undefined; // anything else is ignored

  if (status === "loading") return <div className="h-64 skeleton rounded-md" aria-hidden />;
  if (!token && status !== "authenticated") {
    return <p className="type-body rounded-md border border-line bg-card p-6 text-center text-ink-secondary">{t("needLink")}</p>;
  }
  return (
    <ToLetThread
      queryKey={toLetKeys.inquiry(inquiryId)}
      load={async () => (await getInquiryMessages(inquiryId, token)).messages}
      send={(body) => sendInquiryMessage(inquiryId, body, token)}
      title={t("threadTitle")}
      intro={t("threadIntro")}
    />
  );
}
