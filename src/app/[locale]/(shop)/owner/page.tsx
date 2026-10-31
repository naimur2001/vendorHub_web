import { redirect } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

// The owner area home (dashboard) comes in a later step.
// Until then, /owner leads to the shop setup.
export default async function OwnerHomePage({ params }: Props) {
  const { locale } = await params;
  redirect({ href: "/owner/setup", locale });
}