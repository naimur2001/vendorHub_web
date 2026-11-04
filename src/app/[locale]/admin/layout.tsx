import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";

// The admin area is never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export default async function AdminLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminShell>{children}</AdminShell>;
}