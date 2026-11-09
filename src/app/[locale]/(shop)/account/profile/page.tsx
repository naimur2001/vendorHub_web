import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProfileForm } from "@/components/account/profile-form";

type Props = { params: Promise<{ locale: string }> };
export const metadata = { robots: { index: false, follow: false } };

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Profile");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="type-display text-ink">{t("title")}</h1>
      <ProfileForm />
    </div>
  );
}