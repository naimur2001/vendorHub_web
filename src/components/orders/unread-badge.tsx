"use client";

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";

/** "2 new messages" pill on an order in a list. Nothing when there are none. */
export function UnreadBadge({ count }: { count?: number | null }) {
  const t = useTranslations("OrderChat");
  if (!count || count <= 0) return null;
  return (
    <span className="type-caption inline-flex items-center gap-1 self-start rounded-full bg-brand px-2.5 py-0.5 text-primary-foreground">
      <MessageCircle className="size-3.5" aria-hidden />
      {t("unread", { count })}
    </span>
  );
}
