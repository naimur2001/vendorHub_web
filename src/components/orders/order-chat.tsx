"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, LoaderCircle, MessageCircle, Send } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { chatKeys, getChat, markChatRead, sendChatMessage, type ChatScope, type ChatState } from "@/lib/api/chat";
import { ApiError } from "@/lib/api/core";
import { cn } from "@/lib/utils";

const POLL_MS = 10_000;
const MAX = 1000;

/** Chat about one order between the customer and the shop. Checks for new messages every 10 seconds. */
export function OrderChat({ scope }: { scope: ChatScope }) {
  const t = useTranslations("OrderChat");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const inputId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const key = chatKeys.thread(scope);

  const chat = useQuery({
    queryKey: key,
    queryFn: () => getChat(scope),
    refetchInterval: (q) => (q.state.data?.closed ? false : POLL_MS),
    refetchIntervalInBackground: false,
  });

  const read = useMutation({ mutationFn: () => markChatRead(scope) });
  const unread = chat.data?.unreadCount ?? 0;
  useEffect(() => {
    // Seeing the thread marks the other side's messages read (once per new batch).
    if (unread > 0 && !read.isPending) read.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the unread count changes
  }, [unread]);

  const count = chat.data?.messages.length ?? 0;
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight; // newest at the bottom, in view
  }, [count]);

  const send = useMutation({
    mutationFn: (body: string) => sendChatMessage(scope, body),
    onMutate: () => setError(null),
    onSuccess: (message) => {
      setText("");
      queryClient.setQueryData<ChatState>(key, (old) => (old ? { ...old, messages: [...old.messages, message] } : old));
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 429) return setError(t("tooFast"));
      if (err instanceof ApiError && err.status === 409) {
        void chat.refetch();
        return setError(t("closedError"));
      }
      setError(err instanceof ApiError && err.status === 0 ? t("network") : t("error"));
    },
  });

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || send.isPending) return;
    send.mutate(body.slice(0, MAX));
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter makes a new line.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <section aria-labelledby={`${inputId}-title`} className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 shadow-card">
      <h2 id={`${inputId}-title`} className="type-h3 flex items-center gap-2 text-ink">
        <MessageCircle className="size-5 text-highlight" aria-hidden />
        {t(scope.kind === "shop" ? "titleShop" : "titleCustomer")}
      </h2>

      {chat.isPending ? (
        <div className="h-40 skeleton rounded-md" aria-hidden />
      ) : chat.isError ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="type-body text-ink-secondary">{t("loadError")}</p>
          <button type="button" onClick={() => chat.refetch()} className="type-body-medium h-11 rounded-sm border border-brand px-4 text-brand hover:bg-subtle">
            {t("retry")}
          </button>
        </div>
      ) : (
        <>
          <ol ref={listRef} aria-live="polite" aria-relevant="additions" className="flex max-h-80 flex-col gap-2 overflow-y-auto overscroll-contain pr-1">
            {chat.data.messages.length === 0 && <li className="type-body py-6 text-center text-ink-muted">{t("empty")}</li>}
            {chat.data.messages.map((m) => (
              <li key={m.id} className={cn("flex max-w-[85%] flex-col gap-0.5", m.mine ? "items-end self-end" : "items-start self-start")}>
                <span className="sr-only">{m.mine ? t("you") : t(m.senderRole === "SHOP" ? "shop" : "customer")}:</span>
                {/* Plain text: React escapes it; line breaks kept */}
                <p
                  className={cn(
                    "type-body rounded-2xl px-3 py-2 break-words whitespace-pre-wrap",
                    m.mine ? "rounded-br-sm bg-brand text-primary-foreground" : "rounded-bl-sm bg-subtle text-ink",
                  )}
                >
                  {m.body}
                </p>
                <span className="type-caption flex items-center gap-1 text-ink-muted">
                  {format.dateTime(new Date(m.createdAt), { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })}
                  {m.mine && m.readAt && (
                    <>
                      <CheckCheck className="size-3.5 text-success-ink" aria-hidden />
                      <span className="sr-only">{t("seen")}</span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>

          {chat.data.closed ? (
            <p className="type-caption rounded-md bg-subtle p-3 text-ink-secondary">{t("closed")}</p>
          ) : (
            <form onSubmit={submit} className="flex items-end gap-2">
              <label htmlFor={inputId} className="sr-only">
                {t("label")}
              </label>
              <textarea
                id={inputId}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                maxLength={MAX}
                rows={2}
                placeholder={t("placeholder")}
                className="type-body min-h-11 flex-1 resize-none rounded-xl border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
              />
              <button
                type="submit"
                disabled={send.isPending || !text.trim()}
                aria-label={t("send")}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-action text-primary-foreground hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
              >
                {send.isPending ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
              </button>
            </form>
          )}
          {error && (
            <p role="alert" className="type-caption text-error">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
