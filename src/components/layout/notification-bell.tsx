"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LoaderCircle } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/app-providers";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useRouter } from "@/i18n/routing";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationKeys,
  type Notification,
} from "@/lib/api/notifications";
import { cn } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);

/** Where a notification leads. Built here from checked ids, never from a URL in the data. */
function targetFor(n: Notification, isTeam: boolean, isAdmin: boolean): string {
  const d = n.data ?? {};
  if (n.type.startsWith("RETURN")) return isAdmin && n.type === "RETURN_ESCALATED" ? "/admin/disputes" : isTeam ? "/owner/returns" : "/account/returns";
  if (n.type === "ORDER_PLACED" && id(d.checkoutId)) return `/checkout/${id(d.checkoutId)}`;
  if (n.type === "ORDER_STATUS") return "/account/orders";
  if (n.type === "ORDER_NEW" || n.type === "ORDER_CANCELLED") return "/owner/orders";
  if (n.type.startsWith("BARGAIN")) return isTeam ? "/owner/bargains" : "/bargains";
  if (n.type.startsWith("VERIFICATION")) return "/owner/setup";
  return "/";
}

export function NotificationBell() {
  const t = useTranslations("Notifications");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status, user } = useSession();
  const [open, setOpen] = useState(false);
  const signedIn = status === "authenticated";
  const isTeam = user?.role === "SHOP_OWNER" || user?.role === "SHOP_STAFF";

  const count = useQuery({ queryKey: notificationKeys.count, queryFn: getUnreadCount, enabled: signedIn, refetchInterval: 60_000 });
  const list = useQuery({ queryKey: notificationKeys.list, queryFn: listNotifications, enabled: signedIn && open });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const readOne = useMutation({ mutationFn: markNotificationRead, onSuccess: refresh });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh });

  if (!signedIn) return null;
  const unread = count.data?.unread ?? 0;

  function go(n: Notification) {
    if (!n.read) readOne.mutate(n.id);
    setOpen(false);
    router.push(targetFor(n, isTeam, user?.role === "ADMIN"));
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? t("openWithCount", { count: unread }) : t("open")}
        className="relative flex size-11 items-center justify-center rounded-full text-ink-secondary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span aria-hidden className="type-caption absolute top-0.5 right-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 leading-none text-primary-foreground ring-2 ring-card">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      <SheetContent side="right" className="w-full overflow-y-auto bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-w-md">
        <SheetHeader className="flex-row items-center justify-between">
          <SheetTitle className="type-h3 text-ink">{t("title")}</SheetTitle>
          <SheetDescription className="sr-only">{t("title")}</SheetDescription>
          {unread > 0 && (
            <button type="button" onClick={() => readAll.mutate()} disabled={readAll.isPending} className="type-body-medium mr-8 text-brand underline-offset-4 hover:underline">
              {t("markAll")}
            </button>
          )}
        </SheetHeader>
        <div className="px-4">
          {list.isPending ? (
            <p role="status" className="type-body flex items-center gap-2 py-8 text-ink-secondary">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              {t("loading")}
            </p>
          ) : list.isError ? (
            <button type="button" onClick={() => list.refetch()} className="type-body-medium py-8 text-brand">{t("retry")}</button>
          ) : list.data.length === 0 ? (
            <p className="type-body py-8 text-ink-secondary">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col">
              {list.data.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => go(n)}
                    className={cn("flex w-full flex-col gap-0.5 border-t border-line px-2 py-3 text-left first:border-t-0 hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none", !n.read && "bg-highlight-soft/40")}
                  >
                    <span className="flex items-center gap-2">
                      {!n.read && <span className="size-2 shrink-0 rounded-full bg-brand" aria-label={t("unread")} />}
                      {/* Plain text from the server */}
                      <span className={cn("type-body text-ink", !n.read && "font-medium")}>{n.title}</span>
                    </span>
                    {n.body && <span className="type-caption text-ink-secondary">{n.body}</span>}
                    <span className="type-caption text-ink-muted">{format.relativeTime(new Date(n.createdAt), now)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}