"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleCheck, LoaderCircle, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/core";
import { createReview, updateReview, type ReviewType } from "@/lib/api/reviews";
import { cn } from "@/lib/utils";

type Props = { orderId: string; type: ReviewType; productId?: string; title: string };

/** Stars (a real radio group: keyboard and screen readers work) plus an optional comment. */
export function ReviewForm({ orderId, type, productId, title }: Props) {
  const t = useTranslations("Reviews");
  const id = useId();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "info" | "error"; text: string } | null>(null);

  const save = useMutation({
    mutationFn: () =>
      existingId
        ? updateReview(existingId, { rating, comment: comment.trim() || null })
        : createReview({ orderId, type, ...(productId && { productId }), rating, ...(comment.trim() && { comment: comment.trim() }) }),
    onSuccess: (r) => {
      const wasUpdate = Boolean(existingId);
      setExistingId(r.id);
      setMessage({ kind: "ok", text: wasUpdate ? t("updated") : t("sent") });
    },
    onError: (err) => {
      // Already reviewed: switch to updating the existing review.
      const details = err instanceof ApiError ? (err.details as { reviewId?: unknown } | undefined) : undefined;
      if (err instanceof ApiError && err.status === 409 && typeof details?.reviewId === "string") {
        setExistingId(details.reviewId);
        setMessage({ kind: "info", text: t("already") });
        return;
      }
      setMessage({ kind: "error", text: t("error") });
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (rating < 1) return setMessage({ kind: "error", text: t("pickStars") });
    setMessage(null);
    save.mutate();
  }

  const shown = hover || rating;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2 rounded-md border border-line p-3">
      <p className="type-body-medium text-ink">{title}</p>
      <fieldset>
        <legend className="sr-only">{t("stars")}</legend>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer rounded-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand" onMouseEnter={() => setHover(n)}>
              <input type="radio" name={`${id}-stars`} value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" />
              <span className="sr-only">{t("star", { count: n })}</span>
              <Star aria-hidden className={cn("size-8", n <= shown ? "fill-highlight text-highlight" : "text-line-strong")} />
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`${id}-comment`} className="type-caption text-ink-secondary">{t("comment")}</label>
      <textarea
        id={`${id}-comment`}
        rows={2}
        maxLength={1000}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t("commentPlaceholder")}
        className="type-body w-full rounded-md border border-input bg-card px-3 py-2 text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
      />
      <button type="submit" disabled={save.isPending} className="type-body-medium flex h-11 items-center justify-center gap-2 self-start rounded-sm bg-action px-4 text-primary-foreground hover:bg-action-hover disabled:opacity-60">
        {save.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
        {save.isPending ? t("sending") : existingId ? t("update") : t("send")}
      </button>
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={cn("type-body flex items-center gap-2", message.kind === "error" ? "text-error" : message.kind === "info" ? "text-highlight" : "text-success-ink")}>
          {message.kind === "ok" && <CircleCheck className="size-4" aria-hidden />}
          {message.text}
        </p>
      )}
    </form>
  );
}