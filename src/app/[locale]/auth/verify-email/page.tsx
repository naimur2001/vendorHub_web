import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { VerifyEmailView } from "@/components/auth/email-verification";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// The token must never leave this page: no indexing, no Referer to other sites.
export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Verify" });
  return { title: t("metaTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

const TOKEN = /^[A-Za-z0-9_-]{20,200}$/;

async function VerifyContent({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = (await searchParams).token;
  const token = typeof raw === "string" && TOKEN.test(raw) ? raw : null;
  return <VerifyEmailView token={token} />;
}

export default function VerifyEmailPage(props: Props) {
  return (
    <Suspense fallback={null}>
      <VerifyContent {...props} />
    </Suspense>
  );
}