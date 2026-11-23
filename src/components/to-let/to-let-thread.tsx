"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, MessageCircle, Send } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ApiError } from "@/lib/api/core";
import type { ToLetMessage } from "@/lib/api/to-let";
import { cn } from "@/lib/utils";

const MAX = 1000;

type Props = {
  queryKey: readonly unknown[];
  load: () => Promise<ToLetMessage[]>;
  send: (body: string) => Promise<ToLetMessage>;
  title: string;
  intro?: string;
  pollMs?: number; // 0 = no polling
};

/** A message thread with the Vendors Hub team (owner ↔ admin, or renter ↔ admin). Plain text only. */
export function ToLetThread({ queryKey, load, send, title, intro, pollMs = 15_000 }: Props) {
  const t = useTranslations("ToLetThread");
  const format = useFormatter();
  const id = useId();
  const queryClient = useQueryClient();
  const listRef = useRef<HTMLOListElement>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const thread = useQuery({ queryKey, queryFn: load, refetchInterval: pollMs || false, refetchIntervalInBackground: false });
  const count = thread.data?.length ?? 0;
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  const post = useMutation({
    mutationFn: (body: string) => send(body),
    onMutate: () => setError(null),
    onSuccess: (m) => {
      setText("");
      queryClient.setQueryData<ToLetMessage[]>(queryKey, (old) => [...(old ?? []), m]);
    },
    onError: (err) => setError(err instanceof ApiError && err.status === 429 ? t("tooFast") : err instanceof ApiError && err.status === 0 ? t("network") : t("error")),
  });

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (body && !post.isPending) post.mutate(body.slice(0, MAX));
  }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  const who = (m: ToLetMessage) => (m.mine ? t("you") : m.senderRole === "ADMIN" ? t("team") : m.senderRole === "OWNER" ? t("owner") : t("renter"));

  return (
    <section aria-labelledby={`${id}-t`} className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card">
      <h2 id={`${id}-t`} className="type-h3 flex items-center gap-2 text-ink">
        <MessageCircle className="size-5 text-highlight" aria-hidden />
        {title}
      </h2>
      {intro && <p className="type-caption text-ink-secondary">{intro}</p>}
      {thread.isPending ? (
        <div className="h-32 skeleton rounded-md" aria-hidden />
      ) : thread.isError ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => thread.refetch()} className="type-body-medium h-11 rounded-sm border border-brand px-4 text-brand hover:bg-subtle">{t("retry")}</button>
        </div>
      ) : (
        <ol ref={listRef} aria-live="polite" aria-relevant="additions" className="flex max-h-80 flex-col gap-2 overflow-y-auto overscroll-contain pr-1">
          {thread.data.length === 0 && <li className="type-body py-4 text-center text-ink-muted">{t("empty")}</li>}
          {thread.data.map((m) => (
            <li key={m.id} className={cn("flex max-w-[85%] flex-col gap-0.5", m.mine ? "items-end self-end" : "items-start self-start")}>
              <span className="type-caption text-ink-muted">{who(m)}</span>
              <p className={cn("type-body rounded-2xl px-3 py-2 break-words whitespace-pre-wrap", m.mine ? "rounded-br-sm bg-brand text-primary-foreground" : "rounded-bl-sm bg-subtle text-ink")}>{m.body}</p>
              <span className="type-caption text-ink-muted">{format.dateTime(new Date(m.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={submit} className="flex items-end gap-2">
        <label htmlFor={id} className="sr-only">{t("label")}</label>
        <textarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          maxLength={MAX}
          rows={2}
          placeholder={t("placeholder")}
          className="type-body min-h-11 flex-1 resize-none rounded-xl border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
        />
        <button type="submit" disabled={post.isPending || !text.trim()} aria-label={t("send")} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-action text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50">
          {post.isPending ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        </button>
      </form>
      {error && <p role="alert" className="type-caption text-error">{error}</p>}
    </section>
  );
}
