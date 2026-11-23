"use client";

import { useQuery } from "@tanstack/react-query";
import { CreditCard, MessageSquareText, RefreshCw } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type LogItem = {
  id: string;
  channel: string;
  provider: string;
  toMasked: string; // the server never sends the full number
  template: string;
  body: string;
  status: string;
  error: string | null;
  subOrderId: string | null;
  createdAt: string;
};

async function getLog() {
  const r = await api.list<LogItem>("/admin/message-log", { query: { limit: 50 } });
  const meta = r.meta as { messagingMode?: string; paymentMode?: string } | undefined;
  return { items: r.data, messagingMode: meta?.messagingMode ?? "?", paymentMode: meta?.paymentMode ?? "?" };
}

/** Admin: which SMS/WhatsApp and payment providers are active, and the latest messages sent (phones masked). */
export function MessageLog() {
  const t = useTranslations("AdminMessages");
  const format = useFormatter();
  const log = useQuery({ queryKey: ["admin", "message-log"], queryFn: getLog });

  if (log.isPending) return <div className="h-64 skeleton rounded-md" aria-hidden />;
  if (log.isError) {
    return (
      <div role="alert" className="flex items-center gap-3">
        <p className="type-body text-ink-secondary">{t("loadError")}</p>
        <button type="button" onClick={() => log.refetch()} className="type-body-medium h-11 rounded-sm border border-brand px-4 text-brand hover:bg-subtle">{t("retry")}</button>
      </div>
    );
  }
  const { items, messagingMode, paymentMode } = log.data;
  const mock = (m: string) => m === "mock";

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-3 sm:grid-cols-2">
        {[
          { icon: MessageSquareText, label: t("messaging"), value: messagingMode },
          { icon: CreditCard, label: t("payments"), value: paymentMode },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 rounded-md border border-line bg-card p-4 shadow-card">
            <Icon className="size-6 text-highlight" aria-hidden />
            <div className="flex flex-col">
              <dt className="type-caption text-ink-muted">{label}</dt>
              <dd className="type-body-medium text-ink">
                {value}
                {mock(value) && <span className="type-caption ml-2 rounded-full bg-info-soft px-2 py-0.5 text-verified">{t("testMode")}</span>}
              </dd>
            </div>
          </div>
        ))}
      </dl>
      {(mock(messagingMode) || mock(paymentMode)) && <p className="type-caption -mt-3 text-ink-muted">{t("mockNote")}</p>}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="type-h3 text-ink">{t("latest")}</h2>
          <button type="button" onClick={() => log.refetch()} aria-label={t("refresh")} className="flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-subtle hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
            <RefreshCw className={cn("size-4", log.isFetching && "motion-safe:animate-spin")} aria-hidden />
          </button>
        </div>
        {items.length === 0 ? (
          <p className="type-body rounded-md border border-dashed border-line-strong p-6 text-center text-ink-secondary">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-card">
            {items.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="type-caption rounded-full bg-subtle px-2 py-0.5 text-ink-secondary">{m.channel}</span>
                  <span className="type-body-medium text-ink">{m.toMasked}</span>
                  <span className={cn("type-caption rounded-full px-2 py-0.5", m.status === "FAILED" ? "bg-error-soft text-error" : "bg-success-soft text-success-ink")}>{m.status}</span>
                  <span className="type-caption ml-auto text-ink-muted">{format.dateTime(new Date(m.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                </div>
                <p className="type-body break-words text-ink-secondary">{m.body}</p>
                {m.error && <p className="type-caption text-error">{m.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
